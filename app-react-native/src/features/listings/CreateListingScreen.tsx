import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { SAVE_TIMEOUT_MS, isTimeoutError, withTimeout } from '../../core/async';
import { GuestGate } from '../../core/components';
import {
  formatPrice,
  transactionLabel,
  typeBienLabel,
} from '../../core/format';
import { colors, spacing } from '../../core/theme';
import { FormInput, PrimaryButton } from '../../core/ui';
import { isImageServiceError } from '../../data/imageService';
import { createListing } from '../../data/listingService';
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
  PUBLISH_STEP_LABELS,
  buildListingData,
  parseNumber,
  validatePublishStep,
} from './listingModel';
import type { ListingDraft } from './listingModel';
import type { HomeTabParamList } from './navigationTypes';

type Props = BottomTabScreenProps<HomeTabParamList, 'Publication'>;

const INITIAL_DRAFT: ListingDraft = {
  titre: '',
  description: '',
  typeTransaction: 'vente',
  typeBien: 'appartement',
  prix: '',
  surface: '',
  nombrePieces: '',
  ville: '',
  adresse: '',
};

const TIMEOUT_MESSAGE =
  'Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez. ' +
  'Si le problème continue, vérifiez que Firestore est activé et que ' +
  'l’Edge Function Supabase est déployée.';

function describeError(error: unknown): string {
  if (isTimeoutError(error)) {
    return TIMEOUT_MESSAGE;
  }
  if (isImageServiceError(error)) {
    return `Erreur image : ${error.message}`;
  }
  const reason = error instanceof Error ? error.message : String(error);
  return `Publication impossible : ${reason}`;
}

// Publication d'une annonce : trois étapes (Infos, Détails, Photos) avec
// récapitulatif avant publication, comme publish_listing_screen.dart.
export default function CreateListingScreen({ navigation }: Props) {
  const uid = useAuthStore(state => state.uid);
  if (!uid) {
    return (
      <GuestGate
        title="Publier une annonce"
        message="Connectez-vous pour publier une annonce."
      />
    );
  }
  return <PublishWizard uid={uid} onPublished={() => navigation.navigate('Accueil')} />;
}

