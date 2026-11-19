import {
  STATUT_ACTIVE,
  STATUT_MASQUEE,
  STATUT_VENDUE,
  TYPE_BIEN_LABELS,
  typeBienLabel,
} from '../../core/format';
import { isValidCoordinates } from '../../core/geo';

export type TransactionType = 'vente' | 'location';

// Valeur de `proprietaireId` des annonces de démonstration (fictives).
export const DEMO_OWNER_ID = 'DEMO';

// Nombre maximal de photos par annonce (règle Firestore : photos.size() <= 8).
export const MAX_PHOTOS = 8;

export interface Listing {
  id: string;
  titre: string;
  description: string;
  typeTransaction: TransactionType;
  typeBien: string;
  prix: number;
  surface: number;
  nombrePieces: number;
  ville: string;
  adresse: string;
  latitude?: number;
  longitude?: number;
  photos: string[];
  statut: 'active' | 'vendue' | 'masquee';
  proprietaireId: string;
  dateCreation: unknown;
}

export interface ListingDraft {
  titre: string;
  description: string;
  typeTransaction: TransactionType;
  typeBien: string;
  prix: string;
  surface: string;
  nombrePieces: string;
  ville: string;
  adresse?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export function isListingActive(listing: Listing): boolean {
  return listing.statut === STATUT_ACTIVE;
}

export function isDemoListing(listing: Listing): boolean {
  return listing.proprietaireId === DEMO_OWNER_ID;
}

export function hasLocation(listing: Listing): boolean {
  return isValidCoordinates(listing.latitude, listing.longitude);
}

export function coverPhoto(listing: Listing): string {
  return listing.photos.length === 0 ? '' : listing.photos[0];
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallback;
}

// Lit un document Firestore. Tolère les champs absents des anciennes annonces
// (adresse, photos, coordonnées) au lieu de planter — même comportement que
// Listing.fromDoc côté Flutter.
export function normalizeListing(id: string, data: unknown): Listing {
  const raw = (
    typeof data === 'object' && data !== null ? data : {}
  ) as Record<string, unknown>;
  const statut = raw.statut;
  const photos = Array.isArray(raw.photos)
    ? raw.photos.filter((p): p is string => typeof p === 'string')
    : [];
  const hasCoords = isValidCoordinates(raw.latitude, raw.longitude);
  return {
    id,
    titre: asString(raw.titre, 'Sans titre'),
    description: asString(raw.description, ''),
    typeTransaction: raw.typeTransaction === 'location' ? 'location' : 'vente',
    typeBien: asString(raw.typeBien, ''),
    prix: asNumber(raw.prix, 0),
    surface: asNumber(raw.surface, 0),
    nombrePieces: Math.trunc(asNumber(raw.nombrePieces, 0)),
    ville: asString(raw.ville, ''),
    adresse: asString(raw.adresse, ''),
    latitude: hasCoords ? (raw.latitude as number) : undefined,
    longitude: hasCoords ? (raw.longitude as number) : undefined,
    photos,
    statut:
      statut === STATUT_VENDUE || statut === STATUT_MASQUEE
        ? statut
        : STATUT_ACTIVE,
    proprietaireId: asString(raw.proprietaireId, ''),
    dateCreation: raw.dateCreation ?? null,
  };
}

// ---------------------------------------------------------------- Validation

// Tolère les espaces (« 500 000 ») et la virgule décimale (« 12,5 »).
export function parseNumber(text: string): number {
  const cleaned = text.replace(/\s+/g, '').replace(',', '.');
  if (cleaned.length === 0) {
    return Number.NaN;
  }
  return Number(cleaned);
}

function parseRooms(text: string): number {
  return text.trim().length === 0 ? 0 : Number(text.trim());
}

export function validateListingDraft(draft: ListingDraft): string | null {
  if (!draft.titre.trim() || !draft.description.trim() || !draft.ville.trim()) {
    return 'Renseignez le titre, la description et la ville.';
  }
  const prix = parseNumber(draft.prix);
  if (!Number.isFinite(prix) || prix <= 0) {
    return 'Le prix doit être supérieur à zéro.';
  }
  const surface = parseNumber(draft.surface);
  if (!Number.isFinite(surface) || surface <= 0) {
    return 'La surface doit être supérieure à zéro.';
  }
  const pieces = parseRooms(draft.nombrePieces);
  if (!Number.isInteger(pieces) || pieces < 0) {
    return 'Le nombre de pièces doit être un entier positif ou nul.';
  }
  return null;
}

// Étapes de l'assistant de publication (Infos, Détails, Photos).
export const PUBLISH_STEP_LABELS = ['Infos', 'Détails', 'Photos'];

// Valide une étape de l'assistant ; renvoie un message d'erreur ou null.
export function validatePublishStep(
  step: number,
  draft: ListingDraft,
  photoCount: number,
): string | null {
  if (step === 0) {
    const prix = parseNumber(draft.prix);
    if (!Number.isFinite(prix) || prix <= 0) {
      return 'Le prix doit être supérieur à zéro.';
    }
    if (!draft.ville.trim()) {
      return 'La ville est obligatoire.';
    }
    return null;
  }
  if (step === 1) {
    if (!draft.titre.trim()) {
      return 'Le titre est obligatoire.';
    }
    if (!draft.description.trim()) {
      return 'La description est obligatoire.';
    }
    const surface = parseNumber(draft.surface);
    if (!Number.isFinite(surface) || surface <= 0) {
      return 'La surface doit être supérieure à zéro.';
    }
    const pieces = parseRooms(draft.nombrePieces);
    if (!Number.isInteger(pieces) || pieces < 0) {
      return 'Le nombre de pièces doit être un entier positif ou nul.';
    }
    return null;
  }
  if (step === 2 && photoCount === 0) {
    return 'Ajoutez au moins une photo du bien.';
  }
  return null;
}

// Champs communs enregistrés dans Firestore. Seules les clés autorisées par
// backend/firestore.rules sont produites. Sur une création, l'adresse n'est
// envoyée que si elle est renseignée (comme Flutter) ; sur une modification,
// elle est toujours envoyée. La position n'est jamais inventée.
export function buildListingData(
  draft: ListingDraft,
  mode: 'create' | 'update',
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    titre: draft.titre.trim(),
    description: draft.description.trim(),
    typeTransaction: draft.typeTransaction,
    typeBien: draft.typeBien,
    prix: parseNumber(draft.prix),
    surface: parseNumber(draft.surface),
    nombrePieces: parseRooms(draft.nombrePieces),
    ville: draft.ville.trim(),
  };
  const adresse = (draft.adresse ?? '').trim();
  if (mode === 'update' || adresse.length > 0) {
    data.adresse = adresse;
  }
  if (isValidCoordinates(draft.latitude, draft.longitude)) {
    data.latitude = draft.latitude;
    data.longitude = draft.longitude;
  }
  return data;
}

