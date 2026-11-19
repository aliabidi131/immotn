import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import 'app_theme.dart';
import 'demo_data.dart';
import 'home_widgets.dart';
import 'listing_model.dart';
import 'listing_repository.dart';
// ContactOwnerBar est défini dans listing_widgets.dart (version simple) et dans
// messages_screens.dart (version qui ouvre la conversation) : on utilise celle
// de messages_screens.dart.
import 'listing_widgets.dart' hide ContactOwnerBar;
import 'messages_screens.dart';
import 'notifications_screen.dart';


void openListingDetail(BuildContext context, Listing listing) {
  Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => ListingDetailScreen(listing: listing),
    ),
  );
}

/// Ouvre la page qui affiche toutes les annonces.
void openAllListings(BuildContext context) {
  Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => const AllListingsScreen()),
  );
}

/// Page « Toutes les annonces » : annonces actives en temps réel, plus les
/// annonces de démonstration (marquées DEMO) si la base n'en contient pas.
class AllListingsScreen extends StatelessWidget {
  const AllListingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Toutes les annonces')),
      body: StreamBuilder<List<Listing>>(
        stream: ListingRepository.activeListings(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const StatusMessage(
              icon: Icons.cloud_off_outlined,
              title: 'Impossible de charger les annonces.',
            );
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final real = snapshot.data!;
          final listings = [...real, ...DemoDataService.fallbackFor(real)];
          if (listings.isEmpty) {
            return const StatusMessage(
              icon: Icons.home_work_outlined,
              title: 'Aucune annonce pour le moment',
              message:
                  'Les nouvelles annonces apparaîtront ici dès leur publication.',
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            itemCount: listings.length + 1,
            itemBuilder: (context, index) {
              if (index == 0) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    '${listings.length} annonce(s)',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                );
              }
              final listing = listings[index - 1];
              return ListingCompactCard(
                listing: listing,
                onTap: () => openListingDetail(context, listing),
                trailing: FavoriteButton(listingId: listing.id),
              );
            },
          );
        },
      ),
    );
  }
}

/// Accueil Marketplace : recherche, catégories, filtres et liste paginée.
/// Accessible sans connexion.
class ListingFeedScreen extends StatefulWidget {
  const ListingFeedScreen({super.key});

  @override
  State<ListingFeedScreen> createState() => _ListingFeedScreenState();
}

class _ListingFeedScreenState extends State<ListingFeedScreen> {
  final _searchController = TextEditingController();
  final List<Listing> _loaded = [];
  DocumentSnapshot<Map<String, dynamic>>? _lastDoc;
  bool _hasMore = false;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  ListingFilters _filters = const ListingFilters();

  @override
  void initState() {
    super.initState();
    _loadFirstPage();
    // Rafraîchit la liste après la modification d'une annonce.
    ListingRepository.revision.addListener(_onListingsChanged);
  }

  void _onListingsChanged() {
    if (mounted) _loadFirstPage();
  }

