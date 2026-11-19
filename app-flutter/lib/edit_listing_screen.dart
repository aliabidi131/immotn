import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';

import 'app_theme.dart';
import 'listing_model.dart';
import 'listing_repository.dart';
import 'listing_validation.dart';
import 'services/image_service.dart';

const int _maxPhotos = 8;

/// Délai maximal avant d'annoncer un blocage (réseau ou configuration).
const Duration _saveTimeout = Duration(seconds: 45);

/// Ouvre l'écran de modification d'une annonce de l'utilisateur connecté.
Future<void> openEditListing(BuildContext context, Listing listing) async {
  final saved = await Navigator.of(context).push<bool>(
    MaterialPageRoute<bool>(
      builder: (_) => EditListingScreen(listing: listing),
    ),
  );
  if (saved == true && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Annonce modifiée avec succès.')),
    );
  }
}

/// Modification d'une annonce existante. Réservé au propriétaire : les règles
/// Firestore refusent aussi toute modification par un autre compte.
class EditListingScreen extends StatefulWidget {
  const EditListingScreen({required this.listing, super.key});

  final Listing listing;

  @override
  State<EditListingScreen> createState() => _EditListingScreenState();
}

class _EditListingScreenState extends State<EditListingScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _prix;
  late final TextEditingController _ville;
  late final TextEditingController _titre;
  late final TextEditingController _description;
  late final TextEditingController _surface;
  late final TextEditingController _pieces;
  late final TextEditingController _adresse;

  late String _transaction;
  late String _typeBien;
  late final List<String> _existingPhotos;
  final List<PhotoFile> _newPhotos = [];
  double? _latitude;
  double? _longitude;
  bool _locating = false;
  bool _saving = false;
  String _progress = '';
  String? _error;

  @override
  void initState() {
    super.initState();
    final listing = widget.listing;
    _prix = TextEditingController(text: formatQuantity(listing.prix));
    _ville = TextEditingController(text: listing.ville);
    _titre = TextEditingController(text: listing.titre);
    _description = TextEditingController(text: listing.description);
    _surface = TextEditingController(text: formatQuantity(listing.surface));
    _pieces = TextEditingController(text: '${listing.nombrePieces}');
    _adresse = TextEditingController(text: listing.adresse);
    _transaction = transactionLabels.containsKey(listing.typeTransaction)
        ? listing.typeTransaction
        : 'vente';
    _typeBien = typeBienLabels.containsKey(listing.typeBien)
        ? listing.typeBien
        : 'appartement';
    _existingPhotos = List<String>.of(listing.photos);
    _latitude = listing.latitude;
    _longitude = listing.longitude;
  }

  @override
  void dispose() {
    for (final controller in [
      _prix,
      _ville,
      _titre,
      _description,
      _surface,
      _pieces,
      _adresse,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  int get _photoCount => _existingPhotos.length + _newPhotos.length;

  Future<void> _pickPhotos() async {
    final remaining = _maxPhotos - _photoCount;
    if (remaining <= 0) return;
    try {
      final picked = await ImagePicker().pickMultiImage(
        imageQuality: 80,
        maxWidth: 1600,
        maxHeight: 1600,
      );
      final loaded = <PhotoFile>[];
      for (final file in picked.take(remaining)) {
        loaded.add(PhotoFile(
          bytes: await file.readAsBytes(),
          contentType: file.mimeType ?? 'image/jpeg',
        ));
      }
      if (!mounted) return;
      setState(() {
        _newPhotos.addAll(loaded);
        _error = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Impossible de charger les photos.');
    }
  }

  Future<void> _useMyPosition() async {
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw 'Activez la localisation sur l’appareil.';
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw 'Permission de localisation refusée.';
      }
      final position = await Geolocator.getCurrentPosition();
      if (!mounted) return;
      setState(() {
        _latitude = position.latitude;
        _longitude = position.longitude;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Position impossible : $error');
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _save() async {
    if (_saving) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_photoCount == 0) {
      setState(() => _error = 'Gardez au moins une photo du bien.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
      _progress = 'Enregistrement de l’annonce…';
    });
    try {
      final data = <String, dynamic>{
        'titre': _titre.text.trim(),
        'description': _description.text.trim(),
        'typeTransaction': _transaction,
        'typeBien': _typeBien,
        'prix': num.parse(_prix.text.trim()),
        'surface': num.parse(_surface.text.trim()),
        'nombrePieces': int.parse(_pieces.text.trim()),
        'ville': _ville.text.trim(),
        'adresse': _adresse.text.trim(),
      };
      final lat = _latitude;
      final lng = _longitude;
      // Position envoyée seulement si elle est réelle (jamais inventée).
      if (lat != null && lng != null) {
        data['latitude'] = lat;
        data['longitude'] = lng;
      }

      await ListingRepository.updateListing(
        listing: widget.listing,
        data: data,
        keptPhotos: List<String>.of(_existingPhotos),
        newPhotos: List<PhotoFile>.of(_newPhotos),
        removeLocation:
            (lat == null || lng == null) && widget.listing.hasLocation,
        onProgress: (done, total) {
          if (!mounted) return;
          setState(() => _progress = done < total
              ? 'Envoi des photos $done/$total…'
              : 'Enregistrement de l’annonce…');
        },
      ).timeout(
        _saveTimeout,
        onTimeout: () => throw TimeoutException('Délai dépassé'),
      );

      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on TimeoutException {
      if (!mounted) return;
      setState(() => _error =
          'Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.');
    } on ImageServiceException catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Erreur image : ${error.message}');
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Modification impossible : ${_describe(error)}');
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
          _progress = '';
        });
      }
    }
  }

  String _describe(Object error) {
    if (error is FirebaseException) return error.message ?? error.code;
    return error.toString();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Modifier l’annonce'),
        centerTitle: true,
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Label('Type de bien'),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final entry in typeBienLabels.entries)
                          ChoiceChip(
                            label: Text(entry.value),
                            selected: _typeBien == entry.key,
                            onSelected: _saving
                                ? null
                                : (_) => setState(() => _typeBien = entry.key),
                          ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    _Label('Transaction'),
                    SizedBox(
                      width: double.infinity,
                      child: SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'vente', label: Text('Vente')),
                          ButtonSegment(
                              value: 'location', label: Text('Location')),
                        ],
                        selected: {_transaction},
                        onSelectionChanged: _saving
                            ? null
                            : (selection) =>
                                setState(() => _transaction = selection.first),
                      ),
                    ),
                    const SizedBox(height: 20),
                    _Label('Prix (TND)'),
                    TextFormField(
                      controller: _prix,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.payments_outlined),
                      ),
                      validator: validatePositiveNumber,
                    ),
                    const SizedBox(height: 20),
                    _Label('Titre de l’annonce'),
                    TextFormField(
                      controller: _titre,
                      maxLength: 100,
                      validator: validateRequiredField,
                    ),
                    const SizedBox(height: 8),
                    _Label('Description'),
                    TextFormField(
                      controller: _description,
                      maxLength: 2000,
                      minLines: 3,
                      maxLines: 6,
                      validator: validateRequiredField,
                    ),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _surface,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Surface (m²)',
                            ),
                            validator: validatePositiveNumber,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextFormField(
                            controller: _pieces,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Pièces',
                            ),
                            validator: validateRoomCount,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    _Label('Localisation'),
                    TextFormField(
                      controller: _ville,
                      decoration: const InputDecoration(
                        labelText: 'Ville',
                        prefixIcon: Icon(Icons.place_outlined),
                      ),
                      validator: validateRequiredField,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _adresse,
                      decoration: const InputDecoration(
                        labelText: 'Adresse (facultatif)',
                        prefixIcon: Icon(Icons.map_outlined),
                      ),
                    ),
                    const SizedBox(height: 12),
                    _positionSection(theme),
                    const SizedBox(height: 20),
                    _photosSection(theme),
                  ],
                ),
              ),
            ),
          ),
          if (_error != null)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: theme.colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                _error!,
                style: TextStyle(color: theme.colorScheme.onErrorContainer),
              ),
            ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_saving && _progress.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(_progress, style: theme.textTheme.bodySmall),
                    ),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed:
                              _saving ? null : () => Navigator.of(context).pop(),
                          child: const Text('Annuler'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: FilledButton(
                          onPressed: _saving ? null : _save,
                          child: _saving
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text('Enregistrer les modifications'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _positionSection(ThemeData theme) {
    final hasPosition = _latitude != null && _longitude != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        OutlinedButton.icon(
          onPressed: _locating || _saving ? null : _useMyPosition,
          icon: _locating
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.my_location_rounded),
          label: Text(
            hasPosition
                ? 'Position : ${_latitude!.toStringAsFixed(5)}, '
                    '${_longitude!.toStringAsFixed(5)} (mettre à jour)'
                : 'Utiliser ma position actuelle',
          ),
        ),
        if (hasPosition)
          TextButton(
            onPressed: _saving
                ? null
                : () => setState(() {
                      _latitude = null;
                      _longitude = null;
                    }),
            child: const Text('Retirer la position de la carte'),
          ),
        const SizedBox(height: 4),
        Text(
          hasPosition
              ? 'Le bien apparaît sur la carte à cet emplacement.'
              : 'Sans position, le bien n’apparaît pas sur la carte.',
          style: theme.textTheme.bodySmall?.copyWith(color: AppColors.muted),
        ),
      ],
    );
  }

  Widget _photosSection(ThemeData theme) {
    final canAdd = _photoCount < _maxPhotos;
    final existingCount = _existingPhotos.length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Label('Photos du bien ($_photoCount/$_maxPhotos)'),
        Text(
          'La première photo est la couverture de l’annonce.',
          style: theme.textTheme.bodySmall?.copyWith(color: AppColors.muted),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
          ),
          itemCount: _photoCount + (canAdd ? 1 : 0),
          itemBuilder: (context, index) {
            if (index == _photoCount) {
              return InkWell(
                onTap: _saving ? null : _pickPhotos,
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.primaryTint,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add_a_photo_outlined,
                          color: AppColors.primary),
                      SizedBox(height: 4),
                      Text(
                        'Ajouter',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }
            final isExisting = index < existingCount;
            return Stack(
              fit: StackFit.expand,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: isExisting
                      ? Image.network(
                          _existingPhotos[index],
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stack) => Container(
                            color: AppColors.primaryTint,
                            child: const Icon(
                              Icons.broken_image_outlined,
                              color: AppColors.muted,
                            ),
                          ),
                        )
                      : Image.memory(
                          _newPhotos[index - existingCount].bytes,
                          fit: BoxFit.cover,
                        ),
                ),
                Positioned(
                  top: 6,
                  right: 6,
                  child: InkWell(
                    onTap: _saving
                        ? null
                        : () => setState(() {
                              if (isExisting) {
                                _existingPhotos.removeAt(index);
                              } else {
                                _newPhotos.removeAt(index - existingCount);
                              }
                            }),
                    child: const CircleAvatar(
                      radius: 12,
                      backgroundColor: Colors.black54,
                      child: Icon(Icons.close, size: 14, color: Colors.white),
                    ),
                  ),
                ),
                if (index == 0)
                  Positioned(
                    left: 6,
                    bottom: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        'Couverture',
                        style: TextStyle(color: Colors.white, fontSize: 11),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.ink,
            ),
      ),
    );
  }
}
