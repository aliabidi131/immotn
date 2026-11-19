import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart' show ValueNotifier;

import 'demo_data.dart';
import 'listing_model.dart';
import 'services/image_service.dart';

export 'services/image_service.dart' show ImageToUpload;

/// Photo prête à être envoyée (déjà compressée par le sélecteur d'image).
/// Alias conservé pour ne pas casser publish_listing_screen.dart.
typedef PhotoFile = ImageToUpload;

class ListingPage {
  const ListingPage({
    required this.items,
    required this.lastDoc,
    required this.hasMore,
  });

  final List<Listing> items;
  final DocumentSnapshot<Map<String, dynamic>>? lastDoc;
  final bool hasMore;
}

class ListingRepository {
  const ListingRepository._();

  static FirebaseFirestore get _db => FirebaseFirestore.instance;

  static CollectionReference<Map<String, dynamic>> get _listings =>
      _db.collection('listings');

  static CollectionReference<Map<String, dynamic>> _favorites(String uid) =>
      _db.collection('favorites').doc(uid).collection('user_favorites');

  /// Incrémenté après une modification d'annonce : les écrans qui ont chargé
  /// leur liste une seule fois (accueil) l'écoutent pour se rafraîchir.
  static final ValueNotifier<int> revision = ValueNotifier<int>(0);

  static Query<Map<String, dynamic>> _activeQuery() => _listings
      .where('statut', isEqualTo: statutActive)
      .orderBy('dateCreation', descending: true);

  // ---------------------------------------------------------------- Annonces

  /// Page d'annonces actives (pagination par curseur).
  static Future<ListingPage> fetchActivePage({
    DocumentSnapshot<Map<String, dynamic>>? after,
    int pageSize = 20,
  }) async {
    var query = _activeQuery().limit(pageSize);
    if (after != null) query = query.startAfterDocument(after);
    final snapshot = await query.get();
    final docs = snapshot.docs;
    return ListingPage(
      items: docs.map(Listing.fromDoc).toList(),
      lastDoc: docs.isEmpty ? null : docs.last,
      hasMore: docs.length == pageSize,
    );
  }

  /// Flux temps réel des annonces actives (utilisé par la carte).
  static Stream<List<Listing>> activeListings() => _activeQuery()
      .snapshots()
      .map((snapshot) => snapshot.docs.map(Listing.fromDoc).toList());

  /// Annonces publiées par un utilisateur, tous statuts confondus.
  static Stream<List<Listing>> myListings(String uid) => _listings
      .where('proprietaireId', isEqualTo: uid)
      .orderBy('dateCreation', descending: true)
      .snapshots()
      .map((snapshot) => snapshot.docs.map(Listing.fromDoc).toList());

  /// Crée l'annonce :
  ///  1. Génère un ID Firestore local (sans écriture réseau).
  ///  2. Envoie les photos via Supabase Storage (Edge Function sécurisée).
  ///     L'Edge Function accepte un listingId qui n'existe pas encore en DB
  ///     car le propriétaire est l'utilisateur authentifié lui-même.
  ///  3. Écrit le document final en une seule opération avec statut 'active'
  ///     et les URLs — ce qui respecte la règle Firestore (statut == 'active').
  ///
  /// Si l'upload Supabase échoue, aucun document n'est créé dans Firestore.
  static Future<String> createListing({
    required String ownerId,
    required Map<String, dynamic> data,
    required List<PhotoFile> photos,
    void Function(int done, int total)? onProgress,
  }) async {
    // Génère l'ID localement — pas d'écriture Firestore avant la fin de l'upload.
    final ref = _listings.doc();

    // 1. Upload des photos (l'Edge Function vérifie le Firebase ID Token).
    final urls = await ImageService.uploadAll(
      listingId: ref.id,
      photos: photos,
      onProgress: onProgress,
    );

    // 2. Écriture unique du document avec statut 'active' et photos.
    //    Conforme à la règle Firestore : statut == 'active' à la création.
    await ref.set({
      ...data,
      'photos': urls,
      'proprietaireId': ownerId,
      'statut': statutActive,
      'dateCreation': FieldValue.serverTimestamp(),
    });

    return ref.id;
  }

  static Future<void> updateStatus(String listingId, String statut) =>
      _listings.doc(listingId).update({'statut': statut});

  /// Suit une annonce en temps réel (`null` si elle n'existe plus).
  static Stream<Listing?> watchListing(String id) => _listings
      .doc(id)
      .snapshots()
      .map((doc) => doc.exists ? Listing.fromDoc(doc) : null);

  /// Modifie une annonce de l'utilisateur connecté.
  ///
  ///  1. Envoie d'abord les nouvelles photos : en cas d'échec, l'annonce reste
  ///     intacte.
  ///  2. Met à jour le document (champs autorisés par les règles Firestore).
  ///  3. Supprime les photos retirées, sans bloquer si le stockage échoue.
  static Future<void> updateListing({
    required Listing listing,
    required Map<String, dynamic> data,
    required List<String> keptPhotos,
    required List<PhotoFile> newPhotos,
    bool removeLocation = false,
    void Function(int done, int total)? onProgress,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null || user.uid != listing.proprietaireId) {
      throw Exception('Vous n\'êtes pas propriétaire de cette annonce.');
    }

    final uploaded = newPhotos.isEmpty
        ? <String>[]
        : await ImageService.uploadAll(
            listingId: listing.id,
            photos: newPhotos,
            onProgress: onProgress,
          );

    await _listings.doc(listing.id).update({
      ...data,
      if (removeLocation) ...{
        'latitude': FieldValue.delete(),
        'longitude': FieldValue.delete(),
      },
      'photos': [...keptPhotos, ...uploaded],
    });
    revision.value++;

    final removed =
        listing.photos.where((url) => !keptPhotos.contains(url)).toList();
    unawaited(_deleteImages(listing.proprietaireId, removed));
  }

