// Entité Utilisateur du dossier de conception (§ 4.4).
// Document Firestore : users/{uid}. Le champ `id` est égal à l'uid.

export type UserRole = 'utilisateur' | 'agence' | 'admin';

export interface UserProfile {
  id: string;
  nom: string;
  email: string;
  telephone: string;
  photoUrl: string;
  role: UserRole;
  // Date de création (Firestore Timestamp ; null tant que le serveur ne l'a pas renseignée).
  dateCreation: unknown;
  jetonNotification: string;
}

// Champs modifiables depuis l'écran de profil (F2).
// Le rôle « admin » n'est jamais proposé à l'utilisateur ; `role` est omis
// pour un compte administrateur afin de ne pas modifier son rôle.
export interface EditableProfileFields {
  nom: string;
  telephone: string;
  role?: Exclude<UserRole, 'admin'>;
}
