// Calculs géographiques purs (sans dépendance React Native), utilisés par la
// carte OpenStreetMap et le filtre « autour de moi ».

export const TILE_SIZE = 256;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 18;

// Centre de la Tunisie (même valeur que l'application Flutter).
export const TUNISIA_CENTER = { latitude: 34.0, longitude: 9.0 };

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METERS = 6371008.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Distance à vol d'oiseau en mètres (formule de haversine).
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidCoordinates(
  latitude: unknown,
  longitude: unknown,
): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

// Centre moyen d'un ensemble de points (Tunisie si l'ensemble est vide).
export function centroid(points: Coordinates[]): Coordinates {
  if (points.length === 0) {
    return TUNISIA_CENTER;
  }
  const latitude =
    points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const longitude =
    points.reduce((sum, point) => sum + point.longitude, 0) / points.length;
  return { latitude, longitude };
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom)));
}

// Projection Web Mercator : coordonnées -> pixel « monde » au zoom donné.
export function project(
  point: Coordinates,
  zoom: number,
): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.min(
    0.9999,
    Math.max(-0.9999, Math.sin(toRadians(point.latitude))),
  );
  const x = ((point.longitude + 180) / 360) * scale;
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

// Opération inverse de project().
export function unproject(x: number, y: number, zoom: number): Coordinates {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const latitude =
    (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { latitude, longitude };
}

export interface TileRef {
  x: number; // index de tuile (enveloppé sur le monde)
  y: number;
  left: number; // position à l'écran en pixels
  top: number;
}

// Tuiles OpenStreetMap à afficher pour couvrir une vue width x height centrée
// sur `center`. Les tuiles hors du monde (y < 0 ou y >= 2^zoom) sont ignorées.
export function visibleTiles(
  center: Coordinates,
  zoom: number,
  width: number,
  height: number,
): TileRef[] {
  if (width <= 0 || height <= 0) {
    return [];
  }
  const worldTiles = 2 ** zoom;
  const centerPx = project(center, zoom);
  const originX = centerPx.x - width / 2;
  const originY = centerPx.y - height / 2;
  const firstX = Math.floor(originX / TILE_SIZE);
  const lastX = Math.floor((originX + width) / TILE_SIZE);
  const firstY = Math.floor(originY / TILE_SIZE);
  const lastY = Math.floor((originY + height) / TILE_SIZE);

  const tiles: TileRef[] = [];
  for (let ty = firstY; ty <= lastY; ty++) {
    if (ty < 0 || ty >= worldTiles) {
      continue;
    }
    for (let tx = firstX; tx <= lastX; tx++) {
      tiles.push({
        x: ((tx % worldTiles) + worldTiles) % worldTiles,
        y: ty,
        left: tx * TILE_SIZE - originX,
        top: ty * TILE_SIZE - originY,
      });
    }
  }
  return tiles;
}

// Position à l'écran d'un point, pour une vue centrée sur `center`.
export function toScreen(
  point: Coordinates,
  center: Coordinates,
  zoom: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const p = project(point, zoom);
  const c = project(center, zoom);
  return { x: p.x - c.x + width / 2, y: p.y - c.y + height / 2 };
}

// Nouveau centre après un déplacement du doigt de (dx, dy) pixels.
export function panCenter(
  startCenter: Coordinates,
  zoom: number,
  dx: number,
  dy: number,
): Coordinates {
  const start = project(startCenter, zoom);
  const next = unproject(start.x - dx, start.y - dy, zoom);
  return {
    latitude: Math.min(85, Math.max(-85, next.latitude)),
    longitude: ((((next.longitude + 180) % 360) + 360) % 360) - 180,
  };
}
