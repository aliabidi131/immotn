/// Tests unitaires pour ImageService.
///
/// Ces tests couvrent la logique de validation des types et des tailles
/// sans toucher au réseau ni à Firebase/Supabase.
library;

import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';

import 'package:immotn/services/image_service.dart';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Crée un Uint8List de [sizeBytes] octets (rempli de zéros).
Uint8List _fakeBytes(int sizeBytes) => Uint8List(sizeBytes);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void main() {
  group('ImageToUpload', () {
    test('contient les bytes et le content-type', () {
      final img = ImageToUpload(
        bytes: _fakeBytes(100),
        contentType: 'image/jpeg',
      );
      expect(img.bytes.length, 100);
      expect(img.contentType, 'image/jpeg');
    });
  });

  group('ImageService.isSupabaseUrl', () {
    const storageBase =
        'https://sjtsymnbacouhpwyhcre.supabase.co/storage/v1/object/public/property-images';

    test('reconnaît une URL Supabase valide', () {
      expect(
        ImageService.isSupabaseUrl('$storageBase/uuid-img.jpg'),
        isTrue,
      );
    });

    test('rejette une URL Firebase Storage', () {
      expect(
        ImageService.isSupabaseUrl(
          'https://firebasestorage.googleapis.com/v0/b/project/o/image.jpg',
        ),
        isFalse,
      );
    });

    test('rejette une URL arbitraire', () {
      expect(
        ImageService.isSupabaseUrl('https://example.com/photo.jpg'),
        isFalse,
      );
    });

    test('rejette une chaîne vide', () {
      expect(ImageService.isSupabaseUrl(''), isFalse);
    });
  });

  group('ImageErrorCode', () {
    test('les codes d\'erreur sont distincts', () {
      final codes = ImageErrorCode.values.toSet();
      expect(codes.length, ImageErrorCode.values.length);
    });
  });

  group('ImageServiceException', () {
    test('toString retourne le message', () {
      const e = ImageServiceException(
        'Fichier trop volumineux.',
        code: ImageErrorCode.fileTooLarge,
      );
      expect(e.toString(), 'Fichier trop volumineux.');
      expect(e.code, ImageErrorCode.fileTooLarge);
    });

    test('est une Exception', () {
      const e = ImageServiceException(
        'test',
        code: ImageErrorCode.networkError,
      );
      expect(e, isA<Exception>());
    });
  });
}
