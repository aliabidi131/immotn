import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SAVE_TIMEOUT_MS, isTimeoutError, withTimeout } from '../../core/async';
import { GuestGate, StatusMessage } from '../../core/components';
import { TYPE_BIEN_LABELS } from '../../core/format';
import { colors, spacing } from '../../core/theme';
import { FormInput, PrimaryButton } from '../../core/ui';
import { isImageServiceError } from '../../data/imageService';
import { getListing, updateListing } from '../../data/listingService';
import { pickPhotos } from '../../data/photoPicker';
import type { PickedPhoto } from '../../data/photoPicker';
import { useAuthStore } from '../auth/authStore';
import {
  ErrorBanner,
  HintText,
  PhotoGrid,
  PositionField,
  SectionLabel,
  TransactionSwitch,
  TypeTiles,
  usePosition,
} from './listingFormParts';
import {
  MAX_PHOTOS,
  buildListingData,
  hasLocation,
  validateListingDraft,
} from './listingModel';
import type { Listing, ListingDraft } from './listingModel';
import type { AppStackParamList } from './navigationTypes';

type Props = NativeStackScreenProps<AppStackParamList, 'EditListing'>;

const TIMEOUT_MESSAGE =
  'Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.';

function describeError(error: unknown): string {
  if (isTimeoutError(error)) {
    return TIMEOUT_MESSAGE;
  }
  if (isImageServiceError(error)) {
    return `Erreur image : ${error.message}`;
  }
  const reason = error instanceof Error ? error.message : String(error);
  return `Modification impossible : ${reason}`;
}

