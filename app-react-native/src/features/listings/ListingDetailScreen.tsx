import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FavoriteButton, ListingPhoto, StatusMessage } from '../../core/components';
import {
  formatDate,
  formatPrice,
  toDate,
  transactionLabel,
  typeBienLabel,
} from '../../core/format';
import OsmMap from '../../core/OsmMap';
import { PrimaryButton } from '../../core/ui';
import { colors, spacing } from '../../core/theme';
import { getListing, watchListing } from '../../data/listingService';
import { openConversation } from '../../data/messagingService';
import { useAuthStore } from '../auth/authStore';
import type { AppStackParamList } from './navigationTypes';
import { hasLocation, isDemoListing } from './listingModel';
import type { Listing } from './listingModel';

type Props = NativeStackScreenProps<AppStackParamList, 'ListingDetail'>;

export default function ListingDetailScreen({ route, navigation }: Props) {
  const uid = useAuthStore(state => state.uid);
  const { listingId } = route.params;
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacting, setContacting] = useState(false);

  useEffect(() => {
    let active = true;
    let stop: () => void = () => {};
    getListing(listingId)
      .then(result => {
        if (!active) {
          return;
        }
        setListing(result);
        // Suit l'annonce en temps réel pour refléter une modification sans
        // quitter la fiche (les annonces de démonstration restent figées).
        if (result && !isDemoListing(result)) {
          stop = watchListing(listingId, updated => {
            if (active) {
              setListing(updated);
            }
          });
        }
      })
      .catch(() => {
        if (active) {
          setError("Impossible de charger le détail de l'annonce.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
      stop();
    };
  }, [listingId]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => <FavoriteButton listingId={listingId} />,
    });
  }, [navigation, listingId]);

  if (loading) {
    return <ActivityIndicator style={styles.center} color={colors.primary} />;
  }
  if (error || !listing) {
    return (
      <StatusMessage
        title={error ?? 'Cette annonce est introuvable ou n’est plus disponible.'}
      />
    );
  }

  const isOwner = uid !== null && uid === listing.proprietaireId;
  const isDemo = isDemoListing(listing);
  const address = [listing.ville, listing.adresse]
    .filter(part => part.length > 0)
    .join(' · ');
  const created = toDate(listing.dateCreation);

  const share = () => {
    Share.share({
      message: `${listing.titre}\n${formatPrice(listing.prix)} • ${listing.ville}`,
    }).catch(() => {});
  };

  const contact = async () => {
    if (isDemo) {
      Alert.alert(
        'Annonce de démonstration',
        'Ceci est une annonce de démonstration. Publiez une vraie annonce pour être contacté.',
      );
      return;
    }
    if (!uid) {
      Alert.alert(
        'Connexion requise',
        'Connectez-vous pour contacter le propriétaire.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => navigation.navigate('Login') },
        ],
      );
      return;
    }
    setContacting(true);
    try {
      const conversationId = await openConversation({
        listingId: listing.id,
        titreAnnonce: listing.titre,
        ownerUid: listing.proprietaireId,
        buyerUid: uid,
      });
      navigation.navigate('Chat', { conversationId });
    } catch {
      Alert.alert('Conversation impossible', 'Vérifiez votre connexion et réessayez.');
    } finally {
      setContacting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={[0]}
        keyExtractor={() => 'detail'}
        renderItem={() => (
          <View>
            <Gallery photos={listing.photos} />
            <View style={styles.body}>
              {isDemo ? (
                <View style={styles.demoNote}>
                  <Text style={styles.demoNoteText}>
                    Annonce de démonstration : ce bien est fictif et présenté à
                    titre d’illustration.
                  </Text>
                </View>
              ) : null}
              <Text style={styles.price}>{formatPrice(listing.prix)}</Text>
              <Text style={styles.title}>{listing.titre}</Text>
              <View style={styles.facts}>
                <Fact label={transactionLabel(listing.typeTransaction)} />
                <Fact label={typeBienLabel(listing.typeBien)} />
                <Fact label={`${listing.surface} m²`} />
                <Fact label={`${listing.nombrePieces} pièce(s)`} />
              </View>

              <Text style={styles.sectionTitle}>Localisation</Text>
              <Text style={styles.text}>
                {address.length === 0 ? 'Adresse non précisée' : address}
              </Text>
              {hasLocation(listing) ? (
                <View style={styles.map}>
                  <OsmMap
                    center={{
                      latitude: listing.latitude as number,
                      longitude: listing.longitude as number,
                    }}
                    zoom={14}
                    interactive={false}
                    markers={[
                      {
                        id: listing.id,
                        latitude: listing.latitude as number,
                        longitude: listing.longitude as number,
                      },
                    ]}
                  />
                </View>
              ) : (
                <Text style={styles.muted}>
                  L’annonceur n’a pas indiqué de position sur la carte.
                </Text>
              )}

              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>
                {listing.description.length === 0
                  ? 'Aucune description.'
                  : listing.description}
              </Text>
              {created ? (
                <Text style={styles.muted}>Publiée le {formatDate(created)}</Text>
              ) : null}
            </View>
          </View>
        )}
      />

      <View style={styles.bar}>
        {isOwner ? (
          <View style={styles.flex}>
            <PrimaryButton
              title="Modifier l’annonce"
              onPress={() => navigation.navigate('EditListing', { listingId })}
            />
          </View>
        ) : (
          <>
            <View style={styles.flex}>
              <PrimaryButton
                title="Contacter le propriétaire"
                onPress={contact}
                loading={contacting}
              />
            </View>
            <View style={styles.shareWrap}>
              <PrimaryButton title="Partager" onPress={share} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function Gallery({ photos }: { photos: string[] }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  if (photos.length === 0) {
    return <ListingPhoto url="" height={260} />;
  }
  return (
    <View>
      <FlatList
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={photos}
        keyExtractor={(url, i) => `${i}-${url}`}
        onMomentumScrollEnd={event =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item }) => (
          <ListingPhoto url={item} height={260} width={width} />
        )}
      />
      <View style={styles.counter}>
        <Text style={styles.counterText}>
          {index + 1} / {photos.length}
        </Text>
      </View>
    </View>
  );
}

function Fact({ label }: { label: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.sm },
  demoNote: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.primaryTint,
    marginBottom: spacing.sm,
  },
  demoNoteText: { color: colors.primary, fontSize: 13 },
  price: { color: colors.primary, fontSize: 24, fontWeight: '800' },
  title: { color: colors.text, fontSize: 20, fontWeight: '600' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.sm },
  fact: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.screen,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  factText: { color: colors.text, fontSize: 13 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: spacing.md },
  text: { color: colors.text },
  muted: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.sm },
  map: { height: 200, borderRadius: 16, overflow: 'hidden', marginTop: spacing.sm },
  description: { color: colors.text, lineHeight: 24 },
  counter: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: { color: colors.background },
  bar: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  shareWrap: { width: 110 },
});
