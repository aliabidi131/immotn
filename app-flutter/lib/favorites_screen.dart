import 'package:flutter/material.dart';

import 'auth_screen.dart';
import 'listing_model.dart';
import 'listing_repository.dart';
import 'listing_screens.dart';
import 'listing_widgets.dart';

class FavoritesScreen extends StatelessWidget {
  const FavoritesScreen({required this.onBrowse, super.key});

  /// Ouvre l'onglet Annonces (utilisé par l'état vide).
  final VoidCallback onBrowse;

  @override
  Widget build(BuildContext context) {
    return AuthBuilder(
      builder: (user) {
        if (user == null) {
          return const GuestScaffold(
            title: 'Favoris',
            message: 'Connectez-vous pour retrouver vos annonces favorites.',
            reason: 'Connectez-vous pour voir vos favoris.',
          );
        }
        return Scaffold(
          appBar: AppBar(title: const Text('Favoris')),
          body: StreamBuilder<List<String>>(
            stream: ListingRepository.favoriteIds(user.uid),
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return const StatusMessage(
                  icon: Icons.cloud_off_outlined,
                  title: 'Impossible de charger vos favoris.',
                );
              }
              if (!snapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              final ids = snapshot.data!;
              if (ids.isEmpty) {
                return StatusMessage(
                  icon: Icons.favorite_border,
                  title: 'Aucun favori pour le moment',
                  message:
                      'Appuyez sur le cœur d’une annonce pour la retrouver ici.',
                  actionLabel: 'Découvrir les annonces',
                  onAction: onBrowse,
                );
              }
              return _FavoriteList(
                uid: user.uid,
                ids: ids,
                onBrowse: onBrowse,
              );
            },
          ),
        );
      },
    );
  }
}

class _FavoriteList extends StatefulWidget {
  const _FavoriteList({
    required this.uid,
    required this.ids,
    required this.onBrowse,
  });

  final String uid;
  final List<String> ids;
  final VoidCallback onBrowse;

  @override
  State<_FavoriteList> createState() => _FavoriteListState();
}

class _FavoriteListState extends State<_FavoriteList> {
  late Future<List<Listing>> _future;
  late String _loadedKey;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant _FavoriteList oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.ids.join(',') != _loadedKey) setState(_load);
  }

  void _load() {
    _loadedKey = widget.ids.join(',');
    _future = ListingRepository.fetchListingsByIds(widget.ids);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Listing>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return const StatusMessage(
            icon: Icons.cloud_off_outlined,
            title: 'Impossible de charger vos favoris.',
          );
        }
        final listings = snapshot.data ?? const <Listing>[];
        if (listings.isEmpty) {
          return StatusMessage(
            icon: Icons.favorite_border,
            title: 'Ces annonces ne sont plus disponibles',
            message: 'Elles ont été supprimées, vendues ou masquées.',
            actionLabel: 'Découvrir les annonces',
            onAction: widget.onBrowse,
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: listings.length,
          itemBuilder: (context, index) {
            final listing = listings[index];
            return ListingCard(
              listing: listing,
              onTap: () => openListingDetail(context, listing),
              trailing: IconButton(
                tooltip: 'Retirer des favoris',
                icon: const Icon(Icons.favorite, color: Colors.red),
                onPressed: () => ListingRepository.setFavorite(
                  widget.uid,
                  listing.id,
                  false,
                ),
              ),
            );
          },
        );
      },
    );
  }
}
