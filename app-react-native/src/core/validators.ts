// Validation des formulaires d'authentification et de profil.
// Chaque fonction renvoie un message d'erreur, ou null si la valeur est valide.

// 6 caractères : minimum imposé par Firebase Authentication.
export const MIN_PASSWORD_LENGTH = 6;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (value.length === 0) {
    return "L'email est obligatoire.";
  }
  if (!EMAIL_PATTERN.test(value)) {
    return "L'email n'est pas valide.";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length === 0) {
    return 'Le mot de passe est obligatoire.';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }
  return null;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | null {
  if (password !== confirmation) {
    return 'Les mots de passe ne correspondent pas.';
  }
  return null;
}

// Profil : mêmes règles que l'application Flutter (validateRequiredField et
// _validatePhone de profile_screen.dart).
const PHONE_PATTERN = /^\+?[0-9 ]{8,15}$/;

export function validateRequiredName(name: string): string | null {
  return name.trim().length === 0 ? 'Ce champ est obligatoire.' : null;
}

// Le téléphone est facultatif : vide = valide.
export function validatePhone(phone: string): string | null {
  const value = phone.trim();
  if (value.length === 0) {
    return null;
  }
  return PHONE_PATTERN.test(value) ? null : 'Numéro de téléphone invalide.';
}