  /// Nettoyage des photos retirées d'une annonce (erreurs ignorées).
  static Future<void> _deleteImages(String ownerId, List<String> urls) async {
    final supabaseUrls = urls.where(ImageService.isSupabaseUrl).toList();
    if (supabaseUrls.isNotEmpty) {
      try {
        await ImageService.deleteListingImages(
          ownerId: ownerId,
          imageUrls: supabaseUrls,
        );
      } catch (_) {}
    }
    for (final url in urls) {
      if (!ImageService.isSupabaseUrl(url)) {
        try {
          await FirebaseStorage.instance.refFromURL(url).delete();
        } catch (_) {}
      }
    }
  }

  /// Supprime le document Firestore puis les images Supabase associées.
  ///
  /// La suppression des images est effectuée APRÈS confirmation de la
  /// suppression Firestore pour ne jamais laisser des images sans annonce,
  /// mais aussi pour ne pas bloquer si le storage échoue.
  static Future<void> deleteListing(Listing listing) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null || user.uid != listing.proprietaireId) {
      throw Exception('Vous n\'êtes pas propriétaire de cette annonce.');
    }

    // 1. Supprime le document en premier.
    await _listings.doc(listing.id).delete();

    // 2. Supprime les images depuis Supabase Storage.
    //    Les erreurs sont ignorées (nettoyage non bloquant).
    final supabasePhotos =
        listing.photos.where(ImageService.isSupabaseUrl).toList();
    if (supabasePhotos.isNotEmpty) {
      try {
        await ImageService.deleteListingImages(
          ownerId: listing.proprietaireId,
          imageUrls: supabasePhotos,
        );
      } catch (_) {
        // Non bloquant : les images seront nettoyées manuellement si besoin.
      }
    }

    // 3. Nettoie également les éventuelles anciennes URLs Firebase Storage
    //    (migration depuis l'ancienne implémentation).
    for (final url in listing.photos) {
      if (!ImageService.isSupabaseUrl(url)) {
        try {
          await FirebaseStorage.instance.refFromURL(url).delete();
        } catch (_) {}
      }
    }
  }

  // ---------------------------------------------------------------- Favoris

  static Stream<List<String>> favoriteIds(String uid) => _favorites(uid)
      .snapshots()
      .map((snapshot) => snapshot.docs.map((doc) => doc.id).toList());

  static Stream<bool> isFavorite(String uid, String listingId) =>
      _favorites(uid).doc(listingId).snapshots().map((doc) => doc.exists);

  static Future<void> setFavorite(
    String uid,
    String listingId,
    bool favorite,
  ) {
    final ref = _favorites(uid).doc(listingId);
    return favorite
        ? ref.set({'listingId': listingId})
        : ref.delete();
  }

  /// Charge les favoris un par un. Ignore les annonces supprimées, masquées
  /// ou non accessibles, sans faire échouer toute la liste.
  static Future<List<Listing>> fetchListingsByIds(List<String> ids) async {
    // Les annonces de démonstration vivent en mémoire, pas dans Firestore.
    final demos = ids.map(DemoDataService.byId).whereType<Listing>().toList();
    final realIds = ids.where((id) => DemoDataService.byId(id) == null);
    final docs = await Future.wait(realIds.map((id) async {
      try {
        return await _listings.doc(id).get();
      } catch (_) {
        return null;
      }
    }));
    final listings = <Listing>[];
    for (final doc in docs) {
      if (doc != null && doc.exists) {
        final listing = Listing.fromDoc(doc);
        if (listing.isActive) listings.add(listing);
      }
    }
    return [...listings, ...demos];
  }

  // ---------------------------------------------------------------- Profil

  static Stream<DocumentSnapshot<Map<String, dynamic>>> userProfile(
    String uid,
  ) =>
      _db.collection('users').doc(uid).snapshots();

  static Future<void> updateProfile(
    String uid, {
    required String nom,
    required String telephone,
    String? photoUrl,
  }) {
    final data = <String, dynamic>{
      'nom': nom,
      'telephone': telephone,
    };
    if (photoUrl != null) data['photoUrl'] = photoUrl;
    return _db.collection('users').doc(uid).update(data);
  }

  /// La photo de profil reste sur Firebase Storage (pas d'annonce associée).
  static Future<String> uploadProfilePhoto(String uid, PhotoFile photo) =>
      _uploadToFirebase('users/$uid/profile.jpg', photo);

  // ---------------------------------------------------------------- Interne

  /// Upload vers Firebase Storage (profil uniquement).
  static Future<String> _uploadToFirebase(
    String path,
    PhotoFile photo,
  ) async {
    final ref = FirebaseStorage.instance.ref(path);
    await ref.putData(
      photo.bytes,
      SettableMetadata(contentType: photo.contentType),
    );
    return ref.getDownloadURL();
  }
}

/// Exception générique pour les erreurs d'upload Supabase.
/// Conservé pour la compatibilité avec publish_listing_screen.dart.
class SupabaseException implements Exception {
  final String message;
  const SupabaseException(this.message);
  @override
  String toString() => message;
}
