import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ListingPhoto, StatusMessage, useAppNavigation } from '../../core/components';
import { formatPrice, typeBienLabel } from '../../core/format';
import { centroid } from '../../core/geo';
import type { Coordinates } from '../../core/geo';
import OsmMap from '../../core/OsmMap';
import type { MapView } from '../../core/OsmMap';
import { colors, spacing } from '../../core/theme';
import { demoFallbackFor } from '../../data/demoData';
import { watchActiveListings } from '../../data/listingService';
import { getDevicePosition } from '../../data/locationService';
import {
  coverPhoto,
  isDemoListing,
} from '../listings/listingModel';
import type { Listing } from '../listings/listingModel';
import {
  MAP_INITIAL_ZOOM,
  MAP_LOCATED_ZOOM,
  NEAR_ME_RADIUS_KM,
  locatedListings,
  mapCountText,
  visibleOnMap,
} from './mapModel';

// Carte des annonces actives (map_screen.dart). Seules les annonces ayant une
// position réelle sont affichées.
export default function MapScreen() {
  const navigation = useAppNavigation();
  const [real, setReal] = useState<Listing[] | null>(null);
  const [error, setError] = useState(false);
  const [view, setView] = useState<MapView | null>(null);
  const [devicePosition, setDevicePosition] = useState<Coordinates | null>(null);
  const [radiusKm, setRadiusKm] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setError(false);
    return watchActiveListings(setReal, () => setError(true));
  }, []);

  const all = useMemo(
    () => (real === null ? [] : [...real, ...demoFallbackFor(real)]),
    [real],
  );
  const located = useMemo(() => locatedListings(all), [all]);
  const visible = useMemo(
    () => visibleOnMap(located, devicePosition, radiusKm),
    [located, devicePosition, radiusKm],
  );
  const selected = visible.find(listing => listing.id === selectedId) ?? null;

  // Centre initial : position de l'appareil, sinon centre des annonces
  // (centre de la Tunisie si aucune), une fois les annonces chargées.
  useEffect(() => {
    if (real !== null && view === null) {
      const center =
        devicePosition ??
        centroid(
          located.map(listing => ({
            latitude: listing.latitude as number,
            longitude: listing.longitude as number,
          })),
        );
      setView({ center, zoom: MAP_INITIAL_ZOOM });
    }
  }, [real, view, devicePosition, located]);

  const toggleNearMe = async () => {
    if (radiusKm > 0) {
      setRadiusKm(0);
      return;
    }
    setLocating(true);
    setLocationError(null);
    try {
      const position = await getDevicePosition();
      setDevicePosition(position);
      setView({ center: position, zoom: MAP_LOCATED_ZOOM });
      setRadiusKm(NEAR_ME_RADIUS_KM);
    } catch (failure) {
      setLocationError(
        failure instanceof Error ? `Erreur GPS : ${failure.message}` : 'Erreur GPS.',
      );
    } finally {
      setLocating(false);
    }
  };

  if (error) {
    return <StatusMessage title="Erreur lors du chargement des annonces." />;
  }
  if (real === null || view === null) {
    return <ActivityIndicator style={styles.loader} color={colors.primary} />;
  }

  return (
    <View style={styles.screen}>
      {locationError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{locationError}</Text>
        </View>
      ) : null}

      <View style={styles.map}>
        <OsmMap
          center={view.center}
          zoom={view.zoom}
          markers={visible.map(listing => ({
            id: listing.id,
            latitude: listing.latitude as number,
            longitude: listing.longitude as number,
          }))}
          userPosition={devicePosition}
          selectedId={selectedId}
          onViewChange={setView}
          onMarkerPress={setSelectedId}
          onMapPress={() => setSelectedId(null)}
        />
      </View>

      <View pointerEvents="none" style={styles.countWrap}>
        <View style={styles.count}>
          <Text style={styles.countText}>
            {mapCountText(located.length, all.length - located.length)}
          </Text>
        </View>
      </View>

      {selected ? (
        <SelectedSummary
          listing={selected}
          onClose={() => setSelectedId(null)}
          onOpen={() =>
            navigation.navigate('ListingDetail', { listingId: selected.id })
          }
        />
      ) : null}

      <View style={styles.fab}>
        {radiusKm > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Désactiver Autour de moi"
            onPress={() => setRadiusKm(0)}
            style={styles.chip}>
            <Text style={styles.chipText}>Autour de moi · {radiusKm} km ✕</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Autour de moi"
          disabled={locating}
          onPress={toggleNearMe}
          style={[styles.fabButton, locating && styles.dimmed]}>
          {locating ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.fabIcon}>🎯</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function SelectedSummary({
  listing,
  onClose,
  onOpen,
}: {
  listing: Listing;
  onClose: () => void;
  onOpen: () => void;
}) {
  return (
    <View style={styles.summary}>
      <ListingPhoto url={coverPhoto(listing)} height={110} width={110} />
      <View style={styles.summaryBody}>
        <Text style={styles.summaryTitle} numberOfLines={1}>
          {listing.titre}
        </Text>
        <Text style={styles.summaryPrice}>{formatPrice(listing.prix)}</Text>
        <Text style={styles.summaryMeta} numberOfLines={1}>
          {listing.ville} · {typeBienLabel(listing.typeBien)}
          {isDemoListing(listing) ? ' · Démo' : ''}
        </Text>
        <View style={styles.summaryActions}>
          <Pressable accessibilityRole="button" onPress={onOpen}>
            <Text style={styles.summaryLink}>Voir l’annonce</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={8}
            onPress={onClose}>
            <Text style={styles.summaryClose}>✕</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screen },
  loader: { marginTop: spacing.lg },
  map: { flex: 1 },
  errorBanner: { backgroundColor: colors.errorLight, padding: 12 },
  errorText: { color: colors.error },
  countWrap: { position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center' },
  count: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    elevation: 2,
  },
  countText: { color: colors.text, fontSize: 12 },
  fab: { position: 'absolute', right: 16, bottom: 16, alignItems: 'flex-end', gap: 8 },
  fabButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabIcon: { fontSize: 20 },
  dimmed: { opacity: 0.6 },
  chip: {
    backgroundColor: colors.primaryTint,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    elevation: 2,
  },
  chipText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  summary: {
    position: 'absolute',
    left: 16,
    right: 76,
    bottom: 16,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 4,
  },
  summaryBody: { flex: 1, padding: 12, gap: 2 },
  summaryTitle: { color: colors.text, fontWeight: '600', fontSize: 14 },
  summaryPrice: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  summaryMeta: { color: colors.textSecondary, fontSize: 12 },
  summaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  summaryLink: { color: colors.primary, fontWeight: '600' },
  summaryClose: { color: colors.muted, fontSize: 16 },
});
