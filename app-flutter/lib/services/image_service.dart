import 'dart:convert';
import 'dart:typed_data';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:http/http.dart' as http;

/// Formats d'image acceptés (correspondance Content-Type → extension).
const Map<String, String> _allowedTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/// Taille maximale autorisée avant envoi à l'Edge Function (5 Mo).
const int _maxSizeBytes = 5 * 1024 * 1024;

/// URL de l'Edge Function Supabase.
const String _edgeFunctionUrl =
    'https://sjtsymnbacouhpwyhcre.supabase.co/functions/v1/process-image';

/// URL publique du bucket (pour construire des chemins de suppression).
const String _storageUrl =
    'https://sjtsymnbacouhpwyhcre.supabase.co/storage/v1/object/public/property-images';

/// Service dédié à la gestion des images d'annonces via Supabase Storage.
///
/// Toutes les opérations d'upload passent par l'Edge Function `process-image`
/// qui vérifie le Firebase ID Token côté serveur. La service_role_key ne
/// quitte jamais le serveur.
class ImageService {
  const ImageService._();

  // ---------------------------------------------------------------- Upload

  /// Envoie [photos] vers Supabase Storage via l'Edge Function.
  ///
  /// - Valide le format et la taille avant l'envoi.
  /// - Compresse l'image si elle dépasse [_maxSizeBytes].
  /// - Retourne la liste des Public URLs dans l'ordre d'envoi.
  /// - [onProgress] est appelé après chaque upload réussi.
  ///
  /// Lance [ImageServiceException] en cas d'erreur récupérable.
  static Future<List<String>> uploadAll({
    required String listingId,
    required List<ImageToUpload> photos,
    void Function(int done, int total)? onProgress,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      throw const ImageServiceException(
        'Utilisateur non connecté.',
        code: ImageErrorCode.unauthenticated,
      );
    }

    final urls = <String>[];
    for (var i = 0; i < photos.length; i++) {
      final photo = photos[i];
      final validated = await _validateAndCompress(photo);
      final url = await _uploadOne(
        user: user,
        listingId: listingId,
        photo: validated,
        index: i,
      );
      urls.add(url);
      onProgress?.call(i + 1, photos.length);
    }
    return urls;
  }

  // ---------------------------------------------------------------- Suppression

