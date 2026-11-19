import {
  centroid,
  clampZoom,
  distanceMeters,
  isValidCoordinates,
  panCenter,
  project,
  toScreen,
  unproject,
  visibleTiles,
} from '../src/core/geo';

describe('distanceMeters', () => {
  test('distance nulle entre deux points identiques', () => {
    const tunis = { latitude: 36.8065, longitude: 10.1815 };
    expect(distanceMeters(tunis, tunis)).toBeCloseTo(0, 3);
  });

  test('Tunis -> Sousse ≈ 120 km', () => {
    const tunis = { latitude: 36.8065, longitude: 10.1815 };
    const sousse = { latitude: 35.8256, longitude: 10.6084 };
    const km = distanceMeters(tunis, sousse) / 1000;
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(130);
  });

  test('un degré de latitude ≈ 111 km', () => {
    const km =
      distanceMeters(
        { latitude: 35, longitude: 10 },
        { latitude: 36, longitude: 10 },
      ) / 1000;
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });
});

describe('isValidCoordinates', () => {
  test('accepte des coordonnées réelles', () => {
    expect(isValidCoordinates(36.8, 10.2)).toBe(true);
    expect(isValidCoordinates(0, 0)).toBe(true);
  });

  test('refuse les valeurs hors limites ou non numériques', () => {
    expect(isValidCoordinates(91, 10)).toBe(false);
    expect(isValidCoordinates(10, 181)).toBe(false);
    expect(isValidCoordinates(undefined, 10)).toBe(false);
    expect(isValidCoordinates('36', '10')).toBe(false);
    expect(isValidCoordinates(Number.NaN, 10)).toBe(false);
  });
});

describe('centroid', () => {
  test('moyenne des points, Tunisie si vide', () => {
    expect(
      centroid([
        { latitude: 10, longitude: 20 },
        { latitude: 20, longitude: 40 },
      ]),
    ).toEqual({ latitude: 15, longitude: 30 });
    expect(centroid([])).toEqual({ latitude: 34, longitude: 9 });
  });
});

describe('projection Web Mercator', () => {
  test('(0,0) au zoom 0 est au centre de la tuile unique', () => {
    const p = project({ latitude: 0, longitude: 0 }, 0);
    expect(p.x).toBeCloseTo(128, 6);
    expect(p.y).toBeCloseTo(128, 6);
  });

  test('project puis unproject redonne le point de départ', () => {
    const point = { latitude: 36.8065, longitude: 10.1815 };
    for (const zoom of [3, 10, 15, 18]) {
      const p = project(point, zoom);
      const back = unproject(p.x, p.y, zoom);
      expect(back.latitude).toBeCloseTo(point.latitude, 6);
      expect(back.longitude).toBeCloseTo(point.longitude, 6);
    }
  });

  test('clampZoom borne le zoom entre 3 et 18', () => {
    expect(clampZoom(1)).toBe(3);
    expect(clampZoom(10.4)).toBe(10);
    expect(clampZoom(25)).toBe(18);
  });
});

describe('visibleTiles', () => {
  test('couvre toute la vue', () => {
    const center = { latitude: 36.8, longitude: 10.2 };
    const width = 400;
    const height = 600;
    const tiles = visibleTiles(center, 12, width, height);
    expect(tiles.length).toBeGreaterThan(0);
    const minLeft = Math.min(...tiles.map(t => t.left));
    const maxRight = Math.max(...tiles.map(t => t.left + 256));
    const minTop = Math.min(...tiles.map(t => t.top));
    const maxBottom = Math.max(...tiles.map(t => t.top + 256));
    expect(minLeft).toBeLessThanOrEqual(0);
    expect(maxRight).toBeGreaterThanOrEqual(width);
    expect(minTop).toBeLessThanOrEqual(0);
    expect(maxBottom).toBeGreaterThanOrEqual(height);
  });

  test('les indices de tuiles restent dans le monde', () => {
    const tiles = visibleTiles({ latitude: 0, longitude: 179.9 }, 4, 800, 800);
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.x).toBeLessThan(16);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeLessThan(16);
    }
  });

  test('aucune tuile pour une vue vide', () => {
    expect(visibleTiles({ latitude: 0, longitude: 0 }, 5, 0, 100)).toHaveLength(
      0,
    );
  });
});

describe('toScreen et panCenter', () => {
  test('le centre se projette au milieu de la vue', () => {
    const center = { latitude: 36.8, longitude: 10.2 };
    const p = toScreen(center, center, 12, 400, 600);
    expect(p.x).toBeCloseTo(200, 6);
    expect(p.y).toBeCloseTo(300, 6);
  });

  test('glisser vers la droite déplace le centre vers l’ouest', () => {
    const center = { latitude: 36.8, longitude: 10.2 };
    const moved = panCenter(center, 12, 100, 0);
    expect(moved.longitude).toBeLessThan(center.longitude);
    expect(moved.latitude).toBeCloseTo(center.latitude, 6);
  });

  test('glisser vers le bas déplace le centre vers le nord', () => {
    const center = { latitude: 36.8, longitude: 10.2 };
    const moved = panCenter(center, 12, 0, 100);
    expect(moved.latitude).toBeGreaterThan(center.latitude);
  });
});
