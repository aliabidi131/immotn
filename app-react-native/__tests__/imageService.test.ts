import {
  base64ByteLength,
  buildFileName,
  deletePhotos,
  extractStoragePath,
  isImageServiceError,
  isSupabaseUrl,
  MAX_IMAGE_BYTES,
  parseUploadResponse,
  uploadPhotos,
  validatePhoto,
} from '../src/data/imageService';
import { EDGE_FUNCTION_URL, STORAGE_PUBLIC_URL } from '../src/data/config';

// Contenu base64 d'un faible nombre d'octets (4 octets -> « AAAAAA== » ne
// convient pas ; on fabrique des chaînes de longueur connue).
function base64OfSize(bytes: number): string {
  // 3 octets = 4 caractères base64 ; on arrondit au multiple de 3 inférieur.
  return 'A'.repeat(Math.floor(bytes / 3) * 4);
}

function codeOf(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return isImageServiceError(error) ? error.code : 'autre';
  }
}

describe('base64ByteLength', () => {
  test('calcule la taille décodée avec ou sans padding', () => {
    expect(base64ByteLength('')).toBe(0);
    expect(base64ByteLength('QUJD')).toBe(3); // "ABC"
    expect(base64ByteLength('QUI=')).toBe(2); // "AB"
    expect(base64ByteLength('QQ==')).toBe(1); // "A"
    expect(base64ByteLength('QU JD\n')).toBe(3);
  });
});

describe('validatePhoto', () => {
  test('accepte JPEG, PNG et WebP de taille raisonnable', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(codeOf(() => validatePhoto({ base64: 'QUJD', contentType: type }))).toBeNull();
    }
  });

  test('refuse un format non supporté', () => {
    expect(
      codeOf(() => validatePhoto({ base64: 'QUJD', contentType: 'image/gif' })),
    ).toBe('invalidFormat');
  });

  test('refuse une image vide', () => {
    expect(
      codeOf(() => validatePhoto({ base64: '', contentType: 'image/jpeg' })),
    ).toBe('emptyFile');
  });

  test('refuse une image de plus de 5 Mo, accepte juste en dessous', () => {
    expect(
      codeOf(() =>
        validatePhoto({
          base64: base64OfSize(MAX_IMAGE_BYTES + 6),
          contentType: 'image/jpeg',
        }),
      ),
    ).toBe('fileTooLarge');
    expect(
      codeOf(() =>
        validatePhoto({
          base64: base64OfSize(MAX_IMAGE_BYTES - 6),
          contentType: 'image/jpeg',
        }),
      ),
    ).toBeNull();
  });
});

describe('buildFileName', () => {
  test('img_<horodatage>_<index>.<extension>', () => {
    expect(buildFileName('image/jpeg', 0, 1700000000000)).toBe(
      'img_1700000000000_0.jpg',
    );
    expect(buildFileName('image/png', 2, 5)).toBe('img_5_2.png');
    expect(buildFileName('image/webp', 1, 5)).toBe('img_5_1.webp');
  });
});

describe('parseUploadResponse (protocole de l’Edge Function)', () => {
  test('200 : renvoie l’URL publique', () => {
    expect(parseUploadResponse(200, JSON.stringify({ url: 'https://x/y.jpg' }))).toBe(
      'https://x/y.jpg',
    );
  });

  test('200 sans URL ou corps invalide : erreur serveur', () => {
    expect(codeOf(() => parseUploadResponse(200, '{}'))).toBe('serverError');
    expect(codeOf(() => parseUploadResponse(200, 'pas du json'))).toBe(
      'serverError',
    );
  });

  test('401 / 403 / 413', () => {
    expect(codeOf(() => parseUploadResponse(401, ''))).toBe('unauthenticated');
    expect(codeOf(() => parseUploadResponse(403, ''))).toBe('forbidden');
    expect(codeOf(() => parseUploadResponse(413, ''))).toBe('fileTooLarge');
  });

  test('autre statut : message avec le détail serveur', () => {
    try {
      parseUploadResponse(500, JSON.stringify({ error: 'Upload failed' }));
      throw new Error('aurait dû lever');
    } catch (error) {
      expect(isImageServiceError(error)).toBe(true);
      if (isImageServiceError(error)) {
        expect(error.message).toContain('500');
        expect(error.message).toContain('Upload failed');
      }
    }
  });
});

describe('URLs du bucket', () => {
  test('isSupabaseUrl et extractStoragePath', () => {
    const url = `${STORAGE_PUBLIC_URL}/uuid-img_1.jpg`;
    expect(isSupabaseUrl(url)).toBe(true);
    expect(extractStoragePath(url)).toBe('uuid-img_1.jpg');
    expect(isSupabaseUrl('https://firebasestorage.googleapis.com/x.jpg')).toBe(
      false,
    );
    expect(extractStoragePath('https://autre.tn/x.jpg')).toBeNull();
  });
});

