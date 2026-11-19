
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  FavoriteButton,
  ListingCard,
  StatusMessage,
} from '../../core/components';
import { colors, spacing } from '../../core/theme';
import { demoFallbackFor } from '../../data/demoData';
import { watchActiveListings } from '../../data/listingService';
import type { Listing } from './listingModel';
import type { AppStackParamList } from './navigationTypes';

type Props = NativeStackScreenProps<AppStackParamList, 'AllListings'>;

// Page « Toutes les annonces » (AllListingsScreen Flutter) : annonces actives
// en temps réel, plus les annonces de démonstration si la base n'en contient pas.
export default function AllListingsScreen({ navigation }: Props) {
  const [real, setReal] = useState<Listing[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    return watchActiveListings(setReal, () => setError(true));
  }, []);

  const listings = useMemo(
    () => (real === null ? [] : [...real, ...demoFallbackFor(real)]),
    [real],
  );

  if (error) {
    return <StatusMessage title="Impossible de charger les annonces." />;
  }

  if (real === null) {
    return <ActivityIndicator style={styles.loader} color={colors.primary} />;
  }

  if (listings.length === 0) {
    return (
      <StatusMessage
        title="Aucune annonce pour le moment"
        message="Les nouvelles annonces apparaîtront ici dès leur publication."
      />
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={listings}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Text style={styles.count}>{listings.length} annonce(s)</Text>
      }
      renderItem={({ item }) => (
        <ListingCard
          listing={item}
          onPress={() =>
            navigation.navigate('ListingDetail', { listingId: item.id })
          }
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
  count: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm + 4,
  },
});
