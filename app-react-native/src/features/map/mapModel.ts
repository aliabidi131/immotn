import { distanceMeters } from '../../core/geo';
import type { Coordinates } from '../../core/geo';
import { hasLocation } from '../listings/listingModel';
import type { Listing } from '../listings/listingModel';

// Logique pure de l'écran Carte (map_screen.dart côté Flutter).

// Rayon du filtre « Autour de moi » (Flutter : 10 km).
export const NEAR_ME_RADIUS_KM = 10;

// Zoom initial de la carte et zoom après détection de la position (Flutter : 10 puis 15).
export const MAP_INITIAL_ZOOM = 10;
export const MAP_LOCATED_ZOOM = 15;

// Seules les annonces ayant une position réelle sont affichées.
export function locatedListings(all: Listing[]): Listing[] {
  return all.filter(hasLocation);
}

// Applique le rayon « autour de moi ». Sans position ou sans rayon (<= 0),
// toutes les annonces géolocalisées sont conservées.
export function visibleOnMap(
  located: Listing[],
  origin: Coordinates | null,
  radiusKm: number,
): Listing[] {
  if (radiusKm <= 0 || origin === null) {
    return located;
  }
  return located.filter(listing => {
    const distance = distanceMeters(origin, {
      latitude: listing.latitude as number,
      longitude: listing.longitude as number,
    });
    return distance <= radiusKm * 1000;
  });
}

// Texte du bandeau de comptage (_CountBadge Flutter).
export function mapCountText(located: number, withoutPosition: number): string {
  if (located === 0) {
    return 'Aucune annonce géolocalisée pour le moment';
  }
  const suffix = withoutPosition > 0 ? ` · ${withoutPosition} sans position` : '';
  return `${located} annonce(s) sur la carte${suffix}`;
}
