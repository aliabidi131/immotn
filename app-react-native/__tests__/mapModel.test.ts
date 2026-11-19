import {
  locatedListings,
  mapCountText,
  NEAR_ME_RADIUS_KM,
  visibleOnMap,
} from '../src/features/map/mapModel';
import { normalizeListing } from '../src/features/listings/listingModel';

function listing(id: string, latitude?: number, longitude?: number) {
  return normalizeListing(id, {
    titre: id,
    typeTransaction: 'vente',
    typeBien: 'villa',
    prix: 100,
    surface: 50,
    ville: 'Sousse',
    statut: 'active',
    proprietaireId: 'u',
    latitude,
    longitude,
  });
}

// Sousse centre.
const origin = { latitude: 35.8256, longitude: 10.6084 };

const near = listing('near', 35.83, 10.61); // ~ 0,6 km
const far = listing('far', 36.8065, 10.1815); // Tunis, ~ 130 km
const none = listing('none');

describe('locatedListings', () => {
  it('ne garde que les annonces avec une position réelle', () => {
    expect(locatedListings([near, far, none]).map(l => l.id)).toEqual([
      'near',
      'far',
    ]);
  });
});

describe('visibleOnMap', () => {
  const located = [near, far];

  it('renvoie tout sans rayon', () => {
    expect(visibleOnMap(located, origin, 0)).toEqual(located);
  });

  it('renvoie tout sans position de l’appareil', () => {
    expect(visibleOnMap(located, null, NEAR_ME_RADIUS_KM)).toEqual(located);
  });

  it('filtre les annonces hors du rayon de 10 km', () => {
    expect(
      visibleOnMap(located, origin, NEAR_ME_RADIUS_KM).map(l => l.id),
    ).toEqual(['near']);
  });

  it('élargit le résultat avec un rayon plus grand', () => {
    expect(visibleOnMap(located, origin, 200).map(l => l.id)).toEqual([
      'near',
      'far',
    ]);
  });
});

describe('mapCountText', () => {
  it('indique l’absence d’annonces géolocalisées', () => {
    expect(mapCountText(0, 5)).toBe(
      'Aucune annonce géolocalisée pour le moment',
    );
  });

  it('affiche le nombre d’annonces sur la carte', () => {
    expect(mapCountText(3, 0)).toBe('3 annonce(s) sur la carte');
  });

  it('ajoute le nombre d’annonces sans position', () => {
    expect(mapCountText(3, 2)).toBe('3 annonce(s) sur la carte · 2 sans position');
  });
});
