import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';
import {
  FavoriteButton,
  GuestGate,
  ListingCard,
  StatusMessage,
  useAppNavigation,
} from '../../core/components';
import { colors, spacing } from '../../core/theme';
import { fetchListingsByIds } from '../../data/listingService';
import { useAuthStore } from '../auth/authStore';
import type { Listing } from '../listings/listingModel';
import { useFavoritesStore } from './favoritesStore';

// Favoris de l'utilisateur (favorites_screen.dart). Stockés dans
// favorites/{uid}/user_favorites/{listingId}, donc partagés avec Flutter.
export default function FavoritesScreen() {
  const uid = useAuthStore(state => state.uid);
  if (!uid) {
    return (
      <GuestGate
        title="Favoris"
        message="Connectez-vous pour retrouver vos annonces favorites."
      />
    );
  }
  return <FavoriteList />;
}

function FavoriteList() {
  const navigation = useAppNavigation();
  const ids = useFavoritesStore(state => state.favorites);
  const initializing = useFavoritesStore(state => state.initializing);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState(false);

  // Recharge uniquement quand l'ensemble d'identifiants change.
  const idsKey = ids.join(',');

  useEffect(() => {
    if (idsKey.length === 0) {
      setListings([]);
      setError(false);
      return undefined;
    }
    let active = true;
    setError(false);
    fetchListingsByIds(idsKey.split(','))
      .then(result => active && setListings(result))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [idsKey]);

  const browse = () => navigation.navigate('Tabs', { screen: 'Accueil' });

  if (error) {
    return <StatusMessage title="Impossible de charger vos favoris." />;
  }
  if (initializing || listings === null) {
    return <ActivityIndicator style={styles.loader} color={colors.primary} />;
  }
  if (ids.length === 0) {
    return (
      <StatusMessage
        title="Aucun favori pour le moment"
        message="Appuyez sur le cœur d’une annonce pour la retrouver ici."
        actionLabel="Découvrir les annonces"
        onAction={browse}
      />
    );
  }
  if (listings.length === 0) {
    return (
      <StatusMessage
        title="Ces annonces ne sont plus disponibles"
        message="Elles ont été supprimées, vendues ou masquées."
        actionLabel="Découvrir les annonces"
        onAction={browse}
      />
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={listings}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <ListingCard
          listing={item}
          onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
          trailing={<FavoriteButton listingId={item.id} />}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screen },
  loader: { marginTop: spacing.lg },
  list: { padding: spacing.md, paddingBottom: spacing.lg },
});
