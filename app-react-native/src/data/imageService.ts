import {
  EDGE_FUNCTION_URL,
  STORAGE_PUBLIC_URL,
} from './config';

// Envoi et suppression des photos d'annonces vers Supabase Storage, via
// l'Edge Function `process-image` (même protocole que image_service.dart).

// Formats acceptés (Content-Type -> extension).
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Taille maximale avant envoi à l'Edge Function (5 Mo).
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const REQUEST_TIMEOUT_MS = 30000;

export type ImageErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalidFormat'
  | 'fileTooLarge'
  | 'emptyFile'
  | 'networkError'
  | 'serverError';

// Photo prête à être envoyée : contenu encodé en base64 (react-native-image-picker
// avec includeBase64) et type MIME.
export interface PhotoToUpload {
  base64: string;
  contentType: string;
}

export interface ImageServiceError {
  name: 'ImageServiceException';
  message: string;
  code: ImageErrorCode;
}

export function imageError(
  message: string,
  code: ImageErrorCode,
): ImageServiceError {
  return { name: 'ImageServiceException', message, code };
}

export function isImageServiceError(error: unknown): error is ImageServiceError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'ImageServiceException'
  );
}

// Taille en octets du contenu décodé d'une chaîne base64.
export function base64ByteLength(base64: string): number {
  const clean = base64.replace(/\s+/g, '');
  if (clean.length === 0) {
    return 0;
  }
  let padding = 0;
  if (clean.endsWith('==')) {
    padding = 2;
  } else if (clean.endsWith('=')) {
    padding = 1;
  }
  return Math.floor((clean.length * 3) / 4) - padding;
}

// Vérifie format et taille avant l'envoi. Lève une ImageServiceError.
export function validatePhoto(photo: PhotoToUpload): void {
  if (!(photo.contentType in ALLOWED_IMAGE_TYPES)) {
    throw imageError(
      `Format non supporté : ${photo.contentType}. Utilisez JPEG, PNG ou WebP.`,
      'invalidFormat',
    );
  }
  const size = base64ByteLength(photo.base64);
  if (size === 0) {
    throw imageError("L'image est vide.", 'emptyFile');
  }
  if (size > MAX_IMAGE_BYTES) {
    throw imageError(
      "L'image dépasse la limite de 5 Mo. Choisissez une photo plus légère.",
      'fileTooLarge',
    );
  }
}

// Normalise le type MIME renvoyé par le sélecteur d'images (Android renvoie
// parfois « image/jpg »). Un type inconnu est conservé tel quel pour que
// validatePhoto affiche un message clair ; un type absent est déduit de
// l'extension du fichier, puis par défaut JPEG.
export function normalizeImageContentType(
  type: string | null | undefined,
  fileName?: string | null,
): string {
  const lower = (type ?? '').trim().toLowerCase();
  if (lower === 'image/jpg' || lower === 'image/jpeg') {
    return 'image/jpeg';
  }
  if (lower.length > 0) {
    return lower;
  }
  const ext = (fileName ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'png') {
    return 'image/png';
  }
  if (ext === 'webp') {
    return 'image/webp';
  }
  return 'image/jpeg';
}

export function buildFileName(
  contentType: string,
  index: number,
  now: number = Date.now(),
): string {
  const ext = ALLOWED_IMAGE_TYPES[contentType] ?? 'jpg';
  return `img_${now}_${index}.${ext}`;
}

// Interprète la réponse de l'Edge Function (mêmes cas que _parseResponse).
export function parseUploadResponse(status: number, body: string): string {
  switch (status) {
    case 200: {
      let url: unknown;
      try {
        url = (JSON.parse(body) as { url?: unknown }).url;
      } catch {
        url = undefined;
      }
      if (typeof url !== 'string' || url.length === 0) {
        throw imageError(
          "L'Edge Function n'a retourné aucune URL.",
          'serverError',
        );
      }
      return url;
    }
    case 401:
      throw imageError(
        'Authentification requise. Reconnectez-vous.',
        'unauthenticated',
      );
    case 403:
      throw imageError('Accès refusé à cette annonce.', 'forbidden');
    case 413:
      throw imageError('Le fichier dépasse la limite de 5 Mo.', 'fileTooLarge');
    default: {
      let detail = '';
      try {
        const parsed = JSON.parse(body) as { error?: unknown };
        detail = parsed.error === undefined ? '' : String(parsed.error);
      } catch {
        detail = '';
      }
      throw imageError(
        `Upload échoué (${status}) : ${detail}`,
        'serverError',
      );
    }
  }
}

// Vérifie qu'une URL appartient bien au bucket Supabase `property-images`.
export function isSupabaseUrl(url: string): boolean {
  return url.startsWith(STORAGE_PUBLIC_URL);
}

// Extrait le chemin relatif d'une URL publique du bucket.
export function extractStoragePath(url: string): string | null {
  if (!isSupabaseUrl(url)) {
    return null;
  }
  const path = url.substring(STORAGE_PUBLIC_URL.length);
  return path.startsWith('/') ? path.substring(1) : path;
}

type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<{ status: number; text: () => Promise<string> }>;

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
): Promise<{ status: number; text: () => Promise<string> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface UploadOptions {
  listingId: string;
  photos: PhotoToUpload[];
  // Fournit un jeton d'identification Firebase frais (renouvelé à chaque envoi
  // pour éviter l'expiration sur une longue série de photos).
  getToken: () => Promise<string | null>;
  onProgress?: (done: number, total: number) => void;
  fetchImpl?: FetchLike;
}

// Envoie les photos une par une et renvoie leurs URLs publiques, dans l'ordre.
export async function uploadPhotos(options: UploadOptions): Promise<string[]> {
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  const urls: string[] = [];
  for (let index = 0; index < options.photos.length; index++) {
    const photo = options.photos[index];
    validatePhoto(photo);
    const token = await options.getToken();
    if (!token) {
      throw imageError(
        "Impossible d'obtenir le jeton d'authentification.",
        'unauthenticated',
      );
    }
    let response: { status: number; text: () => Promise<string> };
    try {
      response = await fetchWithTimeout(fetchImpl, EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listingId: options.listingId,
          fileBase64: photo.base64,
          fileName: buildFileName(photo.contentType, index),
          contentType: photo.contentType,
        }),
      });
    } catch (error) {
      throw imageError(`Erreur réseau : ${String(error)}`, 'networkError');
    }
    urls.push(parseUploadResponse(response.status, await response.text()));
    options.onProgress?.(index + 1, options.photos.length);
  }
  return urls;
}

// Supprime des photos du bucket (non bloquant : aucune exception n'est levée
// si la suppression échoue, les images restent alors dans le bucket).
export async function deletePhotos(
  imageUrls: string[],
  getToken: () => Promise<string | null>,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<void> {
  const paths = imageUrls
    .map(extractStoragePath)
    .filter((path): path is string => path !== null);
  if (paths.length === 0) {
    return;
  }
  try {
    const token = await getToken();
    if (!token) {
      return;
    }
    await fetchWithTimeout(fetchImpl, EDGE_FUNCTION_URL, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paths }),
    });
  } catch {
    // Suppression non bloquante, comme côté Flutter.
  }
}
