
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FormInput, PrimaryButton } from '../../core/ui';
import {
  FavoriteButton,
  ListingCard,
  ListingFeaturedCard,
  StatusMessage,
} from '../../core/components';
import { colors, spacing } from '../../core/theme';
import { demoFallbackFor } from '../../data/demoData';
import {
  fetchActivePage,
  subscribeListingsChanged,
} from '../../data/listingService';
import type { ListingCursor } from '../../data/listingService';
import NotificationBell from '../messages/NotificationBell';
import type {
  AppStackParamList,
  HomeTabParamList,
} from './navigationTypes';
import {
  EMPTY_FILTERS,
  TYPE_BIEN_OPTIONS,
  areFiltersEmpty,
  matchesFilters,
  matchesSearch,
  parseNumber,
} from './listingModel';
import type { Listing, ListingFilters } from './listingModel';

type Props = CompositeScreenProps<
  BottomTabScreenProps<HomeTabParamList, 'Accueil'>,
  NativeStackScreenProps<AppStackParamList, 'Tabs'>
>;

// Texte -> nombre, ou null si vide / invalide.
function optionalNumber(text: string): number | null {
  if (text.trim().length === 0) {
    return null;
  }
  const value = parseNumber(text);
  return Number.isFinite(value) ? value : null;
}

function fieldText(value: number | null): string {
  return value === null ? '' : String(value);
}

