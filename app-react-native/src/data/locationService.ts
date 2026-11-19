import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import type { Coordinates } from '../core/geo';

// Position de l'appareil (équivalent de Geolocator côté Flutter).
// Lève une Error dont le message est affichable à l'utilisateur.

async function ensurePermission(): Promise<void> {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      throw new Error(
        'Autorisez la localisation dans les paramètres de l’application.',
      );
    }
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Permission de localisation refusée.');
    }
    return;
  }
  await new Promise<void>((resolve, reject) => {
    Geolocation.requestAuthorization(
      () => resolve(),
      () => reject(new Error('Permission de localisation refusée.')),
    );
  });
}

export async function getDevicePosition(): Promise<Coordinates> {
  await ensurePermission();
  return new Promise<Coordinates>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      error => {
        // 2 : service de localisation désactivé ; 3 : délai dépassé.
        if (error.code === 2) {
          reject(new Error('Veuillez activer la localisation.'));
        } else if (error.code === 3) {
          reject(new Error('Délai de localisation dépassé. Réessayez.'));
        } else {
          reject(new Error('Position impossible.'));
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
    );
  });
}
