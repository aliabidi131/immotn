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
const Duration _publishTimeout = Duration(seconds: 45);

const List<String> _stepLabels = ['Infos', 'Détails', 'Photos'];

const Map<String, IconData> _typeIcons = {
  'appartement': Icons.apartment_rounded,
  'maison': Icons.house_rounded,
  'villa': Icons.home_work_rounded,
  'terrain': Icons.landscape_rounded,
  'local': Icons.storefront_rounded,
};

/// Publication d'une annonce, reprise de la maquette : trois étapes
/// (Infos, Détails, Photos) avec récapitulatif avant publication.
class CreateListingScreen extends StatefulWidget {
  const CreateListingScreen({required this.onPublished, super.key});

  final VoidCallback onPublished;

  @override
  State<CreateListingScreen> createState() => _CreateListingScreenState();
}

class _CreateListingScreenState extends State<CreateListingScreen> {
  final _infoKey = GlobalKey<FormState>();
  final _detailsKey = GlobalKey<FormState>();
  final _prix = TextEditingController();
  final _ville = TextEditingController();
  final _titre = TextEditingController();
  final _description = TextEditingController();
  final _surface = TextEditingController();
  final _pieces = TextEditingController();
  final _adresse = TextEditingController();

  int _step = 0;
  String _transaction = 'vente';
  String _typeBien = 'appartement';
  final List<PhotoFile> _photos = [];
  double? _latitude;
  double? _longitude;
  bool _locating = false;
  bool _submitting = false;
  String _progress = '';
  String? _error;

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

  void _resetForm() {
    for (final controller in [
      _prix,
      _ville,
      _titre,
      _description,
      _surface,
      _pieces,
      _adresse,
    ]) {
      controller.clear();
    }
    _transaction = 'vente';
    _typeBien = 'appartement';
    _photos.clear();
    _latitude = null;
    _longitude = null;
    _step = 0;
    _error = null;
    _progress = '';
  }

  bool _validateStep(int step) {
    switch (step) {
      case 0:
        return _infoKey.currentState?.validate() ?? false;
      case 1:
        return _detailsKey.currentState?.validate() ?? false;
      case 2:
        if (_photos.isEmpty) {
          setState(() => _error = 'Ajoutez au moins une photo du bien.');
          return false;
        }
        return true;
      default:
        return false;
    }
  }

  void _next() {
    if (!_validateStep(_step)) return;
    setState(() {
      _error = null;
      _step++;
    });
  }

  void _back() => setState(() {
        _error = null;
        _step--;
      });