export default function HomeScreen({ navigation }: Props) {
  const [loaded, setLoaded] = useState<Listing[]>([]);
  const [cursor, setCursor] = useState<ListingCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadFirstPage = useCallback(async (silent: boolean) => {
    if (!silent) {
      setLoading(true);
    }

    setError(null);

    try {
      const page = await fetchActivePage();
      setLoaded(page.items);
      setCursor(page.lastDoc);
      setHasMore(page.hasMore);
    } catch {
      setError(
        'Impossible de charger les annonces. Vérifiez votre connexion.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFirstPage(false);

    return subscribeListingsChanged(() => {
      loadFirstPage(true);
    });
  }, [loadFirstPage]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || !cursor) {
      return;
    }

    setLoadingMore(true);

    try {
      const page = await fetchActivePage(cursor);

      setLoaded(current => [...current, ...page.items]);
      setCursor(page.lastDoc ?? cursor);
      setHasMore(page.hasMore);
    } catch {
      setError('Impossible de charger plus d’annonces.');
    } finally {
      setLoadingMore(false);
    }
  };

  // Annonces réelles + annonces de démonstration.
  const all = useMemo(
    () => [...loaded, ...demoFallbackFor(loaded)],
    [loaded],
  );

  const visible = useMemo(
    () =>
      all.filter(
        listing =>
          matchesFilters(listing, filters) &&
          matchesSearch(listing, search),
      ),
    [all, filters, search],
  );

  const topVillas = useMemo(
    () => all.filter(l => l.typeBien === 'villa').slice(0, 6),
    [all],
  );

  const topLocations = useMemo(
    () =>
      all
        .filter(l => l.typeTransaction === 'location')
        .slice(0, 6),
    [all],
  );

  const cityCount = useMemo(
    () =>
      new Set(
        all.map(l => l.ville).filter(ville => ville.length > 0),
      ).size,
    [all],
  );

  const filtersActive = !areFiltersEmpty(filters);
  const isFiltered = search.trim().length > 0 || filtersActive;

  useEffect(() => {
    navigation.setOptions({
      title: 'ImmoTN',
      headerRight: () => (
        <View style={styles.headerRight}>
          <NotificationBell />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filtres"
            hitSlop={8}
            onPress={() => setFiltersOpen(true)}
            style={styles.headerButton}
          >
            <Text style={styles.headerIcon}>⚙</Text>
            {filtersActive ? <View style={styles.headerDot} /> : null}
          </Pressable>
        </View>
      ),
    });
  }, [navigation, filtersActive]);

  const openDetail = (listing: Listing) =>
    navigation.navigate('ListingDetail', {
      listingId: listing.id,
    });

  const resetAll = () => {
    setSearch('');
    setFilters(EMPTY_FILTERS);
  };

  const header = (
    <View>
      <View style={styles.searchBox}>
        <FormInput
          placeholder="Ville, type de bien, titre…"
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Rechercher une annonce"
        />

        {search.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Effacer la recherche"
            onPress={() => setSearch('')}
            style={styles.clear}
          >
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {!isFiltered ? (
        <View>
          <View style={styles.promo}>
            <Text style={styles.promoTitle}>
              Trouvez votre bien en Tunisie
            </Text>

            <Text style={styles.promoText}>
              {all.length} biens · {cityCount} villes
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('AllListings')}
              style={styles.promoButton}
            >
              <Text style={styles.promoButtonText}>
                Découvrir les annonces
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label="Tous"
          selected={filters.typeBien === null}
          onPress={() =>
            setFilters({ ...filters, typeBien: null })
          }
        />

        {TYPE_BIEN_OPTIONS.map(option => (
          <Chip
            key={option.key}
            label={option.label}
            selected={filters.typeBien === option.key}
            onPress={() =>
              setFilters({ ...filters, typeBien: option.key })
            }
          />
        ))}
      </ScrollView>

      {!isFiltered && topVillas.length > 0 ? (
        <HorizontalSection
          title="Villas & Luxe"
          listings={topVillas}
          onPress={openDetail}
        />
      ) : null}

      {!isFiltered && topLocations.length > 0 ? (
        <HorizontalSection
          title="À louer"
          listings={topLocations}
          onPress={openDetail}
        />
      ) : null}

      {!loading && visible.length > 0 ? (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>
            {search.trim().length > 0
              ? `${visible.length} résultat(s) trouvé(s)`
              : filtersActive
                ? `${visible.length} bien(s) filtré(s)`
                : 'Toutes les annonces'}
          </Text>

          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {visible.length} biens
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  let emptyState: React.ReactNode = null;

  if (loading && loaded.length === 0) {
    emptyState = (
      <ActivityIndicator
        style={styles.loader}
        color={colors.primary}
      />
    );
  } else if (error && loaded.length === 0) {
    emptyState = (
      <StatusMessage
        title={error}
        actionLabel="Réessayer"
        onAction={() => loadFirstPage(false)}
      />
    );
  } else if (all.length === 0) {
    emptyState = (
      <StatusMessage
        title="Aucune annonce pour le moment"
        message="Les nouvelles annonces apparaîtront ici dès leur publication."
      />
    );
  } else if (visible.length === 0) {
    emptyState = (
      <StatusMessage
        title="Aucun bien ne correspond"
        message="Modifiez vos filtres ou votre recherche."
        actionLabel="Réinitialiser"
        onAction={resetAll}
      />
    );
  }

  const footer =
    hasMore && !emptyState ? (
      <View style={styles.footer}>
        {loadingMore ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <PrimaryButton
            title="Charger plus d’annonces"
            onPress={loadMore}
          />
        )}
      </View>
    ) : undefined;

  return (
    <View style={styles.screen}>
      <FlatList
        data={emptyState ? [] : visible}
        keyExtractor={item => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={emptyState ?? undefined}
        ListFooterComponent={footer}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <ListingCard
              listing={item}
              onPress={() => openDetail(item)}
              trailing={
                <FavoriteButton listingId={item.id} />
              }
            />
          </View>
        )}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadFirstPage(true);
        }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
      />

      <FilterSheet
        visible={filtersOpen}
        initial={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={next => {
          setFilters(next);
          setFiltersOpen(false);
        }}
      />
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        selected && styles.chipSelected,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          selected && styles.chipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function HorizontalSection({
  title,
  listings,
  onPress,
}: {
  title: string;
  listings: Listing[];
  onPress: (listing: Listing) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={listings}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.sectionList}
        renderItem={({ item }) => (
          <ListingFeaturedCard
            listing={item}
            onPress={() => onPress(item)}
          />
        )}
      />
    </View>
  );
}

// Feuille de filtres.
function FilterSheet({
  visible,
  initial,
  onClose,
  onApply,
}: {
  visible: boolean;
  initial: ListingFilters;
  onClose: () => void;
  onApply: (filters: ListingFilters) => void;
}) {
  const [transaction, setTransaction] = useState(
    initial.transaction,
  );
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minSurface, setMinSurface] = useState('');
  const [minRooms, setMinRooms] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    if (visible) {
      setTransaction(initial.transaction);
      setMinPrice(fieldText(initial.minPrice));
      setMaxPrice(fieldText(initial.maxPrice));
      setMinSurface(fieldText(initial.minSurface));
      setMinRooms(fieldText(initial.minRooms));
      setCity(initial.city);
    }
  }, [visible, initial]);

  const apply = () => {
    const rooms = optionalNumber(minRooms);

    onApply({
      transaction,
      typeBien: initial.typeBien,
      minPrice: optionalNumber(minPrice),
      maxPrice: optionalNumber(maxPrice),
      minSurface: optionalNumber(minSurface),
      minRooms:
        rooms === null ? null : Math.trunc(rooms),
      city: city.trim(),
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
        />

        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>Filtres</Text>

            <Text style={styles.label}>Transaction</Text>

            <View style={styles.row}>
              {(['tous', 'vente', 'location'] as const).map(
                value => (
                  <Chip
                    key={value}
                    label={
                      value === 'tous'
                        ? 'Tous'
                        : value === 'vente'
                          ? 'Vente'
                          : 'Location'
                    }
                    selected={transaction === value}
                    onPress={() => setTransaction(value)}
                  />
                ),
              )}
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <FormInput
                  placeholder="Prix min (TND)"
                  keyboardType="decimal-pad"
                  value={minPrice}
                  onChangeText={setMinPrice}
                />
              </View>

              <View style={styles.half}>
                <FormInput
                  placeholder="Prix max (TND)"
                  keyboardType="decimal-pad"
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <FormInput
                  placeholder="Surface min (m²)"
                  keyboardType="decimal-pad"
                  value={minSurface}
                  onChangeText={setMinSurface}
                />
              </View>

              <View style={styles.half}>
                <FormInput
                  placeholder="Pièces min"
                  keyboardType="number-pad"
                  value={minRooms}
                  onChangeText={setMinRooms}
                />
              </View>
            </View>

            <FormInput
              placeholder="Ville"
              autoCapitalize="words"
              value={city}
              onChangeText={setCity}
            />

            <View style={styles.sheetActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  onApply({
                    ...EMPTY_FILTERS,
                    typeBien: initial.typeBien,
                  })
                }
                style={styles.resetButton}
              >
                <Text style={styles.resetText}>
                  Réinitialiser
                </Text>
              </Pressable>

              <View style={styles.applyWrap}>
                <PrimaryButton
                  title="Appliquer"
                  onPress={apply}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  list: {
    paddingBottom: spacing.lg,
  },
  loader: {
    marginTop: spacing.lg,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  headerButton: {
    padding: 6,
  },
  headerIcon: {
    fontSize: 20,
    color: colors.text,
  },
  headerDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  searchBox: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  clear: {
    position: 'absolute',
    right: spacing.md + 12,
    top: spacing.md + 12,
  },
  clearText: {
    color: colors.muted,
    fontSize: 16,
  },
  promo: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.primary,
    gap: spacing.sm,
  },
  promoTitle: {
    color: colors.background,
    fontSize: 20,
    fontWeight: '800',
  },
  promoText: {
    color: colors.primaryTint,
  },
  promoButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  promoButtonText: {
    color: colors.background,
    fontWeight: '700',
  },
  chips: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.background,
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionList: {
    paddingHorizontal: spacing.md,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  resultsTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  countBadge: {
    backgroundColor: colors.successLight,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countBadgeText: {
    color: colors.success,
    fontWeight: '700',
    fontSize: 12,
  },
  cardWrap: {
    paddingHorizontal: spacing.md,
  },
  footer: {
    padding: spacing.md,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  half: {
    flex: 1,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  resetButton: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  resetText: {
    color: colors.text,
    fontWeight: '600',
  },
  applyWrap: {
    flex: 1,
  },
});