  @override
  void dispose() {
    ListingRepository.revision.removeListener(_onListingsChanged);
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadFirstPage() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final page = await ListingRepository.fetchActivePage();

      if (!mounted) return;

      setState(() {
        _loaded
          ..clear()
          ..addAll(page.items);
        _lastDoc = page.lastDoc;
        _hasMore = page.hasMore;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;

      setState(() {
        _error =
            'Impossible de charger les annonces. Vérifiez votre connexion.';
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    final last = _lastDoc;

    if (_loadingMore || !_hasMore || last == null) return;

    setState(() => _loadingMore = true);

    try {
      final page = await ListingRepository.fetchActivePage(after: last);

      if (!mounted) return;

      setState(() {
        _loaded.addAll(page.items);
        _lastDoc = page.lastDoc ?? _lastDoc;
        _hasMore = page.hasMore;
        _loadingMore = false;
      });
    } catch (_) {
      if (!mounted) return;

      setState(() => _loadingMore = false);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Impossible de charger plus d’annonces.'),
        ),
      );
    }
  }

  bool _matchesSearch(Listing listing) {
    final query = _searchController.text.trim().toLowerCase();

    if (query.isEmpty) return true;

    return listing.titre.toLowerCase().contains(query) ||
        listing.ville.toLowerCase().contains(query) ||
        listing.adresse.toLowerCase().contains(query) ||
        typeBienLabel(listing.typeBien).toLowerCase().contains(query);
  }

  /// Annonces réelles chargées + annonces de démonstration (en mémoire,
  /// toujours marquées DEMO). Les réelles passent en premier.
  List<Listing> get _all =>
      [..._loaded, ...DemoDataService.fallbackFor(_loaded)];

  List<Listing> get _visible =>
      _all.where((l) => _filters.matches(l) && _matchesSearch(l)).toList();

  void _resetFilters() {
    _searchController.clear();
    setState(() => _filters = const ListingFilters());
  }

  Future<void> _openFilters() async {
    final result = await showModalBottomSheet<ListingFilters>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _FilterSheet(initial: _filters),
    );

    if (result != null) {
      setState(() => _filters = result);
    }
  }

  // Sections thématiques calculées à partir des annonces chargées
  List<Listing> get _topVillas => _all
      .where((l) => l.typeBien == 'villa')
      .take(6)
      .toList();

  List<Listing> get _topLocations => _all
      .where((l) => l.typeTransaction == 'location')
      .take(6)
      .toList();

  @override
  Widget build(BuildContext context) {
    final visible = _visible;
    final hasSearch = _searchController.text.trim().isNotEmpty;
    final isFiltered = hasSearch || !_filters.isEmpty;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.villa_rounded, color: AppColors.primary, size: 26),
            SizedBox(width: 8),
            Text('ImmoTN'),
          ],
        ),
        actions: [
          const NotificationBell(),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: IconButton(
              tooltip: 'Filtres',
              onPressed: _openFilters,
              icon: Badge(
                isLabelVisible: !_filters.isEmpty,
                backgroundColor: AppColors.accent,
                child: const Icon(Icons.tune_rounded),
              ),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _loadFirstPage,
        child: CustomScrollView(
          slivers: [
            // ── Barre de recherche ──────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: SearchBar2(
                  controller: _searchController,
                  onChanged: () => setState(() {}),
                  onClear: () {
                    _searchController.clear();
                    setState(() {});
                  },
                ),
              ),
            ),

            // ── Bannière + catégories (masqués si recherche active) ─
            if (!isFiltered) ..._buildHomeHeader(),

            // ── Résultats / liste principale ────────────────────
            ..._buildResults(visible, isFiltered),

            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildHomeHeader() {
    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: PromoBanner(
            onDiscover: () => openAllListings(context),
            listingCount: _all.length,
            cityCount: _all
                .map((l) => l.ville)
                .where((ville) => ville.isNotEmpty)
                .toSet()
                .length,
          ),
        ),
      ),
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: CategoryChipBar(
            selected: _filters.typeBien,
            onSelected: (value) =>
                setState(() => _filters = _filters.withTypeBien(value)),
          ),
        ),
      ),
      // Section Villas coup de cœur
      if (_topVillas.isNotEmpty)
        SliverToBoxAdapter(
          child: ListingHorizontalSection(
            title: 'Villas & Luxe',
            icon: Icons.villa_rounded,
            listings: _topVillas,
            onTap: (l) => openListingDetail(context, l),
            favoriteBuilder: (id) => FavoriteButton(listingId: id),
          ),
        ),
      // Section À louer
      if (_topLocations.isNotEmpty)
        SliverToBoxAdapter(
          child: ListingHorizontalSection(
            title: 'À louer',
            icon: Icons.key_rounded,
            listings: _topLocations,
            onTap: (l) => openListingDetail(context, l),
            favoriteBuilder: (id) => FavoriteButton(listingId: id),
          ),
        ),
    ];
  }

  List<Widget> _buildResults(List<Listing> visible, bool hasSearch) {
    if (_loading && _loaded.isEmpty) {
      return const [
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.all(48),
            child: Center(
              child: CircularProgressIndicator(),
            ),
          ),
        ),
      ];
    }

    if (_error != null && _loaded.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: StatusMessage(
            icon: Icons.cloud_off_outlined,
            title: _error!,
            actionLabel: 'Réessayer',
            onAction: _loadFirstPage,
          ),
        ),
      ];
    }

    if (_all.isEmpty) {
      return const [
        SliverToBoxAdapter(
          child: StatusMessage(
            icon: Icons.home_work_outlined,
            title: 'Aucune annonce pour le moment',
            message:
                'Les nouvelles annonces apparaîtront ici dès leur publication.',
          ),
        ),
      ];
    }

    final widgets = <Widget>[];

    if (visible.isEmpty) {
      widgets.add(
        SliverToBoxAdapter(
          child: StatusMessage(
            icon: Icons.search_off_rounded,
            title: 'Aucun bien ne correspond',
            message: 'Modifiez vos filtres ou votre recherche.',
            actionLabel: 'Réinitialiser',
            onAction: _resetFilters,
          ),
        ),
      );
    } else {
      // En-tête section avec compteur et label
      widgets.add(
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    hasSearch
                        ? '${visible.length} résultat(s) trouvé(s)'
                        : !_filters.isEmpty
                            ? '${visible.length} bien(s) filtré(s)'
                            : 'Toutes les annonces',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.successLight,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${visible.length} biens',
                    style: const TextStyle(
                      color: AppColors.success,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );

      widgets.add(
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final listing = visible[index];
                return ListingCompactCard(
                  listing: listing,
                  onTap: () => openListingDetail(context, listing),
                  trailing: FavoriteButton(listingId: listing.id),
                );
              },
              childCount: visible.length,
            ),
          ),
        ),
      );
    }

    if (_hasMore) {
      widgets.add(
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Center(
              child: _loadingMore
                  ? const CircularProgressIndicator()
                  : OutlinedButton.icon(
                      onPressed: _loadMore,
                      icon: const Icon(Icons.expand_more_rounded),
                      label: const Text('Charger plus d’annonces'),
                    ),
            ),
          ),
        ),
      );
    }

    return widgets;
  }
}

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({required this.initial});

  final ListingFilters initial;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late String _transaction;
  late final TextEditingController _minPrice;
  late final TextEditingController _maxPrice;
  late final TextEditingController _minSurface;
  late final TextEditingController _minRooms;
  late final TextEditingController _city;

  @override
  void initState() {
    super.initState();

    final f = widget.initial;

    _transaction = f.transaction;
    _minPrice = TextEditingController(text: _text(f.minPrice));
    _maxPrice = TextEditingController(text: _text(f.maxPrice));
    _minSurface = TextEditingController(text: _text(f.minSurface));
    _minRooms = TextEditingController(text: _text(f.minRooms));
    _city = TextEditingController(text: f.city);
  }

  @override
  void dispose() {
    _minPrice.dispose();
    _maxPrice.dispose();
    _minSurface.dispose();
    _minRooms.dispose();
    _city.dispose();
    super.dispose();
  }

  String _text(num? value) => value == null ? '' : formatQuantity(value);

  void _apply() {
    Navigator.of(context).pop(
      ListingFilters(
        transaction: _transaction,
        typeBien: widget.initial.typeBien,
        minPrice: num.tryParse(_minPrice.text.trim()),
        maxPrice: num.tryParse(_maxPrice.text.trim()),
        minSurface: num.tryParse(_minSurface.text.trim()),
        minRooms: int.tryParse(_minRooms.text.trim()),
        city: _city.text.trim(),
      ),
    );
  }

  Widget _numberField(
    TextEditingController controller,
    String label, {
    bool integer = false,
  }) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.numberWithOptions(
        decimal: !integer,
      ),
      decoration: InputDecoration(
        labelText: label,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        4,
        20,
        MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Filtres', style: theme.textTheme.titleLarge),
            const SizedBox(height: 16),
            Text('Transaction', style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'tous', label: Text('Tous')),
                ButtonSegment(value: 'vente', label: Text('Vente')),
                ButtonSegment(value: 'location', label: Text('Location')),
              ],
              selected: {_transaction},
              onSelectionChanged: (selection) =>
                  setState(() => _transaction = selection.first),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _numberField(_minPrice, 'Prix min (TND)'),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _numberField(_maxPrice, 'Prix max (TND)'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _numberField(_minSurface, 'Surface min (m²)'),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _numberField(
                    _minRooms,
                    'Pièces min',
                    integer: true,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _city,
              decoration: InputDecoration(
                labelText: 'Ville',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(
                      ListingFilters(
                        typeBien: widget.initial.typeBien,
                      ),
                    ),
                    child: const Text('Réinitialiser'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: _apply,
                    child: const Text('Appliquer'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Fiche détaillée : galerie, caractéristiques, description et position réelle.
class ListingDetailScreen extends StatefulWidget {
  const ListingDetailScreen({required this.listing, super.key});

  final Listing listing;

  @override
  State<ListingDetailScreen> createState() => _ListingDetailScreenState();
}

/// Suit l'annonce en temps réel pour refléter une modification (titre, prix,
/// photos…) sans quitter la fiche. Les annonces de démonstration (en mémoire)
/// restent figées.
class _ListingDetailScreenState extends State<ListingDetailScreen> {
  late final Stream<Listing?>? _stream =
      DemoDataService.byId(widget.listing.id) == null
          ? ListingRepository.watchListing(widget.listing.id)
          : null;

  @override
  Widget build(BuildContext context) {
    final stream = _stream;
    if (stream == null) return _ListingDetailView(listing: widget.listing);
    return StreamBuilder<Listing?>(
      stream: stream,
      initialData: widget.listing,
      builder: (context, snapshot) => _ListingDetailView(
        listing: snapshot.data ?? widget.listing,
      ),
    );
  }
}

class _ListingDetailView extends StatelessWidget {
  const _ListingDetailView({required this.listing});

  final Listing listing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    final address = [listing.ville, listing.adresse]
        .where((part) => part.isNotEmpty)
        .join(' · ');

    final created = listing.dateCreation;

    return Scaffold(
      appBar: AppBar(
        actions: [
          FavoriteButton(listingId: listing.id),
        ],
      ),
      bottomNavigationBar: ContactOwnerBar(listing: listing),
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          _PhotoGallery(photos: listing.photos),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (listing.isDemo) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.primaryTint,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      children: [
                        Icon(
                          Icons.info_outline_rounded,
                          size: 18,
                          color: AppColors.primary,
                        ),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Annonce de démonstration : ce bien est fictif '
                            'et présenté à titre d’illustration.',
                            style: TextStyle(
                              color: AppColors.primary,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                ],
                Text(
                  formatPrice(listing.prix),
                  style: theme.textTheme.headlineSmall?.copyWith(
                    color: scheme.primary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  listing.titre,
                  style: theme.textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _Fact(
                      icon: Icons.sell_outlined,
                      label: transactionLabel(listing.typeTransaction),
                    ),
                    _Fact(
                      icon: Icons.apartment_outlined,
                      label: typeBienLabel(listing.typeBien),
                    ),
                    _Fact(
                      icon: Icons.square_foot,
                      label: '${formatQuantity(listing.surface)} m²',
                    ),
                    _Fact(
                      icon: Icons.meeting_room_outlined,
                      label: '${listing.nombrePieces} pièce(s)',
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                const _SectionTitle('Localisation'),
                Row(
                  children: [
                    Icon(
                      Icons.place_outlined,
                      size: 18,
                      color: scheme.onSurfaceVariant,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        address.isEmpty ? 'Adresse non précisée' : address,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Carte OpenStreetMap
                if (listing.hasLocation)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: SizedBox(
                      height: 200,
                      child: FlutterMap(
                        options: MapOptions(
                          initialCenter: LatLng(
                            listing.latitude!,
                            listing.longitude!,
                          ),
                          initialZoom: 14,
                          interactionOptions: const InteractionOptions(
                            flags: InteractiveFlag.none,
                          ),
                        ),
                        children: [
                          TileLayer(
                            urlTemplate:
                                'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                            userAgentPackageName: 'tn.iset.immotn',
                          ),
                          MarkerLayer(
                            markers: [
                              Marker(
                                point: LatLng(
                                  listing.latitude!,
                                  listing.longitude!,
                                ),
                                width: 40,
                                height: 40,
                                child: const Icon(
                                  Icons.location_on,
                                  color: Colors.red,
                                  size: 38,
                                ),
                              ),
                            ],
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
                  )
                else
                  Text(
                    'L’annonceur n’a pas indiqué de position sur la carte.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),

                const SizedBox(height: 20),
                const _SectionTitle('Description'),
                Text(
                  listing.description.isEmpty
                      ? 'Aucune description.'
                      : listing.description,
                  style: theme.textTheme.bodyLarge,
                ),
                if (created != null) ...[
                  const SizedBox(height: 20),
                  Text(
                    'Publiée le ${formatDate(created)}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PhotoGallery extends StatefulWidget {
  const _PhotoGallery({required this.photos});

  final List<String> photos;

  @override
  State<_PhotoGallery> createState() => _PhotoGalleryState();
}

class _PhotoGalleryState extends State<_PhotoGallery> {
  final _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final photos = widget.photos;

    if (photos.isEmpty) {
      return const ListingPhoto(url: '', height: 260);
    }

    return Stack(
      children: [
        SizedBox(
          height: 260,
          child: PageView.builder(
            controller: _controller,
            itemCount: photos.length,
            onPageChanged: (index) => setState(() => _index = index),
            itemBuilder: (context, index) =>
                ListingPhoto(url: photos[index], height: 260),
          ),
        ),
        Positioned(
          right: 12,
          bottom: 12,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: 10,
              vertical: 4,
            ),
            decoration: BoxDecoration(
              color: Colors.black54,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '${_index + 1} / ${photos.length}',
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ),
      ],
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(icon, size: 18),
      label: Text(label),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}
