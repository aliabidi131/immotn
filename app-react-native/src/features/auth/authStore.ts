import { create } from 'zustand';
import {
  getCurrentAuthInfo,
  loginWithEmail,
  loginWithGoogle,
  logout as logoutService,
  registerWithEmail,
  watchAuthState,
} from '../../data/authService';
import {
  createUserProfile,
  ensureUserProfile,
  getUserProfile,
  updateUserProfile,
  uploadProfilePhoto,
} from '../../data/userService';
import { EditableProfileFields, UserProfile } from '../../data/userModel';

// État d'authentification et de profil (gestion de session, étape 5 du README).

interface AuthState {
  // true tant que l'état de connexion n'est pas connu (démarrage de l'app).
  initializing: boolean;
  uid: string | null;
  profile: UserProfile | null;
  start: () => () => void;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  // Renvoie false si l'utilisateur a annulé la connexion Google.
  loginGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
  saveProfile: (fields: EditableProfileFields) => Promise<void>;
  changePhoto: (localUri: string) => Promise<void>;
}

// Évite que l'écouteur de session lise le profil avant sa création à l'inscription.
let registering = false;

// Lit le profil et le crée s'il n'existe pas encore (compte Google, ancien
// compte) — comme ensureUserDocument côté Flutter.
async function loadOrCreateProfile(
  uid: string,
  email: string | null,
): Promise<UserProfile | null> {
  try {
    const existing = await getUserProfile(uid);
    if (existing) {
      return existing;
    }
    const info = getCurrentAuthInfo();
    return await ensureUserProfile(
      uid,
      email ?? info.email ?? '',
      info.displayName ?? '',
      info.photoUrl ?? '',
    );
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  initializing: true,
  uid: null,
  profile: null,

  start: () =>
    watchAuthState(async user => {
      if (!user) {
        set({ initializing: false, uid: null, profile: null });
        return;
      }
      set({ uid: user.uid });
      if (registering) {
        return;
      }
      const profile = await loadOrCreateProfile(user.uid, user.email);
      set({ initializing: false, profile });
    }),

  register: async (email, password) => {
    registering = true;
    try {
      const user = await registerWithEmail(email, password);
      await createUserProfile(user.uid, email.trim());
      const profile = await getUserProfile(user.uid);
      set({ initializing: false, uid: user.uid, profile });
    } finally {
      registering = false;
    }
  },

  login: async (email, password) => {
    await loginWithEmail(email, password);
  },

  loginGoogle: async () => {
    const info = await loginWithGoogle();
    return info !== null;
  },

  logout: async () => {
    await logoutService();
  },

  saveProfile: async fields => {
    const uid = get().uid;
    if (!uid) {
      return;
    }
    await updateUserProfile(uid, fields);
    set({ profile: await getUserProfile(uid) });
  },

  changePhoto: async localUri => {
    const uid = get().uid;
    if (!uid) {
      return;
    }
    await uploadProfilePhoto(uid, localUri);
    set({ profile: await getUserProfile(uid) });
  },
}));
