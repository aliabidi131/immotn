// Libellés et formats d'affichage, identiques à ceux de l'application Flutter
// (listing_model.dart) pour que les deux applications montrent les mêmes textes.

export const STATUT_ACTIVE = 'active';
export const STATUT_VENDUE = 'vendue';
export const STATUT_MASQUEE = 'masquee';

export type ListingStatus =
  | typeof STATUT_ACTIVE
  | typeof STATUT_VENDUE
  | typeof STATUT_MASQUEE;

export const TRANSACTION_LABELS: Record<string, string> = {
  vente: 'Vente',
  location: 'Location',
};

export const TYPE_BIEN_LABELS: Record<string, string> = {
  appartement: 'Appartement',
  maison: 'Maison',
  villa: 'Villa',
  terrain: 'Terrain',
  local: 'Local commercial',
};

export const TYPE_BIEN_KEYS = Object.keys(TYPE_BIEN_LABELS);

export const STATUT_LABELS: Record<string, string> = {
  [STATUT_ACTIVE]: 'Active',
  [STATUT_VENDUE]: 'Vendue',
  [STATUT_MASQUEE]: 'Masquée',
};

export function transactionLabel(value: string): string {
  return TRANSACTION_LABELS[value] ?? value;
}

export function typeBienLabel(value: string): string {
  return TYPE_BIEN_LABELS[value] ?? value;
}

// Ex. 125000 -> « 125 000 TND » (séparateur de milliers : espace).
export function formatPrice(value: number): string {
  const digits = Math.abs(Math.round(value)).toString();
  let grouped = '';
  for (let i = 0; i < digits.length; i++) {
    grouped += digits[i];
    const remainingAfter = digits.length - i - 1;
    if (remainingAfter > 0 && remainingAfter % 3 === 0) {
      grouped += ' ';
    }
  }
  return `${grouped} TND`;
}

// Affiche 120 et non 120.0 (en JavaScript, 120.0 et 120 sont le même nombre).
export function formatQuantity(value: number): string {
  return String(value);
}

function two(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDate(date: Date): string {
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatHourMinute(date: Date): string {
  return `${two(date.getHours())}:${two(date.getMinutes())}`;
}

// Heure si le message date d'aujourd'hui, sinon jour/mois.
export function formatHourOrDate(date: Date, now: Date = new Date()): string {
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();
  return sameDay
    ? formatHourMinute(date)
    : `${two(date.getDate())}/${two(date.getMonth() + 1)}`;
}

// Convertit un Timestamp Firestore (ou toute valeur avec toDate()) en Date.
// Renvoie null tant que l'horodatage serveur n'est pas connu.
export function toDate(value: unknown): Date | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    const result = (value as { toDate: () => Date }).toDate();
    return result instanceof Date && !Number.isNaN(result.getTime())
      ? result
      : null;
  }
  return null;
}