function PublishWizard({
  uid,
  onPublished,
}: {
  uid: string;
  onPublished: () => void;
}) {
  const [draft, setDraft] = useState<ListingDraft>(INITIAL_DRAFT);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const position = usePosition();

  const change = <K extends keyof ListingDraft>(
    key: K,
    value: ListingDraft[K],
  ) => setDraft(current => ({ ...current, [key]: value }));

  const isLast = step === PUBLISH_STEP_LABELS.length - 1;

  const next = () => {
    const problem = validatePublishStep(step, draft, photos.length);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep(current => current + 1);
  };

  const back = () => {
    setError(null);
    setStep(current => Math.max(0, current - 1));
  };

  const addPhotos = async () => {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      return;
    }
    try {
      const picked = await pickPhotos(remaining);
      if (picked.length > 0) {
        setPhotos(current => [...current, ...picked].slice(0, MAX_PHOTOS));
        setError(null);
      }
    } catch {
      setError('Impossible de charger les photos.');
    }
  };

  const reset = () => {
    setDraft(INITIAL_DRAFT);
    setPhotos([]);
    setStep(0);
    setError(null);
    setProgress('');
    position.clear();
  };

  const submit = async () => {
    if (submitting) {
      return;
    }
    const full: ListingDraft = {
      ...draft,
      latitude: position.latitude,
      longitude: position.longitude,
    };
    // Revalide chaque étape : renvoie l'utilisateur sur celle à corriger.
    for (let index = 0; index < PUBLISH_STEP_LABELS.length; index++) {
      const problem = validatePublishStep(index, full, photos.length);
      if (problem) {
        setStep(index);
        setError(problem);
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    setProgress('Préparation de l’annonce…');
    try {
      await withTimeout(
        createListing(
          uid,
          buildListingData(full, 'create'),
          photos.map(photo => ({
            base64: photo.base64,
            contentType: photo.contentType,
          })),
          (done, total) =>
            setProgress(
              done < total
                ? `Envoi des photos ${done}/${total}…`
                : 'Enregistrement de l’annonce…',
            ),
        ),
        SAVE_TIMEOUT_MS,
      );
      reset();
      Alert.alert('Annonce publiée', 'Annonce publiée avec succès.');
      onPublished();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setSubmitting(false);
      setProgress('');
    }
  };

  const priceValue = parseNumber(draft.prix);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StepIndicator current={step} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <View style={styles.group}>
            <SectionLabel text="Type de bien" />
            <TypeTiles
              value={draft.typeBien}
              onChange={value => change('typeBien', value)}
            />
            <SectionLabel text="Transaction" />
            <TransactionSwitch
              value={draft.typeTransaction}
              onChange={value => change('typeTransaction', value)}
            />
            <SectionLabel text="Prix (TND)" />
            <FormInput
              placeholder="Ex : 500 000"
              keyboardType="decimal-pad"
              value={draft.prix}
              onChangeText={value => change('prix', value)}
            />
            <SectionLabel text="Localisation" />
            <FormInput
              placeholder="Ville, ex : Tunis"
              autoCapitalize="words"
              value={draft.ville}
              onChangeText={value => change('ville', value)}
            />
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.group}>
            <SectionLabel text="Titre de l’annonce" />
            <FormInput
              placeholder="Ex : Villa moderne avec piscine"
              autoCapitalize="sentences"
              maxLength={100}
              value={draft.titre}
              onChangeText={value => change('titre', value)}
            />
            <SectionLabel text="Description" />
            <FormInput
              placeholder="Décrivez le bien…"
              autoCapitalize="sentences"
              multiline
              maxLength={2000}
              value={draft.description}
              onChangeText={value => change('description', value)}
              style={styles.multiline}
            />
            <View style={styles.row}>
              <View style={styles.half}>
                <FormInput
                  placeholder="Surface (m²)"
                  keyboardType="decimal-pad"
                  value={draft.surface}
                  onChangeText={value => change('surface', value)}
                />
              </View>
              <View style={styles.half}>
                <FormInput
                  placeholder="Pièces"
                  keyboardType="number-pad"
                  value={draft.nombrePieces}
                  onChangeText={value => change('nombrePieces', value)}
                />
              </View>
            </View>
            <FormInput
              placeholder="Adresse (facultatif)"
              autoCapitalize="words"
              value={draft.adresse ?? ''}
              onChangeText={value => change('adresse', value)}
            />
            <PositionField
              position={position}
              disabled={submitting}
              onError={setError}
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.group}>
            <SectionLabel text={`Photos du bien (${photos.length}/${MAX_PHOTOS})`} />
            <HintText text="La première photo sera la couverture de l’annonce." />
            <PhotoGrid
              items={photos.map((photo, index) => ({
                key: `${index}-${photo.uri}`,
                uri: photo.uri,
              }))}
              onAdd={addPhotos}
              onRemove={index =>
                setPhotos(current => current.filter((_, i) => i !== index))
              }
              disabled={submitting}
            />
            <SectionLabel text="Récapitulatif" />
            <View style={styles.summary}>
              <SummaryRow
                label="Transaction"
                value={transactionLabel(draft.typeTransaction)}
              />
              <SummaryRow
                label="Type de bien"
                value={typeBienLabel(draft.typeBien)}
              />
              <SummaryRow label="Titre" value={draft.titre.trim()} />
              <SummaryRow
                label="Prix"
                value={Number.isFinite(priceValue) ? formatPrice(priceValue) : '-'}
              />
              <SummaryRow
                label="Surface"
                value={draft.surface.trim() ? `${draft.surface.trim()} m²` : '-'}
              />
              <SummaryRow label="Pièces" value={draft.nombrePieces.trim()} />
              <SummaryRow label="Ville" value={draft.ville.trim()} />
              <SummaryRow label="Photos" value={String(photos.length)} />
              <SummaryRow
                label="Position"
                value={
                  position.latitude !== null && position.longitude !== null
                    ? 'Renseignée'
                    : 'Non renseignée'
                }
              />
            </View>
            <HintText text="Vos photos, prix et localisation seront visibles par tous les visiteurs." />
          </View>
        ) : null}
      </ScrollView>

      <ErrorBanner message={error} />
      <View style={styles.bottom}>
        {submitting && progress.length > 0 ? (
          <Text style={styles.progress}>{progress}</Text>
        ) : null}
        <View style={styles.actions}>
          {step > 0 && !submitting ? (
            <Pressable
              accessibilityRole="button"
              onPress={back}
              style={styles.backButton}>
              <Text style={styles.backText}>← Retour</Text>
            </Pressable>
          ) : null}
          <View style={styles.primary}>
            <PrimaryButton
              title={isLast ? 'Publier l’annonce' : 'Suivant  →'}
              onPress={isLast ? submit : next}
              loading={submitting}
            />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <View style={styles.steps}>
      {PUBLISH_STEP_LABELS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        const highlighted = done || active;
        return (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, highlighted && styles.stepCircleOn]}>
                <Text
                  style={[styles.stepNumber, highlighted && styles.stepNumberOn]}>
                  {done ? '✓' : index + 1}
                </Text>
              </View>
              <Text style={[styles.stepLabel, highlighted && styles.stepLabelOn]}>
                {label}
              </Text>
            </View>
            {index < PUBLISH_STEP_LABELS.length - 1 ? (
              <View style={[styles.stepLine, index < current && styles.stepLineOn]} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value.length === 0 ? '-' : value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screen },
  content: { padding: spacing.lg, paddingBottom: spacing.md },
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  stepItem: { alignItems: 'center', gap: 6 },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepNumber: { color: colors.muted, fontWeight: '700' },
  stepNumberOn: { color: colors.background },
  stepLabel: { color: colors.muted, fontSize: 12 },
  stepLabelOn: { color: colors.primary, fontWeight: '700' },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.primaryTint,
    marginHorizontal: 6,
    marginBottom: 18,
  },
  stepLineOn: { backgroundColor: colors.primary },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  summaryRow: { flexDirection: 'row', paddingVertical: 6 },
  summaryLabel: { width: 110, color: colors.muted, fontSize: 13 },
  summaryValue: { flex: 1, color: colors.text, fontWeight: '600' },
  bottom: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  progress: { color: colors.textSecondary, fontSize: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  backText: { color: colors.primary, fontWeight: '600' },
  primary: { flex: 1 },
});