  /// Supprime les images d'une annonce depuis Supabase Storage.
  ///
  /// La suppression est effectuée seulement si l'utilisateur courant est
  /// [ownerId]. Ne lève pas d'exception si une image est déjà absente.
  static Future<void> deleteListingImages({
    required String ownerId,
    required List<String> imageUrls,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    if (user.uid != ownerId) {
      throw const ImageServiceException(
        'Vous n\'êtes pas propriétaire de cette annonce.',
        code: ImageErrorCode.forbidden,
      );
    }

    final idToken = await user.getIdToken(true);
    if (idToken == null) return;

    // Extrait les chemins relatifs des URLs publiques.
    final paths = imageUrls
        .map(_extractPath)
        .whereType<String>()
        .toList();

    if (paths.isEmpty) return;

    // Appelle l'Edge Function avec l'action "delete".
    // Si l'Edge Function n'est pas encore déployée, on échoue silencieusement
    // (les images restent dans le bucket jusqu'au prochain nettoyage manuel).
    try {
      await http.delete(
        Uri.parse(_edgeFunctionUrl),
        headers: {
          'Authorization': 'Bearer $idToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'paths': paths}),
      );
    } catch (_) {
      // Suppression non bloquante : on ne veut pas empêcher la suppression
      // du document Firestore si le storage échoue.
    }
  }

  // ---------------------------------------------------------------- Validation

  /// Vérifie format et taille, compresse si nécessaire.
  static Future<ImageToUpload> _validateAndCompress(
    ImageToUpload photo,
  ) async {
    if (!_allowedTypes.containsKey(photo.contentType)) {
      throw ImageServiceException(
        'Format non supporté : ${photo.contentType}. '
        'Utilisez JPEG, PNG ou WebP.',
        code: ImageErrorCode.invalidFormat,
      );
    }

    var bytes = photo.bytes;

    // Compression si l'image dépasse la limite.
    if (bytes.length > _maxSizeBytes) {
      final compressed = await FlutterImageCompress.compressWithList(
        bytes,
        quality: 70,
        minWidth: 1024,
        minHeight: 1024,
        keepExif: false,
      );
      bytes = Uint8List.fromList(compressed);
    }

    if (bytes.length > _maxSizeBytes) {
      throw const ImageServiceException(
        'L\'image dépasse la limite de 5 Mo même après compression.',
        code: ImageErrorCode.fileTooLarge,
      );
    }

    if (bytes.isEmpty) {
      throw const ImageServiceException(
        'L\'image est vide.',
        code: ImageErrorCode.emptyFile,
      );
    }

    return ImageToUpload(bytes: bytes, contentType: photo.contentType);
  }

  // ---------------------------------------------------------------- Upload unitaire

  static Future<String> _uploadOne({
    required User user,
    required String listingId,
    required ImageToUpload photo,
    required int index,
  }) async {
    // Renouvelle le token à chaque upload pour éviter l'expiration sur une
    // longue série de photos.
    final idToken = await user.getIdToken(true);
    if (idToken == null) {
      throw const ImageServiceException(
        'Impossible d\'obtenir le jeton d\'authentification.',
        code: ImageErrorCode.unauthenticated,
      );
    }

    final ext = _allowedTypes[photo.contentType] ?? 'jpg';
    final fileName =
        'img_${DateTime.now().millisecondsSinceEpoch}_$index.$ext';

    http.Response response;
    try {
      response = await http
          .post(
            Uri.parse(_edgeFunctionUrl),
            headers: {
              'Authorization': 'Bearer $idToken',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({
              'listingId': listingId,
              'fileBase64': base64Encode(photo.bytes),
              'fileName': fileName,
              'contentType': photo.contentType,
            }),
          )
          .timeout(const Duration(seconds: 30));
    } on Exception catch (e) {
      throw ImageServiceException(
        'Erreur réseau : $e',
        code: ImageErrorCode.networkError,
      );
    }

    return _parseResponse(response);
  }

  static String _parseResponse(http.Response response) {
    switch (response.statusCode) {
      case 200:
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final url = data['url'] as String?;
        if (url == null || url.isEmpty) {
          throw const ImageServiceException(
            'L\'Edge Function n\'a retourné aucune URL.',
            code: ImageErrorCode.serverError,
          );
        }
        return url;
      case 401:
        throw const ImageServiceException(
          'Authentification requise. Reconnectez-vous.',
          code: ImageErrorCode.unauthenticated,
        );
      case 403:
        throw const ImageServiceException(
          'Accès refusé à cette annonce.',
          code: ImageErrorCode.forbidden,
        );
      case 413:
        throw const ImageServiceException(
          'Le fichier dépasse la limite de 5 Mo.',
          code: ImageErrorCode.fileTooLarge,
        );
      default:
        String detail = '';
        try {
          detail =
              (jsonDecode(response.body) as Map<String, dynamic>)['error']
                  ?.toString() ??
              '';
        } catch (_) {}
        throw ImageServiceException(
          'Upload échoué (${response.statusCode}) : $detail',
          code: ImageErrorCode.serverError,
        );
    }
  }

  // ---------------------------------------------------------------- Utilitaires

  /// Extrait le chemin relatif d'une URL publique Supabase.
  /// Ex: https://.../property-images/uuid-img.jpg → uuid-img.jpg
  static String? _extractPath(String url) {
    if (!url.startsWith(_storageUrl)) return null;
    final path = url.substring(_storageUrl.length);
    return path.startsWith('/') ? path.substring(1) : path;
  }

  /// Vérifie qu'une URL appartient bien au bucket Supabase `property-images`.
  static bool isSupabaseUrl(String url) => url.startsWith(_storageUrl);
}

// ---------------------------------------------------------------- Modèles

/// Image prête à être envoyée.
class ImageToUpload {
  const ImageToUpload({required this.bytes, required this.contentType});

  final Uint8List bytes;
  final String contentType;
}

// ---------------------------------------------------------------- Erreurs

enum ImageErrorCode {
  unauthenticated,
  forbidden,
  invalidFormat,
  fileTooLarge,
  emptyFile,
  networkError,
  serverError,
}

class ImageServiceException implements Exception {
  const ImageServiceException(this.message, {required this.code});

  final String message;
  final ImageErrorCode code;

  @override
  String toString() => message;
}
