import {
  areFiltersEmpty,
  buildListingData,
  coverPhoto,
  EMPTY_FILTERS,
  hasLocation,
  isDemoListing,
  isListingActive,
  ListingDraft,
  matchesFilters,
  matchesSearch,
  normalizeListing,
  parseNumber,
  validatePublishStep,
} from '../src/features/listings/listingModel';

const sample = normalizeListing('abc', {
  titre: 'Villa moderne avec piscine',
  description: 'Belle villa',
  typeTransaction: 'vente',
  typeBien: 'villa',
  prix: 950000,
  surface: 320,
  nombrePieces: 6,
  ville: 'Sousse',
  adresse: 'Port el Kantaoui, Sousse',
  latitude: 35.8972,
  longitude: 10.5916,
  photos: ['https://exemple.tn/1.jpg', 'https://exemple.tn/2.jpg'],
  statut: 'active',
  proprietaireId: 'uid-proprio',
});

const draft: ListingDraft = {
  titre: ' Appartement lumineux ',
  description: ' Près du centre. ',
  typeTransaction: 'location',
  typeBien: 'appartement',
  prix: '1 200,5',
  surface: '95',
  nombrePieces: '3',
  ville: ' Tunis ',
};

describe('normalizeListing', () => {
  test('lit un document complet', () => {
    expect(sample.id).toBe('abc');
    expect(sample.prix).toBe(950000);
    expect(sample.latitude).toBe(35.8972);
    expect(hasLocation(sample)).toBe(true);
    expect(isListingActive(sample)).toBe(true);
    expect(coverPhoto(sample)).toBe('https://exemple.tn/1.jpg');
    expect(isDemoListing(sample)).toBe(false);
  });

  test('tolère les anciennes annonces sans adresse, photos ni position', () => {
    const old = normalizeListing('old', {
      titre: 'Ancienne',
      prix: 100,
      surface: 50,
      ville: 'Tunis',
    });
    expect(old.adresse).toBe('');
    expect(old.photos).toEqual([]);
    expect(old.latitude).toBeUndefined();
    expect(hasLocation(old)).toBe(false);
    expect(coverPhoto(old)).toBe('');
    expect(old.statut).toBe('active');
    expect(old.typeTransaction).toBe('vente');
  });

  test('ne plante pas sur des données invalides', () => {
    const bad = normalizeListing('bad', null);
    expect(bad.titre).toBe('Sans titre');
    expect(bad.prix).toBe(0);
    const weird = normalizeListing('weird', {
      prix: '12',
      photos: [1, 'ok.jpg'],
      latitude: 200,
      longitude: 5,
    });
    expect(weird.prix).toBe(0);
    expect(weird.photos).toEqual(['ok.jpg']);
    expect(weird.latitude).toBeUndefined();
  });

  test('reconnaît les statuts vendue / masquee', () => {
    expect(normalizeListing('a', { statut: 'vendue' }).statut).toBe('vendue');
    expect(normalizeListing('a', { statut: 'masquee' }).statut).toBe('masquee');
    expect(normalizeListing('a', { statut: 'autre' }).statut).toBe('active');
  });

  test('détecte les annonces de démonstration', () => {
    expect(
      isDemoListing(normalizeListing('demo_0', { proprietaireId: 'DEMO' })),
    ).toBe(true);
  });
});

describe('parseNumber', () => {
  test('accepte espaces et virgule décimale', () => {
    expect(parseNumber('500 000')).toBe(500000);
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('180000')).toBe(180000);
  });

  test('renvoie NaN pour une saisie vide ou invalide', () => {
    expect(Number.isNaN(parseNumber(''))).toBe(true);
    expect(Number.isNaN(parseNumber('abc'))).toBe(true);
  });
});

