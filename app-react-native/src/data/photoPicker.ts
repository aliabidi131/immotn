import { launchImageLibrary } from 'react-native-image-picker';
import { normalizeImageContentType } from './imageService';
import type { PhotoToUpload } from './imageService';

// Sélection de photos depuis la galerie (équivalent de ImagePicker.pickMultiImage
// côté Flutter : qualité 80, 1600 px maximum). Le contenu est renvoyé en base64
// car l'Edge Function Supabase `process-image` attend un JSON.

export interface PickedPhoto extends PhotoToUpload {
  // URI locale, utilisée uniquement pour l'aperçu.
  uri: string;
}

export async function pickPhotos(max: number): Promise<PickedPhoto[]> {
  if (max <= 0) {
    return [];
  }
  const result = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: max,
    quality: 0.8,
    maxWidth: 1600,
    maxHeight: 1600,
    includeBase64: true,
  });
  if (result.didCancel) {
    return [];
  }
  if (result.errorCode) {
    throw new Error(result.errorMessage ?? result.errorCode);
  }
  const picked: PickedPhoto[] = [];
  for (const asset of result.assets ?? []) {
    if (asset.uri && asset.base64) {
      picked.push({
        uri: asset.uri,
        base64: asset.base64,
        contentType: normalizeImageContentType(asset.type, asset.fileName),
      });
    }
  }
  return picked.slice(0, max);
}