describe('uploadPhotos', () => {
  test('envoie chaque photo avec le jeton Firebase et renvoie les URLs dans l’ordre', async () => {
    const calls: Array<{ url: string; init: any }> = [];
    const fetchImpl = async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        status: 200,
        text: async () =>
          JSON.stringify({ url: `${STORAGE_PUBLIC_URL}/p${calls.length}.jpg` }),
      };
    };
    let tokens = 0;
    const progress: Array<[number, number]> = [];
    const urls = await uploadPhotos({
      listingId: 'L1',
      photos: [
        { base64: 'QUJD', contentType: 'image/jpeg' },
        { base64: 'QUJD', contentType: 'image/png' },
      ],
      getToken: async () => `jeton-${++tokens}`,
      onProgress: (done, total) => progress.push([done, total]),
      fetchImpl,
    });
    expect(urls).toEqual([
      `${STORAGE_PUBLIC_URL}/p1.jpg`,
      `${STORAGE_PUBLIC_URL}/p2.jpg`,
    ]);
    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ]);
    expect(tokens).toBe(2); // jeton renouvelé à chaque envoi
    expect(calls[0].url).toBe(EDGE_FUNCTION_URL);
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers.Authorization).toBe('Bearer jeton-1');
    const body = JSON.parse(calls[0].init.body);
    expect(body.listingId).toBe('L1');
    expect(body.fileBase64).toBe('QUJD');
    expect(body.contentType).toBe('image/jpeg');
    expect(body.fileName).toMatch(/^img_\d+_0\.jpg$/);
  });

  test('s’arrête à la première erreur serveur', async () => {
    const fetchImpl = async () => ({ status: 403, text: async () => '' });
    let failure: unknown = null;
    try {
      await uploadPhotos({
        listingId: 'L1',
        photos: [{ base64: 'QUJD', contentType: 'image/jpeg' }],
        getToken: async () => 'jeton',
        fetchImpl,
      });
    } catch (error) {
      failure = error;
    }
    expect(isImageServiceError(failure)).toBe(true);
    expect(isImageServiceError(failure) && failure.code).toBe('forbidden');
  });

  test('erreur réseau et absence de jeton', async () => {
    let networkFailure: unknown = null;
    try {
      await uploadPhotos({
        listingId: 'L1',
        photos: [{ base64: 'QUJD', contentType: 'image/jpeg' }],
        getToken: async () => 'jeton',
        fetchImpl: async () => {
          throw new Error('coupure');
        },
      });
    } catch (error) {
      networkFailure = error;
    }
    expect(isImageServiceError(networkFailure) && networkFailure.code).toBe(
      'networkError',
    );

    let authFailure: unknown = null;
    try {
      await uploadPhotos({
        listingId: 'L1',
        photos: [{ base64: 'QUJD', contentType: 'image/jpeg' }],
        getToken: async () => null,
        fetchImpl: async () => ({ status: 200, text: async () => '{}' }),
      });
    } catch (error) {
      authFailure = error;
    }
    expect(isImageServiceError(authFailure) && authFailure.code).toBe(
      'unauthenticated',
    );
  });

  test('n’envoie rien si une photo est invalide', async () => {
    let called = false;
    let failure: unknown = null;
    try {
      await uploadPhotos({
        listingId: 'L1',
        photos: [{ base64: 'QUJD', contentType: 'application/pdf' }],
        getToken: async () => 'jeton',
        fetchImpl: async () => {
          called = true;
          return { status: 200, text: async () => '{}' };
        },
      });
    } catch (error) {
      failure = error;
    }
    expect(called).toBe(false);
    expect(isImageServiceError(failure) && failure.code).toBe('invalidFormat');
  });
});

describe('deletePhotos', () => {
  test('envoie DELETE avec les chemins des seules images Supabase', async () => {
    const calls: Array<{ url: string; init: any }> = [];
    await deletePhotos(
      [`${STORAGE_PUBLIC_URL}/a.jpg`, 'https://ailleurs.tn/b.jpg'],
      async () => 'jeton',
      async (url: string, init: any) => {
        calls.push({ url, init });
        return { status: 200, text: async () => '{}' };
      },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].init.method).toBe('DELETE');
    expect(JSON.parse(calls[0].init.body)).toEqual({ paths: ['a.jpg'] });
  });

  test('ne fait aucun appel sans image Supabase et n’échoue jamais', async () => {
    let called = false;
    await deletePhotos(
      ['https://ailleurs.tn/b.jpg'],
      async () => 'jeton',
      async () => {
        called = true;
        return { status: 200, text: async () => '{}' };
      },
    );
    expect(called).toBe(false);
    await deletePhotos(
      [`${STORAGE_PUBLIC_URL}/a.jpg`],
      async () => 'jeton',
      async () => {
        throw new Error('hors ligne');
      },
    );
  });
});
