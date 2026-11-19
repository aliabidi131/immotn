import { create } from 'zustand';
import { getCurrentUid } from '../../data/authService';
import { setFavorite, watchFavoriteIds } from '../../data/listingService';

// Favoris de l'utilisateur connecté : favorites/{uid}/user_favorites/{listingId}
// (même structure que l'application Flutter, donc synchronisés entre les deux).

interface FavoritesState {
  favorites: string[];
  initializing: boolean;
  // Démarre l'écoute temps réel pour l'utilisateur connecté ; renvoie la
  // fonction d'arrêt. Sans utilisateur, vide la liste.
  loadFavorites: () => () => void;
  // Ajoute ou retire un favori (l'appelant s'assure que l'utilisateur est connecté).
  toggleFavorite: (listingId: string) => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  initializing: true,

  loadFavorites: () => {
    const uid = getCurrentUid();
    if (!uid) {
      set({ favorites: [], initializing: false });
      return () => {};
    }
    set({ initializing: true });
    return watchFavoriteIds(
      uid,
      ids => set({ favorites: ids, initializing: false }),
      () => set({ initializing: false }),
    );
  },

  toggleFavorite: async listingId => {
    const uid = getCurrentUid();
    if (!uid) {
      return;
    }
    const isFavorite = get().favorites.includes(listingId);
    await setFavorite(uid, listingId, !isFavorite);
  },
}));