// Modification d'une annonce existante (edit_listing_screen.dart). Réservé au
// propriétaire : les règles Firestore refusent aussi toute autre modification.
export default function EditListingScreen({ route, navigation }: Props) {
  const uid = useAuthStore(state => state.uid);
  const { listingId } = route.params;
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getListing(listingId)
      .then(result => active && setListing(result))
      .catch(() => active && setFailed(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [listingId]);

  if (!uid) {
    return (
      <GuestGate
        title="Modifier l’annonce"
        message="Connectez-vous pour modifier votre annonce."
      />
    );
  }
  if (loading) {
    return <ActivityIndicator style={styles.loader} color={colors.primary} />;
  }
  if (failed || !listing) {
    return (
      <StatusMessage title="Cette annonce est introuvable ou n’est plus disponible." />
    );
  }
  if (listing.proprietaireId !== uid) {
    return <StatusMessage title="Vous n’êtes pas propriétaire de cette annonce." />;
  }
  return <EditForm listing={listing} onDone={() => navigation.goBack()} />;
}

function EditForm({
  listing,
  onDone,
}: {
  listing: Listing;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<ListingDraft>({
    titre: listing.titre,
    description: listing.description,
    typeTransaction: listing.typeTransaction,
    typeBien: listing.typeBien in TYPE_BIEN_LABELS ? listing.typeBien : 'appartement',
    prix: String(listing.prix),
    surface: String(listing.surface),
    nombrePieces: String(listing.nombrePieces),
    ville: listing.ville,
    adresse: listing.adresse,
  });
  const [existingPhotos, setExistingPhotos] = useState<string[]>(listing.photos);
  const [newPhotos, setNewPhotos] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [saving, setSaving] = useState(false);
  const position = usePosition(listing.latitude ?? null, listing.longitude ?? null);

  const change = <K extends keyof ListingDraft>(
    key: K,
    value: ListingDraft[K],
  ) => setDraft(current => ({ ...current, [key]: value }));

  const photoCount = existingPhotos.length + newPhotos.length;

  const addPhotos = async () => {
    const remaining = MAX_PHOTOS - photoCount;
    if (remaining <= 0) {
      return;
    }
    try {
      const picked = await pickPhotos(remaining);
      if (picked.length > 0) {
        setNewPhotos(current => [...current, ...picked]);
        setError(null);
      }
    } catch {
      setError('Impossible de charger les photos.');
    }
  };

  const removePhoto = (index: number) => {
    if (index < existingPhotos.length) {
      setExistingPhotos(current => current.filter((_, i) => i !== index));
    } else {
      const newIndex = index - existingPhotos.length;
      setNewPhotos(current => current.filter((_, i) => i !== newIndex));
    }
  };

  const save = async () => {
    if (saving) {
      return;
    }
    const full: ListingDraft = {
      ...draft,
      latitude: position.latitude,
      longitude: position.longitude,
    };
    const problem = validateListingDraft(full);
    if (problem) {
      setError(problem);
      return;
    }
    if (photoCount === 0) {
      setError('Gardez au moins une photo du bien.');
      return;
    }
    const keepsPosition = position.latitude !== null && position.longitude !== null;
    setSaving(true);
    setError(null);
    setProgress('Enregistrement de l’annonce…');
    try {
      await withTimeout(
        updateListing(
          listing,
          buildListingData(full, 'update'),
          existingPhotos,
          newPhotos.map(photo => ({
            base64: photo.base64,
            contentType: photo.contentType,
          })),
          !keepsPosition && hasLocation(listing),
          (done, total) =>
            setProgress(
              done < total
                ? `Envoi des photos ${done}/${total}…`
                : 'Enregistrement de l’annonce…',
            ),
        ),
        SAVE_TIMEOUT_MS,
      );
      Alert.alert('Annonce modifiée', 'Annonce modifiée avec succès.');
      onDone();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setSaving(false);
      setProgress('');
    }
  };

  const tiles = [
    ...existingPhotos.map(url => ({ key: `e-${url}`, uri: url })),
    ...newPhotos.map((photo, index) => ({
      key: `n-${index}-${photo.uri}`,
      uri: photo.uri,
    })),
  ];

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.group}>
          <SectionLabel text="Type de bien" />
          <TypeTiles
            value={draft.typeBien}
            onChange={value => change('typeBien', value)}
            disabled={saving}
          />
          <SectionLabel text="Transaction" />
          <TransactionSwitch
            value={draft.typeTransaction}
            onChange={value => change('typeTransaction', value)}
            disabled={saving}
          />
          <SectionLabel text="Prix (TND)" />
          <FormInput
            placeholder="Prix (TND)"
            keyboardType="decimal-pad"
            value={draft.prix}
            onChangeText={value => change('prix', value)}
            editable={!saving}
          />
          <SectionLabel text="Titre de l’annonce" />
          <FormInput
            placeholder="Titre"
            autoCapitalize="sentences"
            maxLength={100}
            value={draft.titre}
            onChangeText={value => change('titre', value)}
            editable={!saving}
          />
          <SectionLabel text="Description" />
          <FormInput
            placeholder="Description"
            autoCapitalize="sentences"
            multiline
            maxLength={2000}
            value={draft.description}
            onChangeText={value => change('description', value)}
            editable={!saving}
            style={styles.multiline}
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <FormInput
                placeholder="Surface (m²)"
                keyboardType="decimal-pad"
                value={draft.surface}
                onChangeText={value => change('surface', value)}
                editable={!saving}
              />
            </View>
            <View style={styles.half}>
              <FormInput
                placeholder="Pièces"
                keyboardType="number-pad"
                value={draft.nombrePieces}
                onChangeText={value => change('nombrePieces', value)}
                editable={!saving}
              />
            </View>
          </View>
          <SectionLabel text="Localisation" />
          <FormInput
            placeholder="Ville"
            autoCapitalize="words"
            value={draft.ville}
            onChangeText={value => change('ville', value)}
            editable={!saving}
          />
          <FormInput
            placeholder="Adresse (facultatif)"
            autoCapitalize="words"
            value={draft.adresse ?? ''}
            onChangeText={value => change('adresse', value)}
            editable={!saving}
          />
          <PositionField
            position={position}
            disabled={saving}
            allowClear
            editing
            onError={setError}
          />
          <SectionLabel text={`Photos du bien (${photoCount}/${MAX_PHOTOS})`} />
          <HintText text="La première photo est la couverture de l’annonce." />
          <PhotoGrid
            items={tiles}
            onAdd={addPhotos}
            onRemove={removePhoto}
            disabled={saving}
          />
        </View>
      </ScrollView>

      <ErrorBanner message={error} />
      <View style={styles.bottom}>
        {saving && progress.length > 0 ? (
          <Text style={styles.progress}>{progress}</Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={onDone}
            style={styles.cancel}>
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
          <View style={styles.primary}>
            <PrimaryButton
              title="Enregistrer les modifications"
              onPress={save}
              loading={saving}
            />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screen },
  loader: { marginTop: spacing.lg },
  content: { padding: spacing.lg, paddingBottom: spacing.md },
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  bottom: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  progress: { color: colors.textSecondary, fontSize: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cancel: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  cancelText: { color: colors.primary, fontWeight: '600' },
  primary: { flex: 1 },
});
