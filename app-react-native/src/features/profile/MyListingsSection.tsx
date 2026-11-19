import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ListingPhoto, useAppNavigation } from '../../core/components';
import { STATUT_LABELS, formatPrice } from '../../core/format';
import { colors, spacing } from '../../core/theme';
import {
  deleteListing,
  updateStatus,
  watchMyListings,
} from '../../data/listingService';
import { coverPhoto } from '../listings/listingModel';
import type { Listing } from '../listings/listingModel';
import { ACTION_LABELS, availableActions } from './myListingsModel';
import type { ListingAction } from './myListingsModel';

// « Mes annonces » du profil (_MyListings Flutter) : toutes les annonces de
// l'utilisateur, quel que soit leur statut, avec modification, changement de
// statut et suppression.
export default function MyListingsSection({ uid }: { uid: string }) {
  const navigation = useAppNavigation();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState(false);
  const [menuFor, setMenuFor] = useState<Listing | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setError(false);
    return watchMyListings(uid, setListings, () => setError(true));
  }, [uid]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const run = async (listing: Listing, action: ListingAction) => {
    setMenuFor(null);
    if (action === 'edit') {
      navigation.navigate('EditListing', { listingId: listing.id });
      return;
    }
    if (action === 'delete') {
      Alert.alert('Supprimer l’annonce ?', 'Cette action est définitive.', [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteListing(listing);
              setNotice('Annonce supprimée.');
            } catch (failure) {
              setNotice(`Action impossible : ${messageOf(failure)}`);
            }
          },
        },
      ]);
      return;
    }
    try {
      await updateStatus(listing.id, action);
      setNotice('Annonce mise à jour.');
    } catch (failure) {
      setNotice(`Action impossible : ${messageOf(failure)}`);
    }
  };

  let body: React.ReactNode;
  if (error) {
    body = <Text style={styles.muted}>Impossible de charger vos annonces.</Text>;
  } else if (listings === null) {
    body = <ActivityIndicator color={colors.primary} />;
  } else if (listings.length === 0) {
    body = (
      <View style={styles.empty}>
        <Text style={styles.muted}>
          Vous n’avez pas encore publié d’annonce. Utilisez l’onglet Publier
          pour commencer.
        </Text>
      </View>
    );
  } else {
    body = (
      <View style={styles.list}>
        {listings.map(listing => (
          <View key={listing.id} style={styles.row}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate('ListingDetail', { listingId: listing.id })
              }
              style={styles.rowMain}>
              <View style={styles.thumb}>
                <ListingPhoto url={coverPhoto(listing)} height={64} width={64} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.title} numberOfLines={1}>
                  {listing.titre}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {formatPrice(listing.prix)} ·{' '}
                  {STATUT_LABELS[listing.statut] ?? listing.statut}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Actions"
              hitSlop={8}
              onPress={() => setMenuFor(listing)}
              style={styles.menuButton}>
              <Text style={styles.menuIcon}>⋮</Text>
            </Pressable>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Mes annonces</Text>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {body}

      <Modal
        visible={menuFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuFor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuFor(null)}>
          <View style={styles.sheet}>
            {menuFor
              ? availableActions(menuFor.statut).map(action => (
                  <Pressable
                    key={action}
                    accessibilityRole="button"
                    onPress={() => run(menuFor, action)}
                    style={styles.sheetItem}>
                    <Text
                      style={[
                        styles.sheetText,
                        action === 'delete' && styles.sheetDanger,
                      ]}>
                      {ACTION_LABELS[action]}
                    </Text>
                  </Pressable>
                ))
              : null}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  heading: { color: colors.text, fontSize: 17, fontWeight: '700' },
  notice: { color: colors.success, fontSize: 13 },
  muted: { color: colors.textSecondary },
  empty: {
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    padding: 8,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 8, overflow: 'hidden' },
  rowText: { flex: 1 },
  title: { color: colors.text, fontWeight: '600', fontSize: 15 },
  sub: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  menuButton: { paddingHorizontal: 12, paddingVertical: 8 },
  menuIcon: { color: colors.textSecondary, fontSize: 22 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: spacing.sm,
  },
  sheetItem: { paddingVertical: 16, paddingHorizontal: spacing.lg },
  sheetText: { color: colors.text, fontSize: 16 },
  sheetDanger: { color: colors.error },
});