describe('filtres', () => {
  test('aucun filtre : tout passe', () => {
    expect(areFiltersEmpty(EMPTY_FILTERS)).toBe(true);
    expect(matchesFilters(sample, EMPTY_FILTERS)).toBe(true);
  });

  test('transaction', () => {
    expect(
      matchesFilters(sample, { ...EMPTY_FILTERS, transaction: 'vente' }),
    ).toBe(true);
    expect(
      matchesFilters(sample, { ...EMPTY_FILTERS, transaction: 'location' }),
    ).toBe(false);
  });

  test('type de bien', () => {
    expect(matchesFilters(sample, { ...EMPTY_FILTERS, typeBien: 'villa' })).toBe(
      true,
    );
    expect(
      matchesFilters(sample, { ...EMPTY_FILTERS, typeBien: 'terrain' }),
    ).toBe(false);
  });

  test('prix min / max (bornes incluses)', () => {
    expect(
      matchesFilters(sample, { ...EMPTY_FILTERS, minPrice: 950000 }),
    ).toBe(true);
    expect(
      matchesFilters(sample, { ...EMPTY_FILTERS, minPrice: 950001 }),
    ).toBe(false);
    expect(
      matchesFilters(sample, { ...EMPTY_FILTERS, maxPrice: 950000 }),
    ).toBe(true);
    expect(
      matchesFilters(sample, { ...EMPTY_FILTERS, maxPrice: 900000 }),
    ).toBe(false);
  });

  test('surface min, pièces min, ville (sans casse)', () => {
    expect(
      matchesFilters(sample, { ...EMPTY_FILTERS, minSurface: 320 }),
    ).toBe(true);
    expect(
      matchesFilters(sample, { ...EMPTY_FILTERS, minSurface: 321 }),
    ).toBe(false);
    expect(matchesFilters(sample, { ...EMPTY_FILTERS, minRooms: 6 })).toBe(true);
    expect(matchesFilters(sample, { ...EMPTY_FILTERS, minRooms: 7 })).toBe(false);
    expect(matchesFilters(sample, { ...EMPTY_FILTERS, city: 'sous' })).toBe(true);
    expect(matchesFilters(sample, { ...EMPTY_FILTERS, city: 'tunis' })).toBe(
      false,
    );
  });

  test('areFiltersEmpty détecte un filtre actif', () => {
    expect(areFiltersEmpty({ ...EMPTY_FILTERS, minRooms: 2 })).toBe(false);
    expect(areFiltersEmpty({ ...EMPTY_FILTERS, city: 'x' })).toBe(false);
  });
});

describe('recherche textuelle', () => {
  test('titre, ville, adresse et type de bien', () => {
    expect(matchesSearch(sample, '')).toBe(true);
    expect(matchesSearch(sample, 'PISCINE')).toBe(true);
    expect(matchesSearch(sample, 'sousse')).toBe(true);
    expect(matchesSearch(sample, 'kantaoui')).toBe(true);
    expect(matchesSearch(sample, 'villa')).toBe(true);
    expect(matchesSearch(sample, 'bizerte')).toBe(false);
  });

  test('retrouve un local par son libellé', () => {
    const local = normalizeListing('l', { typeBien: 'local', titre: 'Boutique' });
    expect(matchesSearch(local, 'commercial')).toBe(true);
  });
});

describe('buildListingData (clés autorisées par firestore.rules)', () => {
  const allowedOnCreate = [
    'titre',
    'description',
    'typeTransaction',
    'typeBien',
    'prix',
    'surface',
    'nombrePieces',
    'ville',
    'adresse',
    'latitude',
    'longitude',
  ];

  test('création : nombres convertis, textes nettoyés, adresse omise si vide', () => {
    const data = buildListingData(draft, 'create');
    expect(data.titre).toBe('Appartement lumineux');
    expect(data.ville).toBe('Tunis');
    expect(data.prix).toBe(1200.5);
    expect(data.surface).toBe(95);
    expect(data.nombrePieces).toBe(3);
    expect('adresse' in data).toBe(false);
    expect('latitude' in data).toBe(false);
    for (const key of Object.keys(data)) {
      expect(allowedOnCreate).toContain(key);
    }
  });

  test('création avec adresse et position réelle', () => {
    const data = buildListingData(
      { ...draft, adresse: ' Lac 2 ', latitude: 36.8, longitude: 10.2 },
      'create',
    );
    expect(data.adresse).toBe('Lac 2');
    expect(data.latitude).toBe(36.8);
    expect(data.longitude).toBe(10.2);
  });

  test('modification : adresse toujours envoyée, position invalide ignorée', () => {
    const data = buildListingData(
      { ...draft, latitude: 200, longitude: 10 },
      'update',
    );
    expect(data.adresse).toBe('');
    expect('latitude' in data).toBe(false);
    expect('longitude' in data).toBe(false);
  });
});

describe('validatePublishStep', () => {
  test('étape 1 : prix et ville', () => {
    expect(validatePublishStep(0, draft, 0)).toBeNull();
    expect(validatePublishStep(0, { ...draft, prix: '0' }, 0)).toContain('prix');
    expect(validatePublishStep(0, { ...draft, ville: '  ' }, 0)).toContain(
      'ville',
    );
  });

  test('étape 2 : titre, description, surface, pièces', () => {
    expect(validatePublishStep(1, draft, 0)).toBeNull();
    expect(validatePublishStep(1, { ...draft, titre: '' }, 0)).toContain('titre');
    expect(validatePublishStep(1, { ...draft, description: '' }, 0)).toContain(
      'description',
    );
    expect(validatePublishStep(1, { ...draft, surface: '-3' }, 0)).toContain(
      'surface',
    );
    expect(
      validatePublishStep(1, { ...draft, nombrePieces: '1.5' }, 0),
    ).toContain('pièces');
  });

  test('étape 3 : au moins une photo', () => {
    expect(validatePublishStep(2, draft, 0)).toContain('photo');
    expect(validatePublishStep(2, draft, 1)).toBeNull();
  });
});
