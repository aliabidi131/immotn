import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import type { QueryDocumentSnapshot } from '@react-native-firebase/firestore';
import { getCurrentUid, getFirebaseIdToken } from './authService';
import { demoById } from './demoData';
import { deletePhotos, uploadPhotos } from './imageService';
import type { PhotoToUpload } from './imageService';
import { normalizeListing } from '../features/listings/listingModel';
import type { Listing } from '../features/listings/listingModel';

// Même schéma que app-flutter/lib/listing_repository.dart :
//   listings/{id}
//   favorites/{uid}/user_favorites/{listingId}  -> { listingId }

const LISTINGS_COLLECTION = 'listings';
export const PAGE_SIZE = 20;

export type ListingCursor = QueryDocumentSnapshot;

export interface ListingPage {
  items: Listing[];
  lastDoc: ListingCursor | null;
  hasMore: boolean;
}

function listingsCollection() {
  return collection(getFirestore(), LISTINGS_COLLECTION);
}

function favoritesCollection(uid: string) {
  return collection(getFirestore(), 'favorites', uid, 'user_favorites');
}

function toListing(id: string, data: unknown): Listing {
  return normalizeListing(id, data);
}

// --- Rafraîchissement : les écrans chargés une seule fois (accueil) s'abonnent
// ici pour se recharger après une modification (revision côté Flutter).
const revisionListeners = new Set<() => void>();

export function subscribeListingsChanged(listener: () => void): () => void {
  revisionListeners.add(listener);
  return () => {
    revisionListeners.delete(listener);
  };
}

export function notifyListingsChanged(): void {
  revisionListeners.forEach(listener => listener());
}

// --------------------------------------------------------------- Annonces

function activeQuery() {
  return query(
    listingsCollection(),
    where('statut', '==', 'active'),
    orderBy('dateCreation', 'desc'),
  );
}

// Page d'annonces actives (pagination par curseur).
export async function fetchActivePage(
  after: ListingCursor | null = null,
  pageSize: number = PAGE_SIZE,
): Promise<ListingPage> {
  const base = activeQuery();
  const pageQuery = after
    ? query(base, startAfter(after), limit(pageSize))
    : query(base, limit(pageSize));
  const snapshot = await getDocs(pageQuery);
  const docs = snapshot.docs;
  return {
    items: docs.map(document => toListing(document.id, document.data())),
    lastDoc: docs.length === 0 ? null : docs[docs.length - 1],
    hasMore: docs.length === pageSize,
  };
}