// ------------------------------------------------------------------ Filtres

export interface ListingFilters {
  transaction: 'tous' | TransactionType;
  typeBien: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  minSurface: number | null;
  minRooms: number | null;
  city: string;
}

export const EMPTY_FILTERS: ListingFilters = {
  transaction: 'tous',
  typeBien: null,
  minPrice: null,
  maxPrice: null,
  minSurface: null,
  minRooms: null,
  city: '',
};

export function areFiltersEmpty(filters: ListingFilters): boolean {
  return (
    filters.transaction === 'tous' &&
    filters.typeBien === null &&
    filters.minPrice === null &&
    filters.maxPrice === null &&
    filters.minSurface === null &&
    filters.minRooms === null &&
    filters.city.length === 0
  );
}

export function matchesFilters(
  listing: Listing,
  filters: ListingFilters,
): boolean {
  if (
    filters.transaction !== 'tous' &&
    listing.typeTransaction !== filters.transaction
  ) {
    return false;
  }
  if (filters.typeBien !== null && listing.typeBien !== filters.typeBien) {
    return false;
  }
  if (filters.minPrice !== null && listing.prix < filters.minPrice) {
    return false;
  }
  if (filters.maxPrice !== null && listing.prix > filters.maxPrice) {
    return false;
  }
  if (filters.minSurface !== null && listing.surface < filters.minSurface) {
    return false;
  }
  if (filters.minRooms !== null && listing.nombrePieces < filters.minRooms) {
    return false;
  }
  if (
    filters.city.length > 0 &&
    !listing.ville.toLowerCase().includes(filters.city.toLowerCase())
  ) {
    return false;
  }
  return true;
}

// Recherche textuelle : titre, ville, adresse ou type de bien.
export function matchesSearch(listing: Listing, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (query.length === 0) {
    return true;
  }
  return (
    listing.titre.toLowerCase().includes(query) ||
    listing.ville.toLowerCase().includes(query) ||
    listing.adresse.toLowerCase().includes(query) ||
    listing.typeBien.toLowerCase().includes(query) ||
    typeBienLabel(listing.typeBien).toLowerCase().includes(query)
  );
}

// Les types de bien proposés dans l'application (clé -> libellé).
export const TYPE_BIEN_OPTIONS = Object.entries(TYPE_BIEN_LABELS).map(
  ([key, label]) => ({ key, label }),
);
