import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { colors, spacing } from './theme';
import { formatPrice, transactionLabel, typeBienLabel } from './format';
import { PrimaryButton } from './ui';
import { useAuthStore } from '../features/auth/authStore';
import { useFavoritesStore } from '../features/favorites/favoritesStore';
import type { Listing } from '../features/listings/listingModel';
import type { AppStackParamList } from '../features/listings/navigationTypes';

// Composants partagés entre les écrans (équivalents de listing_widgets.dart et
// home_widgets.dart côté Flutter).

export function useAppNavigation() {
  return useNavigation<NavigationProp<AppStackParamList>>();
}

// ------------------------------------------------------------ États / invité

export function StatusMessage({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.status}>
      <Text style={styles.statusTitle}>{title}</Text>
      {message ? <Text style={styles.statusMessage}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.statusAction}>
          <PrimaryButton title={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

// Écran affiché à un visiteur sur les onglets qui exigent un compte (GuestScaffold).
export function GuestGate({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const navigation = useAppNavigation();
  return (
    <View style={styles.guest}>
      <Text style={styles.guestTitle}>{title}</Text>
      <Text style={styles.statusMessage}>{message}</Text>
      <View style={styles.statusAction}>
        <PrimaryButton
          title="Se connecter"
          onPress={() => navigation.navigate('Login')}
        />
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() => navigation.navigate('Register')}>
        <Text style={styles.guestLink}>Créer un compte</Text>
      </Pressable>
    </View>
  );
}

// ------------------------------------------------------------------ Avatar

export function Avatar({
  name,
  photoUrl,
  size = 40,
}: {
  name: string;
  photoUrl?: string;
  size?: number;
}) {
  const initial = name.trim().length === 0 ? '?' : name.trim()[0].toUpperCase();
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} style={box} />;
  }
  return (
    <View style={[styles.avatar, box]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>
        {initial}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------------- Photos

export function ListingPhoto({
  url,
  height,
  width,
}: {
  url: string;
  height: number;
  width?: number;
}) {
  const [failed, setFailed] = useState(false);
  const size = { height, width: width ?? ('100%' as const) };
  if (!url || failed) {
    return (
      <View style={[styles.photoPlaceholder, size]}>
        <Text style={styles.photoPlaceholderText}>Pas de photo</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: url }}
      style={size}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

// ------------------------------------------------------------------ Badges

export function TransactionBadge({ value }: { value: string }) {
  const isSale = value === 'vente';
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: isSale ? colors.primary : colors.accent },
      ]}>
      <Text style={styles.badgeText}>{transactionLabel(value)}</Text>
    </View>
  );
}

export function DemoBadge() {
  return (
    <View style={[styles.badge, { backgroundColor: colors.muted }]}>
      <Text style={styles.badgeText}>Démo</Text>
    </View>
  );
}

// ---------------------------------------------------------------- Favori

export function FavoriteButton({ listingId }: { listingId: string }) {
  const navigation = useAppNavigation();
  const uid = useAuthStore(state => state.uid);
  const isFavorite = useFavoritesStore(state =>
    state.favorites.includes(listingId),
  );
  const toggle = useFavoritesStore(state => state.toggleFavorite);

  const onPress = () => {
    if (!uid) {
      Alert.alert(
        'Connexion requise',
        'Connectez-vous pour enregistrer des favoris.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => navigation.navigate('Login') },
        ],
      );
      return;
    }
    toggle(listingId).catch(() =>
      Alert.alert('Action impossible', 'Le favori n’a pas pu être modifié.'),
    );
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'
      }
      hitSlop={8}
      onPress={onPress}
      style={styles.favorite}>
      <Text style={[styles.favoriteIcon, isFavorite && styles.favoriteOn]}>
        {isFavorite ? '♥' : '♡'}
      </Text>
    </Pressable>
  );
}

// ------------------------------------------------------------------ Cartes

// Carte horizontale compacte de la liste (ListingCompactCard Flutter).
export function ListingCard({
  listing,
  onPress,
  trailing,
}: {
  listing: Listing;
  onPress: () => void;
  trailing?: React.ReactNode;
}) {
  const isDemo = listing.proprietaireId === 'DEMO';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
      <View>
        <ListingPhoto url={listing.photos[0] ?? ''} height={170} />
        <View style={styles.cardBadges}>
          <TransactionBadge value={listing.typeTransaction} />
          {isDemo ? <DemoBadge /> : null}
        </View>
        {trailing ? <View style={styles.cardTrailing}>{trailing}</View> : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardPrice}>{formatPrice(listing.prix)}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {listing.titre}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {listing.ville} · {typeBienLabel(listing.typeBien)}
        </Text>
        <Text style={styles.cardMeta}>
          {listing.surface} m²
          {listing.nombrePieces > 0 ? ` · ${listing.nombrePieces} pièce(s)` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

// Carte étroite des sections horizontales (ListingFeaturedCard Flutter).
export function ListingFeaturedCard({
  listing,
  onPress,
}: {
  listing: Listing;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.featured}>
      <View>
        <ListingPhoto url={listing.photos[0] ?? ''} height={120} />
        <View style={styles.cardBadges}>
          <TransactionBadge value={listing.typeTransaction} />
        </View>
        <View style={styles.cardTrailing}>
          <FavoriteButton listingId={listing.id} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardPrice}>{formatPrice(listing.prix)}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {listing.titre}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {listing.ville}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  status: { alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
  statusTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  statusMessage: { color: colors.textSecondary, textAlign: 'center' },
  statusAction: { alignSelf: 'stretch', marginTop: spacing.sm },
  guest: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  guestTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  guestLink: {
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  avatar: {
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontWeight: '700' },
  photoPlaceholder: {
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: { color: colors.muted, fontSize: 12 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: { color: colors.background, fontSize: 11, fontWeight: '700' },
  favorite: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteIcon: { fontSize: 20, color: colors.muted },
  favoriteOn: { color: '#E53935' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  featured: {
    width: 220,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  cardBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    gap: 6,
  },
  cardTrailing: { position: 'absolute', top: 8, right: 8 },
  cardBody: { padding: spacing.md, gap: 2 },
  cardPrice: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  cardMeta: { color: colors.textSecondary, fontSize: 13 },
});
