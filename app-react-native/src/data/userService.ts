import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import {
  getDownloadURL,
  getStorage,
  putFile,
  ref,
} from '@react-native-firebase/storage';
import { EditableProfileFields, UserProfile } from './userModel';

// Accès au document users/{uid} (F2) et à la photo de profil dans Firebase Storage.

const USERS_COLLECTION = 'users';

function userDoc(uid: string) {
  return doc(getFirestore(), USERS_COLLECTION, uid);
}

// Crée le profil à l'inscription (étape 5, point 3 du README).
export async function createUserProfile(
  uid: string,
  email: string,
  nom: string = '',
  photoUrl: string = '',
): Promise<void> {
  await setDoc(userDoc(uid), {
    id: uid,
    nom,
    email,
    telephone: '',
    photoUrl,
    role: 'utilisateur',
    dateCreation: serverTimestamp(),
    jetonNotification: '',
  });
}

// Crée users/{uid} uniquement s'il n'existe pas encore (compte Google, ancien
// compte…). Ne modifie jamais un document existant (ensureUserDocument Flutter).
export async function ensureUserProfile(
  uid: string,
  email: string,
  nom: string = '',
  photoUrl: string = '',
): Promise<UserProfile | null> {
  const snapshot = await getDoc(userDoc(uid));
  if (snapshot.exists()) {
    return snapshot.data() as UserProfile;
  }
  await createUserProfile(uid, email, nom, photoUrl);
  const created = await getDoc(userDoc(uid));
  return created.exists() ? (created.data() as UserProfile) : null;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(userDoc(uid));
  if (!snapshot.exists()) {
    return null;
  }
  return snapshot.data() as UserProfile;
}

// Profil en temps réel (nom et photo des correspondants, écran de profil).
export function watchUserProfile(
  uid: string,
  onChange: (profile: Partial<UserProfile> | null) => void,
): () => void {
  return onSnapshot(
    userDoc(uid),
    snapshot =>
      onChange(snapshot.exists() ? (snapshot.data() as Partial<UserProfile>) : null),
    () => onChange(null),
  );
}

export async function updateUserProfile(
  uid: string,
  fields: EditableProfileFields,
): Promise<void> {
  const changes: Record<string, string> = {
    nom: fields.nom.trim(),
    telephone: fields.telephone.trim(),
  };
  if (fields.role) {
    changes.role = fields.role;
  }
  await updateDoc(userDoc(uid), changes);
}

// Envoie la photo vers Storage puis enregistre son URL dans le profil.
export async function uploadProfilePhoto(
  uid: string,
  localUri: string,
): Promise<string> {
  const photoRef = ref(getStorage(), `users/${uid}/profile.jpg`);
  await putFile(photoRef, localUri);
  const url = await getDownloadURL(photoRef);
  await updateDoc(userDoc(uid), { photoUrl: url });
  return url;
}
