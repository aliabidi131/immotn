import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from '@react-native-firebase/auth';

// Accès à Firebase Authentication (F1) : email / mot de passe et Google.

// Client OAuth « Web » (client_type 3) du google-services.json : même valeur que
// app-flutter/lib/auth_service.dart. Ce n'est pas un secret (audience de l'idToken).
export const GOOGLE_WEB_CLIENT_ID =
  '517301967098-bug8m9te42ccmqnh1bfeufke3hp8alg4.apps.googleusercontent.com';

interface GoogleSigninModule {
  GoogleSignin: {
    configure: (options: { webClientId: string }) => void;
    hasPlayServices: () => Promise<boolean>;
    signIn: () => Promise<unknown>;
    signOut: () => Promise<unknown>;
  };
}

// Chargement à la demande : si le module natif n'est pas installé, seule la
// connexion Google est indisponible, le reste de l'application fonctionne.
function loadGoogleModule(): GoogleSigninModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@react-native-google-signin/google-signin') as GoogleSigninModule;
  } catch {
    return null;
  }
}

export function isGoogleSignInAvailable(): boolean {
  return loadGoogleModule() !== null;
}

export interface GoogleUserInfo {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
}

// Connexion avec Google. Renvoie null si l'utilisateur annule.
export async function loginWithGoogle(): Promise<GoogleUserInfo | null> {
  const module = loadGoogleModule();
  if (!module) {
    throw new Error('GOOGLE_UNAVAILABLE');
  }
  module.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  await module.GoogleSignin.hasPlayServices();
  const result = (await module.GoogleSignin.signIn()) as {
    type?: string;
    idToken?: string | null;
    data?: { idToken?: string | null } | null;
  };
  if (result.type === 'cancelled') {
    return null;
  }
  const idToken = result.data?.idToken ?? result.idToken ?? null;
  if (!idToken) {
    throw new Error('GOOGLE_NO_TOKEN');
  }
  const credential = await signInWithCredential(
    getAuth(),
    GoogleAuthProvider.credential(idToken),
  );
  const user = credential.user;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoUrl: user.photoURL,
  };
}

export function watchAuthState(
  callback: (user: { uid: string; email: string | null } | null) => void,
): () => void {
  return onAuthStateChanged(getAuth(), user => {
    callback(user ? { uid: user.uid, email: user.email } : null);
  });
}

export async function registerWithEmail(
  email: string,
  password: string,
): Promise<{ uid: string; email: string | null }> {
  const credential = await createUserWithEmailAndPassword(
    getAuth(),
    email.trim(),
    password,
  );
  return { uid: credential.user.uid, email: credential.user.email };
}

export async function loginWithEmail(
  email: string,
  password: string,
): Promise<void> {
  await signInWithEmailAndPassword(getAuth(), email.trim(), password);
}

// Déconnexion Google (si active) puis Firebase (signOutAll Flutter).
export async function logout(): Promise<void> {
  const module = loadGoogleModule();
  if (module) {
    try {
      await module.GoogleSignin.signOut();
    } catch {
      // Ignoré : la déconnexion Firebase doit aboutir quoi qu'il arrive.
    }
  }
  await signOut(getAuth());
}

// Nom et photo du compte Firebase courant (repli d'affichage du profil).
export function getCurrentAuthInfo(): {
  displayName: string | null;
  photoUrl: string | null;
  email: string | null;
} {
  const user = getAuth().currentUser;
  return {
    displayName: user?.displayName ?? null,
    photoUrl: user?.photoURL ?? null,
    email: user?.email ?? null,
  };
}

// Jeton d'identification Firebase frais. Il authentifie les appels à l'Edge
// Function Supabase `process-image` (upload/suppression des photos d'annonces),
// qui le vérifie côté serveur, comme dans l'application Flutter.
export async function getFirebaseIdToken(): Promise<string | null> {
  const user = getAuth().currentUser;
  if (!user) {
    return null;
  }
  return user.getIdToken(true);
}

// Uid de l'utilisateur connecté (null si visiteur).
export function getCurrentUid(): string | null {
  return getAuth().currentUser?.uid ?? null;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getAuth(), email.trim());
}

// Traduit les codes d'erreur Firebase Auth en messages lisibles.
export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return "L'email n'est pas valide.";
    case 'auth/email-already-in-use':
      return 'Un compte existe déjà avec cet email.';
    case 'auth/weak-password':
      return 'Le mot de passe est trop faible.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email ou mot de passe incorrect.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Réessayez plus tard.';
    case 'auth/network-request-failed':
      return 'Problème de connexion réseau.';
    case 'auth/account-exists-with-different-credential':
      return 'Un compte existe déjà avec cet email. Connectez-vous par email.';
    default:
      if (error instanceof Error && error.message === 'GOOGLE_UNAVAILABLE') {
        return 'Connexion Google indisponible sur cet appareil.';
      }
      if (error instanceof Error && error.message === 'GOOGLE_NO_TOKEN') {
        return "Google n'a pas fourni de jeton d'identification.";
      }
      return "Une erreur est survenue. Réessayez.";
  }
}
