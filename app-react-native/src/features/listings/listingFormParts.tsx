import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { colors, spacing } from '../../core/theme';
import { getDevicePosition } from '../../data/locationService';
import { MAX_PHOTOS, TYPE_BIEN_OPTIONS } from './listingModel';
import type { TransactionType } from './listingModel';

// Éléments de formulaire partagés par la publication et la modification
// d'annonce (publish_listing_screen.dart / edit_listing_screen.dart Flutter).

const TYPE_ICONS: Record<string, string> = {
  appartement: '🏢',
  maison: '🏠',
  villa: '🏡',
  terrain: '🌍',
  local: '🏪',
};

export function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

export function HintText({ text }: { text: string }) {
  return <Text style={styles.hint}>{text}</Text>;
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

// ----------------------------------------------------------- Type de bien

export function TypeTiles({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.tiles}>
      {TYPE_BIEN_OPTIONS.map(option => {
        const selected = value === option.key;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.key)}
            style={[styles.tile, selected && styles.tileSelected]}>
            <Text style={styles.tileIcon}>{TYPE_ICONS[option.key] ?? '🏠'}</Text>
            <Text style={[styles.tileText, selected && styles.tileTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// -------------------------------------------------------------- Transaction

export function TransactionSwitch({
  value,
  onChange,
  disabled = false,
}: {
  value: TransactionType;
  onChange: (value: TransactionType) => void;
  disabled?: boolean;
}) {
  const options: { key: TransactionType; label: string }[] = [
    { key: 'vente', label: 'Vente' },
    { key: 'location', label: 'Location' },
  ];
  return (
    <View style={styles.segmented}>
      {options.map(option => {
        const selected = value === option.key;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.key)}
            style={[styles.segment, selected && styles.segmentSelected]}>
            <Text
              style={[styles.segmentText, selected && styles.segmentTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ----------------------------------------------------------------- Position

export interface PositionState {
  latitude: number | null;
  longitude: number | null;
  locating: boolean;
  // Lance la détection ; renvoie un message d'erreur ou null si réussie.
  locate: () => Promise<string | null>;
  clear: () => void;
}

// Position de l'annonce : jamais inventée, uniquement celle de l'appareil
// (« Utiliser ma position actuelle » côté Flutter).
export function usePosition(
  initialLatitude: number | null = null,
  initialLongitude: number | null = null,
): PositionState {
  const [latitude, setLatitude] = useState<number | null>(initialLatitude);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude);
  const [locating, setLocating] = useState(false);

  const locate = useCallback(async () => {
    setLocating(true);
    try {
      const position = await getDevicePosition();
      setLatitude(position.latitude);
      setLongitude(position.longitude);
      return null;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return `Position impossible : ${reason}`;
    } finally {
      setLocating(false);
    }
  }, []);

  const clear = useCallback(() => {
    setLatitude(null);
    setLongitude(null);
  }, []);

  return { latitude, longitude, locating, locate, clear };
}

export function PositionField({
  position,
  disabled = false,
  allowClear = false,
  editing = false,
  onError,
}: {
  position: PositionState;
  disabled?: boolean;
  allowClear?: boolean;
  // Mode modification : « Position : lat, lng (mettre à jour) ».
  editing?: boolean;
  onError: (message: string | null) => void;
}) {
  const { latitude, longitude, locating } = position;
  const hasPosition = latitude !== null && longitude !== null;
  let label = 'Utiliser ma position actuelle';
  if (hasPosition) {
    const coordinates = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    label = editing
      ? `Position : ${coordinates} (mettre à jour)`
      : `Position enregistrée : ${coordinates}`;
  }

  const locate = async () => {
    onError(null);
    const error = await position.locate();
    if (error) {
      onError(error);
    }
  };

  return (
    <View style={styles.position}>
      <Pressable
        accessibilityRole="button"
        disabled={locating || disabled}
        onPress={locate}
        style={[styles.outlined, (locating || disabled) && styles.dimmed]}>
        {locating ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.outlinedText}>📍 {label}</Text>
        )}
      </Pressable>
      {allowClear && hasPosition ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={position.clear}>
          <Text style={styles.clearText}>Retirer la position de la carte</Text>
        </Pressable>
      ) : null}
      <HintText
        text={
          hasPosition
            ? 'Le bien apparaît sur la carte à cet emplacement.'
            : 'Sans position, le bien n’apparaît pas sur la carte.'
        }
      />
    </View>
  );
}

// ------------------------------------------------------------------- Photos

export interface PhotoTile {
  key: string;
  uri: string;
}

// Grille de photos 3 colonnes : la première est la couverture. Le bouton
// « Ajouter » disparaît à 8 photos (règle Firestore : photos.size() <= 8).
export function PhotoGrid({
  items,
  onAdd,
  onRemove,
  disabled = false,
}: {
  items: PhotoTile[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  const { width } = useWindowDimensions();
  const gap = 10;
  const size = Math.floor((width - spacing.lg * 2 - gap * 2) / 3);
  const canAdd = items.length < MAX_PHOTOS;

  return (
    <View style={styles.grid}>
      {items.map((item, index) => (
        <View key={item.key} style={{ width: size, height: size }}>
          <Image source={{ uri: item.uri }} style={styles.photo} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retirer la photo"
            disabled={disabled}
            hitSlop={6}
            onPress={() => onRemove(index)}
            style={styles.remove}>
            <Text style={styles.removeText}>✕</Text>
          </Pressable>
          {index === 0 ? (
            <View style={styles.cover}>
              <Text style={styles.coverText}>Couverture</Text>
            </View>
          ) : null}
        </View>
      ))}
      {canAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajouter des photos"
          disabled={disabled}
          onPress={onAdd}
          style={[styles.add, { width: size, height: size }]}>
          <Text style={styles.addIcon}>📷</Text>
          <Text style={styles.addText}>Ajouter</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  hint: { color: colors.muted, fontSize: 12 },
  banner: {
    backgroundColor: colors.errorLight,
    borderRadius: 14,
    padding: 12,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  bannerText: { color: colors.error },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: 76,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  tileSelected: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  tileIcon: { fontSize: 22 },
  tileText: { fontSize: 11, textAlign: 'center', marginTop: 6, color: colors.text },
  tileTextSelected: { color: colors.primary, fontWeight: '700' },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: 'hidden',
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  segmentSelected: { backgroundColor: colors.primaryTint },
  segmentText: { color: colors.text },
  segmentTextSelected: { color: colors.primary, fontWeight: '700' },
  position: { gap: spacing.sm },
  outlined: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  outlinedText: { color: colors.primary, fontWeight: '600' },
  dimmed: { opacity: 0.6 },
  clearText: { color: colors.primary, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { flex: 1, borderRadius: 16, backgroundColor: colors.primaryTint },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: colors.background, fontSize: 12 },
  cover: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  coverText: { color: colors.background, fontSize: 11 },
  add: {
    borderRadius: 16,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: { fontSize: 22 },
  addText: { color: colors.primary, fontWeight: '600', marginTop: 4 },
});
