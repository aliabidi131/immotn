import 'package:cloud_firestore/cloud_firestore.dart';

/// Valeurs du document de conception (entité Annonce) et des règles Firestore.
const String statutActive = 'active';
const String statutVendue = 'vendue';
const String statutMasquee = 'masquee';

/// Valeur de `proprietaireId` des annonces de démonstration (fictives).
const String demoOwnerId = 'DEMO';

const Map<String, String> transactionLabels = {
  'vente': 'Vente',
  'location': 'Location',
};

const Map<String, String> typeBienLabels = {
  'appartement': 'Appartement',
  'maison': 'Maison',
  'villa': 'Villa',
  'terrain': 'Terrain',
  'local': 'Local commercial',
};

const Map<String, String> statutLabels = {
  statutActive: 'Active',
  statutVendue: 'Vendue',
  statutMasquee: 'Masquée',
};

String transactionLabel(String value) => transactionLabels[value] ?? value;

String typeBienLabel(String value) => typeBienLabels[value] ?? value;

/// Ex. 125000 -> « 125 000 TND ».
String formatPrice(num value) {
  final digits = value.round().abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    buffer.write(digits[i]);
    final remainingAfter = digits.length - i - 1;
    if (remainingAfter > 0 && remainingAfter % 3 == 0) buffer.write(' ');
  }
  return '$buffer TND';
}

/// Affiche 120 et non 120.0.
String formatQuantity(num value) =>
    value % 1 == 0 ? value.toInt().toString() : value.toString();

String formatDate(DateTime date) {
  final day = date.day.toString().padLeft(2, '0');
  final month = date.month.toString().padLeft(2, '0');
  return '$day/$month/${date.year}';
}

class Listing {
  const Listing({
    required this.id,
    required this.titre,
    required this.description,
    required this.typeTransaction,
    required this.typeBien,
    required this.prix,
    required this.surface,
    required this.nombrePieces,
    required this.ville,
    required this.adresse,
    required this.photos,
    required this.statut,
    required this.proprietaireId,
    this.latitude,
    this.longitude,
    this.dateCreation,
  });

  final String id;
  final String titre;
  final String description;
  final String typeTransaction;
  final String typeBien;
  final num prix;
  final num surface;
  final int nombrePieces;
  final String ville;
  final String adresse;
  final List<String> photos;
  final String statut;
  final String proprietaireId;
  final double? latitude;
  final double? longitude;
  final DateTime? dateCreation;

  bool get hasLocation => latitude != null && longitude != null;
  bool get isActive => statut == statutActive;
  bool get isDemo => proprietaireId == demoOwnerId;
  String get coverPhoto => photos.isEmpty ? '' : photos.first;

  /// Lit un document Firestore. Tolère les champs absents des anciennes
  /// annonces (adresse, photos, coordonnées) au lieu de planter.
  factory Listing.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    final created = data['dateCreation'];
    return Listing(
      id: doc.id,
      titre: data['titre'] as String? ?? 'Sans titre',
      description: data['description'] as String? ?? '',
      typeTransaction: data['typeTransaction'] as String? ?? 'vente',
      typeBien: data['typeBien'] as String? ?? '',
      prix: data['prix'] as num? ?? 0,
      surface: data['surface'] as num? ?? 0,
      nombrePieces: (data['nombrePieces'] as num?)?.toInt() ?? 0,
      ville: data['ville'] as String? ?? '',
      adresse: data['adresse'] as String? ?? '',
      photos: (data['photos'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<String>()
          .toList(),
      statut: data['statut'] as String? ?? statutActive,
      proprietaireId: data['proprietaireId'] as String? ?? '',
      latitude: (data['latitude'] as num?)?.toDouble(),
      longitude: (data['longitude'] as num?)?.toDouble(),
      dateCreation: created is Timestamp ? created.toDate() : null,
    );
  }
}

/// Critères de recherche. La recherche textuelle est gérée par l'écran.
class ListingFilters {
  const ListingFilters({
    this.transaction = 'tous',
    this.typeBien,
    this.minPrice,
    this.maxPrice,
    this.minSurface,
    this.minRooms,
    this.city = '',
  });

  final String transaction;
  final String? typeBien;
  final num? minPrice;
  final num? maxPrice;
  final num? minSurface;
  final int? minRooms;
  final String city;

  bool get isEmpty =>
      transaction == 'tous' &&
      typeBien == null &&
      minPrice == null &&
      maxPrice == null &&
      minSurface == null &&
      minRooms == null &&
      city.isEmpty;

  ListingFilters withTypeBien(String? value) => ListingFilters(
        transaction: transaction,
        typeBien: value,
        minPrice: minPrice,
        maxPrice: maxPrice,
        minSurface: minSurface,
        minRooms: minRooms,
        city: city,
      );

  bool matches(Listing listing) {
    if (transaction != 'tous' && listing.typeTransaction != transaction) {
      return false;
    }
    final type = typeBien;
    if (type != null && listing.typeBien != type) return false;
    final minP = minPrice;
    if (minP != null && listing.prix < minP) return false;
    final maxP = maxPrice;
    if (maxP != null && listing.prix > maxP) return false;
    final minS = minSurface;
    if (minS != null && listing.surface < minS) return false;
    final minR = minRooms;
    if (minR != null && listing.nombrePieces < minR) return false;
    if (city.isNotEmpty &&
        !listing.ville.toLowerCase().contains(city.toLowerCase())) {
      return false;
    }
    return true;
  }
}