  Future<void> _pickPhotos() async {
    final remaining = _maxPhotos - _photos.length;
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
        _photos.addAll(loaded);
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

  Future<void> _submit() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      setState(() => _error = 'Connectez-vous pour publier une annonce.');
      return;
    }
    if (_submitting) return;
    setState(() {
      _submitting = true;
      _error = null;
      _progress = 'Préparation de l’annonce…';
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
      };
      final adresse = _adresse.text.trim();
      if (adresse.isNotEmpty) data['adresse'] = adresse;
      final lat = _latitude;
      final lng = _longitude;
      // Position envoyée seulement si elle est réelle (jamais inventée).
      if (lat != null && lng != null) {
        data['latitude'] = lat;
        data['longitude'] = lng;
      }

      await ListingRepository.createListing(
        ownerId: user.uid,
        data: data,
        photos: List<PhotoFile>.of(_photos),
        onProgress: (done, total) {
          if (!mounted) return;
          setState(() => _progress = done < total
              ? 'Envoi des photos $done/$total…'
              : 'Enregistrement de l’annonce…');
        },
      ).timeout(
        _publishTimeout,
        onTimeout: () => throw TimeoutException('Délai dépassé'),
      );

      if (!mounted) return;
      setState(_resetForm);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Annonce publiée avec succès.')),
      );
      widget.onPublished();
    } on TimeoutException {
      if (!mounted) return;
      setState(() => _error =
          'Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez. '
          'Si le problème continue, vérifiez que Firestore est activé et '
          'que l\'Edge Function Supabase est déployée.');
    } on ImageServiceException catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Erreur image : ${error.message}');
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Publication impossible : ${_describe(error)}');
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
          _progress = '';
        });
      }
    }
  }

  String _describe(Object error) {
    if (error is FirebaseException) return error.message ?? error.code;
    return error.toString();
  }

  void _onPrimaryAction() {
    if (_step < _stepLabels.length - 1) {
      _next();
    } else {
      _submit();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isLast = _step == _stepLabels.length - 1;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Publier une annonce'),
        centerTitle: true,
        leading: _step > 0 && !_submitting
            ? IconButton(
                tooltip: 'Retour',
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: _back,
              )
            : null,
      ),
      body: Column(
        children: [
          _StepIndicator(current: _step),
          Expanded(
            child: IndexedStack(
              index: _step,
              children: [
                _infoStep(theme),
                _detailsStep(theme),
                _photosStep(theme),
              ],
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
                  if (_submitting && _progress.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(
                        _progress,
                        style: theme.textTheme.bodySmall,
                      ),
                    ),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _submitting ? null : _onPrimaryAction,
                      child: _submitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(isLast ? 'Publier l’annonce' : 'Suivant  →'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoStep(ThemeData theme) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Form(
        key: _infoKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SectionLabel('Type de bien'),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                for (final entry in typeBienLabels.entries)
                  _TypeTile(
                    icon: _typeIcons[entry.key] ?? Icons.home_rounded,
                    label: entry.value,
                    selected: _typeBien == entry.key,
                    onTap: () => setState(() => _typeBien = entry.key),
                  ),
              ],
            ),
            const SizedBox(height: 20),
            _SectionLabel('Transaction'),
            SizedBox(
              width: double.infinity,
              child: SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'vente', label: Text('Vente')),
                  ButtonSegment(value: 'location', label: Text('Location')),
                ],
                selected: {_transaction},
                onSelectionChanged: (selection) =>
                    setState(() => _transaction = selection.first),
              ),
            ),
            const SizedBox(height: 20),
            _SectionLabel('Prix (TND)'),
            TextFormField(
              controller: _prix,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                hintText: 'Ex : 500 000',
                prefixIcon: Icon(Icons.payments_outlined),
              ),
              validator: validatePositiveNumber,
            ),
            const SizedBox(height: 20),
            _SectionLabel('Localisation'),
            TextFormField(
              controller: _ville,
              decoration: const InputDecoration(
                hintText: 'Ville, ex : Tunis',
                prefixIcon: Icon(Icons.place_outlined),
              ),
              validator: validateRequiredField,
            ),
          ],
        ),
      ),
    );
  }

  Widget _detailsStep(ThemeData theme) {
    final hasPosition = _latitude != null && _longitude != null;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Form(
        key: _detailsKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SectionLabel('Titre de l’annonce'),
            TextFormField(
              controller: _titre,
              maxLength: 100,
              decoration: const InputDecoration(
                hintText: 'Ex : Villa moderne avec piscine',
              ),
              validator: validateRequiredField,
            ),
            const SizedBox(height: 12),
            _SectionLabel('Description'),
            TextFormField(
              controller: _description,
              maxLength: 2000,
              minLines: 3,
              maxLines: 6,
              decoration: const InputDecoration(
                hintText: 'Décrivez le bien…',
              ),
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
            const SizedBox(height: 12),
            TextFormField(
              controller: _adresse,
              decoration: const InputDecoration(
                labelText: 'Adresse (facultatif)',
                prefixIcon: Icon(Icons.map_outlined),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _locating ? null : _useMyPosition,
              icon: _locating
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location_rounded),
              label: Text(
                hasPosition
                    ? 'Position enregistrée : '
                        '${_latitude!.toStringAsFixed(5)}, '
                        '${_longitude!.toStringAsFixed(5)}'
                    : 'Utiliser ma position actuelle',
              ),
            ),
            const SizedBox(height: 6),
            Text(
              hasPosition
                  ? 'Le bien apparaîtra sur la carte à cet emplacement.'
                  : 'Sans position, le bien n’apparaîtra pas sur la carte.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.muted,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _photosStep(ThemeData theme) {
    final scheme = theme.colorScheme;
    final canAdd = _photos.length < _maxPhotos;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionLabel('Photos du bien (${_photos.length}/$_maxPhotos)'),
          Text(
            'La première photo sera la couverture de l’annonce.',
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
            itemCount: _photos.length + (canAdd ? 1 : 0),
            itemBuilder: (context, index) {
              if (index == _photos.length) {
                return InkWell(
                  onTap: _pickPhotos,
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
              return Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.memory(
                      _photos[index].bytes,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Positioned(
                    top: 6,
                    right: 6,
                    child: InkWell(
                      onTap: () => setState(() => _photos.removeAt(index)),
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
          const SizedBox(height: 24),
          _SectionLabel('Récapitulatif'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _SummaryRow('Transaction', transactionLabel(_transaction)),
                  _SummaryRow('Type de bien', typeBienLabel(_typeBien)),
                  _SummaryRow('Titre', _titre.text.trim()),
                  _SummaryRow(
                    'Prix',
                    _prix.text.trim().isEmpty
                        ? '-'
                        : formatPrice(num.tryParse(_prix.text.trim()) ?? 0),
                  ),
                  _SummaryRow(
                    'Surface',
                    _surface.text.trim().isEmpty
                        ? '-'
                        : '${_surface.text.trim()} m²',
                  ),
                  _SummaryRow('Pièces', _pieces.text.trim()),
                  _SummaryRow('Ville', _ville.text.trim()),
                  _SummaryRow('Photos', '${_photos.length}'),
                  _SummaryRow(
                    'Position',
                    _latitude != null && _longitude != null
                        ? 'Renseignée'
                        : 'Non renseignée',
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Vos photos, prix et localisation seront visibles par tous les visiteurs.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: scheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _StepIndicator extends StatelessWidget {
  const _StepIndicator({required this.current});

  final int current;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final children = <Widget>[];
    for (var i = 0; i < _stepLabels.length; i++) {
      final done = i < current;
      final active = i == current;
      final color = active || done ? AppColors.primary : AppColors.muted;
      children.add(
        Expanded(
          child: Column(
            children: [
              CircleAvatar(
                radius: 14,
                backgroundColor: active || done
                    ? AppColors.primary
                    : Colors.white,
                child: done
                    ? const Icon(Icons.check, size: 16, color: Colors.white)
                    : Text(
                        '${i + 1}',
                        style: TextStyle(
                          color: active ? Colors.white : AppColors.muted,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
              const SizedBox(height: 6),
              Text(
                _stepLabels[i],
                style: theme.textTheme.labelMedium?.copyWith(
                  color: color,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      );
      if (i < _stepLabels.length - 1) {
        children.add(
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 18),
              child: Divider(
                thickness: 2,
                color: i < current ? AppColors.primary : AppColors.primaryTint,
              ),
            ),
          ),
        );
      }
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 8),
      child: Row(children: children),
    );
  }
}

class _TypeTile extends StatelessWidget {
  const _TypeTile({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: 76,
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
        decoration: BoxDecoration(
          color: selected ? AppColors.primaryTint : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? AppColors.primary : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: selected ? AppColors.primary : AppColors.muted,
            ),
            const SizedBox(height: 6),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? AppColors.primary : AppColors.ink,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

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

class _SummaryRow extends StatelessWidget {
  const _SummaryRow(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(color: AppColors.muted),
            ),
          ),
          Expanded(
            child: Text(
              value.isEmpty ? '-' : value,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