// Flux temps réel des annonces actives (carte, page « Toutes les annonces »).
export function watchActiveListings(
  onChange: (listings: Listing[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    activeQuery(),
    snapshot => {
      onChange(
        snapshot.docs.map(document => toListing(document.id, document.data())),
      );
    },
    onError,
  );
}

// Annonces publiées par un utilisateur, tous statuts confondus.
export function watchMyListings(
  uid: string,
  onChange: (listings: Listing[]) => void,
  onError: (error: Error) => void,
): () => void {
  const mine = query(
    listingsCollection(),
    where('proprietaireId', '==', uid),
    orderBy('dateCreation', 'desc'),
  );
  return onSnapshot(
    mine,
    snapshot => {
      onChange(
        snapshot.docs.map(document => toListing(document.id, document.data())),
      );
    },
    onError,
  );
}

export async function getListing(id: string): Promise<Listing | null> {
  const demo = demoById(id);
  if (demo) {
    return demo;
  }
  const snapshot = await getDoc(doc(getFirestore(), LISTINGS_COLLECTION, id));
  return snapshot.exists() ? toListing(snapshot.id, snapshot.data()) : null;
}

// Suit une annonce en temps réel (null si elle n'existe plus ou n'est plus
// accessible). Les annonces de démonstration restent figées.
export function watchListing(
  id: string,
  onChange: (listing: Listing | null) => void,
): () => void {
  if (demoById(id)) {
    return () => {};
  }
  return onSnapshot(
    doc(getFirestore(), LISTINGS_COLLECTION, id),
    snapshot => {
      onChange(snapshot.exists() ? toListing(snapshot.id, snapshot.data()) : null);
    },
    () => onChange(null),
  );
}

// Crée l'annonce (même séquence que Flutter) :
//  1. identifiant Firestore local, sans écriture réseau ;
//  2. envoi des photos vers Supabase Storage (Edge Function, jeton Firebase) ;
//  3. écriture unique du document final (statut « active » + URLs), ce qui
//     respecte les règles Firestore.
// Si l'envoi échoue, aucun document n'est créé.
export async function createListing(
  ownerId: string,
  data: Record<string, unknown>,
  photos: PhotoToUpload[],
  onProgress?: (done: number, total: number) => void,
): Promise<string> {
  const reference = doc(listingsCollection());
  const urls = await uploadPhotos({
    listingId: reference.id,
    photos,
    getToken: getFirebaseIdToken,
    onProgress,
  });
  await setDoc(reference, {
    ...data,
    photos: urls,
    proprietaireId: ownerId,
    statut: 'active',
    dateCreation: serverTimestamp(),
  });
  notifyListingsChanged();
  return reference.id;
}

export async function updateStatus(
  listingId: string,
  statut: 'active' | 'vendue' | 'masquee',
): Promise<void> {
  await updateDoc(doc(getFirestore(), LISTINGS_COLLECTION, listingId), {
    statut,
  });
  notifyListingsChanged();
}

// Modifie une annonce de l'utilisateur connecté :
//  1. envoie d'abord les nouvelles photos (échec => annonce intacte) ;
//  2. met à jour le document (champs autorisés par les règles) ;
//  3. supprime les photos retirées, sans bloquer si le stockage échoue.
export async function updateListing(
  listing: Listing,
  data: Record<string, unknown>,
  keptPhotos: string[],
  newPhotos: PhotoToUpload[],
  removeLocation: boolean,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const uid = getCurrentUid();
  if (!uid || uid !== listing.proprietaireId) {
    throw new Error("Vous n'êtes pas propriétaire de cette annonce.");
  }
  const uploaded =
    newPhotos.length === 0
      ? []
      : await uploadPhotos({
          listingId: listing.id,
          photos: newPhotos,
          getToken: getFirebaseIdToken,
          onProgress,
        });
  const changes: Record<string, unknown> = {
    ...data,
    photos: [...keptPhotos, ...uploaded],
  };
  if (removeLocation) {
    changes.latitude = deleteField();
    changes.longitude = deleteField();
  }
  await updateDoc(doc(getFirestore(), LISTINGS_COLLECTION, listing.id), changes);
  notifyListingsChanged();

  const removed = listing.photos.filter(url => !keptPhotos.includes(url));
  if (removed.length > 0) {
    void deletePhotos(removed, getFirebaseIdToken);
  }
}

// Supprime le document Firestore puis les images Supabase associées
// (nettoyage non bloquant, APRÈS confirmation de la suppression Firestore).
export async function deleteListing(listing: Listing): Promise<void> {
  const uid = getCurrentUid();
  if (!uid || uid !== listing.proprietaireId) {
    throw new Error("Vous n'êtes pas propriétaire de cette annonce.");
  }
  await deleteDoc(doc(getFirestore(), LISTINGS_COLLECTION, listing.id));
  notifyListingsChanged();
  await deletePhotos(listing.photos, getFirebaseIdToken);
}

// ---------------------------------------------------------------- Favoris

export function watchFavoriteIds(
  uid: string,
  onChange: (ids: string[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    favoritesCollection(uid),
    snapshot => onChange(snapshot.docs.map(document => document.id)),
    onError,
  );
}

export async function setFavorite(
  uid: string,
  listingId: string,
  favorite: boolean,
): Promise<void> {
  const reference = doc(favoritesCollection(uid), listingId);
  if (favorite) {
    await setDoc(reference, { listingId });
  } else {
    await deleteDoc(reference);
  }
}

// Charge les favoris un par un. Ignore les annonces supprimées, masquées ou
// non accessibles, sans faire échouer toute la liste. Les annonces de
// démonstration (en mémoire) sont ajoutées à la fin, comme dans Flutter.
export async function fetchListingsByIds(ids: string[]): Promise<Listing[]> {
  const demos = ids
    .map(demoById)
    .filter((listing): listing is Listing => listing !== null);
  const realIds = ids.filter(id => demoById(id) === null);
  const loaded = await Promise.all(
    realIds.map(async id => {
      try {
        const snapshot = await getDoc(
          doc(getFirestore(), LISTINGS_COLLECTION, id),
        );
        return snapshot.exists() ? toListing(snapshot.id, snapshot.data()) : null;
      } catch {
        return null;
      }
    }),
  );
  const real = loaded.filter(
    (listing): listing is Listing =>
      listing !== null && listing.statut === 'active',
  );
  return [...real, ...demos];
}
