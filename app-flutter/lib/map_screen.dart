
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import 'demo_data.dart';
import 'listing_model.dart';
import 'listing_repository.dart';
import 'listing_screens.dart';
import 'listing_widgets.dart';

const LatLng _tunisiaCenter = LatLng(34.0, 9.0);

/// Carte des annonces actives.
/// Seules les annonces ayant une position réelle sont affichées.
class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final MapController _controller = MapController();

  LatLng? _devicePosition;
  bool _mapReady = false;
  bool _loadingLocation = false;
  String? _locationError;
  double _radiusKm = 0;
  String? _selectedId;

  Future<void> _ensureLocation() async {
    if (!mounted) return;

    setState(() {
      _locationError = null;
      _loadingLocation = true;
    });

    try {
      // Vérifier si le GPS est activé
      bool serviceEnabled =
          await Geolocator.isLocationServiceEnabled();

      if (!serviceEnabled) {
        await Geolocator.openLocationSettings();

        serviceEnabled =
            await Geolocator.isLocationServiceEnabled();

        if (!serviceEnabled) {
          throw Exception(
            'Veuillez activer la localisation.',
          );
        }
      }

      // Vérifier les permissions
      LocationPermission permission =
          await Geolocator.checkPermission();

      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.deniedForever) {
        await Geolocator.openAppSettings();

        throw Exception(
          'Autorisez la localisation dans les paramètres de l’application.',
        );
      }

      if (permission == LocationPermission.denied) {
        throw Exception(
          'Permission de localisation refusée.',
        );
      }

      // Récupérer la position avec un délai maximum de 20 secondes
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );

      final target = LatLng(
        position.latitude,
        position.longitude,
      );

      if (!mounted) return;

      setState(() {
        _devicePosition = target;
        _loadingLocation = false;
      });

      if (_mapReady) {
        _controller.move(target, 15);
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Position détectée avec succès !'),
        ),
      );
    } catch (error) {
      debugPrint('LOCATION ERROR: $error');

      if (!mounted) return;

      setState(() {
        _loadingLocation = false;
        _locationError = error.toString();
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erreur GPS: $error'),
          duration: const Duration(seconds: 5),
        ),
      );
    }
  }

  Future<void> _toggleNearMe() async {
    debugPrint('GPS BUTTON PRESSED');

    if (_radiusKm > 0) {
      setState(() => _radiusKm = 0);
      return;
    }

    await _ensureLocation();

    if (_devicePosition != null && mounted) {
      setState(() => _radiusKm = 10);
    }
  }

  List<Listing> _visibleListings(List<Listing> located) {
    final origin = _devicePosition;

    if (_radiusKm <= 0 || origin == null) {
      return located;
    }

    return located.where((listing) {
      final distance = Geolocator.distanceBetween(
        origin.latitude,
        origin.longitude,
        listing.latitude!,
        listing.longitude!,
      );

      return distance <= _radiusKm * 1000;
    }).toList();
  }

  LatLng _initialTarget(List<Listing> located) {
    final origin = _devicePosition;

    if (origin != null) return origin;

    if (located.isEmpty) return _tunisiaCenter;

    final lat =
        located.map((l) => l.latitude!).reduce((a, b) => a + b) /
            located.length;

    final lng =
        located.map((l) => l.longitude!).reduce((a, b) => a + b) /
            located.length;

    return LatLng(lat, lng);
  }

  List<Marker> _buildMarkers(List<Listing> listings) {
    return [
      for (final listing in listings)
        Marker(
          point: LatLng(
            listing.latitude!,
            listing.longitude!,
          ),
          width: 44,
          height: 52,
          child: GestureDetector(
            onTap: () {
              setState(() => _selectedId = listing.id);
            },
            child: const Icon(
              Icons.location_on,
              color: Colors.red,
              size: 42,
            ),
          ),
        ),
      if (_devicePosition != null)
        Marker(
          point: _devicePosition!,
          width: 40,
          height: 40,
          child: const Icon(
            Icons.my_location,
            color: Colors.blue,
            size: 30,
          ),
        ),
    ];
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Carte des biens'),
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_radiusKm > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Chip(
                label: Text(
                  'Autour de moi · ${_radiusKm.toInt()} km',
                ),
                onDeleted: () => setState(() => _radiusKm = 0),
              ),
            ),
          FloatingActionButton.small(
            heroTag: 'near_me',
            onPressed: _loadingLocation ? null : _toggleNearMe,
            tooltip: 'Autour de moi',
            child: _loadingLocation
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                    ),
                  )
                : const Icon(Icons.my_location),
          ),
        ],
      ),
      body: StreamBuilder<List<Listing>>(
        stream: ListingRepository.activeListings(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const StatusMessage(
              icon: Icons.cloud_off_outlined,
              title: 'Erreur lors du chargement des annonces.',
            );
          }

          if (!snapshot.hasData) {
            return const Center(
              child: CircularProgressIndicator(),
            );
          }

          final real = snapshot.data!;
          final all = [...real, ...DemoDataService.fallbackFor(real)];
          final located = all.where((l) => l.hasLocation).toList();
          final visible = _visibleListings(located);

          Listing? selected;

          for (final listing in visible) {
            if (listing.id == _selectedId) {
              selected = listing;
              break;
            }
          }

          return Stack(
            children: [
              Column(
                children: [
                  if (_locationError != null)
                    Material(
                      color:
                          Theme.of(context).colorScheme.errorContainer,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(
                          _locationError!,
                          style: TextStyle(
                            color: Theme.of(context)
                                .colorScheme
                                .onErrorContainer,
                          ),
                        ),
                      ),
                    ),
                  Expanded(
                    child: FlutterMap(
                      mapController: _controller,
                      options: MapOptions(
                        initialCenter: _initialTarget(located),
                        initialZoom: 10,
                        onMapReady: () {
                          _mapReady = true;
                        },
                        onTap: (_, __) {
                          setState(() => _selectedId = null);
                        },
                      ),
                      children: [
                        TileLayer(
                          urlTemplate:
                              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                          userAgentPackageName: 'tn.iset.immotn',
                        ),
                        MarkerLayer(
                          markers: _buildMarkers(visible),
                        ),
                        RichAttributionWidget(
                          attributions: [
                            TextSourceAttribution(
                              '© OpenStreetMap contributors',
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              Positioned(
                left: 0,
                right: 0,
                top: 8,
                child: Align(
                  alignment: Alignment.topCenter,
                  child: _CountBadge(
                    located: located.length,
                    withoutPosition: all.length - located.length,
                  ),
                ),
              ),
              if (selected != null)
                Positioned(
                  left: 16,
                  right: 80,
                  bottom: 16,
                  child: _SelectedSummary(
                    listing: selected,
                    onClose: () {
                      setState(() => _selectedId = null);
                    },
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _CountBadge extends StatelessWidget {
  const _CountBadge({
    required this.located,
    required this.withoutPosition,
  });

  final int located;
  final int withoutPosition;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final text = located == 0
        ? 'Aucune annonce géolocalisée pour le moment'
        : '$located annonce(s) sur la carte'
            '${withoutPosition > 0 ? ' · $withoutPosition sans position' : ''}';

    return Material(
      elevation: 2,
      borderRadius: BorderRadius.circular(20),
      color: theme.colorScheme.surface,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 8,
        ),
        child: Text(
          text,
          style: theme.textTheme.bodySmall,
        ),
      ),
    );
  }
}

class _SelectedSummary extends StatelessWidget {
  const _SelectedSummary({
    required this.listing,
    required this.onClose,
  });

  final Listing listing;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      elevation: 4,
      clipBehavior: Clip.antiAlias,
      child: Row(
        children: [
          SizedBox(
            width: 110,
            height: 110,
            child: ListingPhoto(
              url: listing.coverPhoto,
              height: 110,
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    listing.titre,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    formatPrice(listing.prix),
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    '${listing.ville} · ${typeBienLabel(listing.typeBien)}'
                    '${listing.isDemo ? ' · Démo' : ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      TextButton(
                        onPressed: () {
                          openListingDetail(context, listing);
                        },
                        child: const Text('Voir l’annonce'),
                      ),
                      const Spacer(),
                      IconButton(
                        tooltip: 'Fermer',
                        visualDensity: VisualDensity.compact,
                        onPressed: onClose,
                        icon: const Icon(Icons.close),
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
}
