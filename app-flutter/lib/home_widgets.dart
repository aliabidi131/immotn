import 'package:flutter/material.dart';

import 'app_theme.dart';
import 'listing_model.dart';
import 'listing_widgets.dart';

/// Carte compacte améliorée : photo à gauche, badge transaction, prix mis en avant.
class ListingCompactCard extends StatelessWidget {
  const ListingCompactCard({
    required this.listing,
    required this.onTap,
    this.trailing,
    super.key,
  });

  final Listing listing;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Photo ───────────────────────────────────────
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: SizedBox(
                  width: 110,
                  height: 110,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      ListingPhoto(url: listing.coverPhoto, height: 110),
                      if (listing.isDemo)
                        const Positioned(
                          top: 6,
                          left: 6,
                          child: DemoBadge(),
                        ),
                      // Badge transaction en bas de la photo
                      Positioned(
                        bottom: 6,
                        left: 6,
                        child: TransactionBadge(
                          label: transactionLabel(listing.typeTransaction),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // ── Infos ────────────────────────────────────────
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            listing.titre,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleSmall?.copyWith(
                              color: AppColors.ink,
                              height: 1.3,
                            ),
                          ),
                        ),
                        if (trailing != null)
                          Padding(
                            padding: const EdgeInsets.only(left: 4),
                            child: trailing!,
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      formatPrice(listing.prix),
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                        fontSize: 17,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Row(
                      children: [
                        const Icon(
                          Icons.place_rounded,
                          size: 13,
                          color: AppColors.muted,
                        ),
                        const SizedBox(width: 3),
                        Expanded(
                          child: Text(
                            listing.ville.isEmpty
                                ? typeBienLabel(listing.typeBien)
                                : listing.ville,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: AppColors.muted,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 12,
                      children: [
                        if (listing.nombrePieces > 0)
                          _Spec(
                            icon: Icons.bed_rounded,
                            text: '${listing.nombrePieces} pièce(s)',
                          ),
                        _Spec(
                          icon: Icons.square_foot_rounded,
                          text: '${formatQuantity(listing.surface)} m²',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Spec extends StatelessWidget {
  const _Spec({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: AppColors.muted),
        const SizedBox(width: 3),
        Text(
          text,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: AppColors.muted,
                fontSize: 12,
              ),
        ),
      ],
    );
  }
}

/// Carte horizontale large pour la section « Coups de cœur ».
class ListingFeaturedCard extends StatelessWidget {
  const ListingFeaturedCard({
    required this.listing,
    required this.onTap,
    this.trailing,
    super.key,
  });

  final Listing listing;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          width: 220,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  ListingPhoto(url: listing.coverPhoto, height: 140),
                  Positioned(
                    top: 10,
                    left: 10,
                    child: TransactionBadge(
                      label: transactionLabel(listing.typeTransaction),
                    ),
                  ),
                  if (listing.isDemo)
                    const Positioned(
                      bottom: 10,
                      left: 10,
                      child: DemoBadge(),
                    ),
                  if (trailing != null)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                        child: trailing!,
                      ),
                    ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      formatPrice(listing.prix),
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      listing.titre,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        const Icon(Icons.place_rounded,
                            size: 12, color: AppColors.muted),
                        const SizedBox(width: 3),
                        Expanded(
                          child: Text(
                            listing.ville,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodySmall,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bannière d’accueil : photo plein cadre, dégradé de lisibilité, accroche,
/// bouton d’action et statistiques réelles (calculées à partir des annonces).
class PromoBanner extends StatelessWidget {
  const PromoBanner({
    required this.onDiscover,
    this.listingCount,
    this.cityCount,
    super.key,
  });

  final VoidCallback onDiscover;
  final int? listingCount;
  final int? cityCount;

  static const String _heroImage =
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1000';

  static String _plural(int n, String word) => '$n $word${n > 1 ? 's' : ''}';

  @override
  Widget build(BuildContext context) {
    final count = listingCount ?? 0;
    final cities = cityCount ?? 0;
    final stats = count > 0
        ? [
            _plural(count, 'bien'),
            if (cities > 0) _plural(cities, 'ville'),
          ].join(' · ')
        : null;

    return Container(
      height: 200,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          colors: [AppColors.primaryDark, AppColors.primary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withAlpha(70),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Photo de fond (si elle ne charge pas, le dégradé reste visible).
          Image.network(
            _heroImage,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stack) => const SizedBox.shrink(),
          ),
          // Voile dégradé pour garder le texte lisible.
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [
                  AppColors.primaryDark.withAlpha(240),
                  AppColors.primaryDark.withAlpha(170),
                  AppColors.primaryDark.withAlpha(40),
                ],
                stops: const [0.0, 0.55, 1.0],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withAlpha(30),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white.withAlpha(60)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.location_on_rounded,
                          size: 13, color: Colors.white),
                      SizedBox(width: 4),
                      Text(
                        'Immobilier en Tunisie',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Trouvez le bien\nqui vous ressemble',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 23,
                    fontWeight: FontWeight.w800,
                    height: 1.15,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 6),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 250),
                  child: Text(
                    'Vente, location, terrains et locaux partout en Tunisie.',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: Colors.white.withAlpha(215),
                      fontSize: 12,
                      height: 1.3,
                    ),
                  ),
                ),
                const Spacer(),
                Row(
                  children: [
                    Material(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      child: InkWell(
                        onTap: onDiscover,
                        borderRadius: BorderRadius.circular(14),
                        child: const Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 10,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Explorer les biens',
                                style: TextStyle(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                              SizedBox(width: 6),
                              Icon(
                                Icons.arrow_forward_rounded,
                                color: AppColors.primary,
                                size: 16,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    if (stats != null) ...[
                      const SizedBox(width: 10),
                      Flexible(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 7,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withAlpha(30),
                            borderRadius: BorderRadius.circular(20),
                            border:
                                Border.all(color: Colors.white.withAlpha(60)),
                          ),
                          child: Text(
                            stats,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Section horizontale scrollable (coups de cœur, nouveautés…).
class ListingHorizontalSection extends StatelessWidget {
  const ListingHorizontalSection({
    required this.title,
    required this.listings,
    required this.onTap,
    required this.favoriteBuilder,
    this.icon,
    super.key,
  });

  final String title;
  final List<Listing> listings;
  final void Function(Listing) onTap;
  final Widget Function(String listingId) favoriteBuilder;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    if (listings.isEmpty) return const SizedBox.shrink();

    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
          child: Row(
            children: [
              if (icon != null) ...[
                Icon(icon, size: 20, color: AppColors.primary),
                const SizedBox(width: 8),
              ],
              Text(title, style: theme.textTheme.titleMedium),
            ],
          ),
        ),
        SizedBox(
          height: 240,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: listings.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final listing = listings[index];
              return ListingFeaturedCard(
                listing: listing,
                onTap: () => onTap(listing),
                trailing: favoriteBuilder(listing.id),
              );
            },
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

/// Chips de type de bien pour l'accueil, avec icônes.
class CategoryChipBar extends StatelessWidget {
  const CategoryChipBar({
    required this.selected,
    required this.onSelected,
    super.key,
  });

  final String? selected;
  final ValueChanged<String?> onSelected;

  static const _items = [
    (key: null, label: 'Tous', icon: Icons.home_rounded),
    (key: 'appartement', label: 'Appart.', icon: Icons.apartment_rounded),
    (key: 'maison', label: 'Maison', icon: Icons.house_rounded),
    (key: 'villa', label: 'Villa', icon: Icons.villa_rounded),
    (key: 'terrain', label: 'Terrain', icon: Icons.landscape_rounded),
    (key: 'local', label: 'Local', icon: Icons.store_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final item = _items[index];
          final isSelected = selected == item.key;
          return FilterChip(
            label: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  item.icon,
                  size: 15,
                  color: isSelected ? AppColors.primary : AppColors.muted,
                ),
                const SizedBox(width: 5),
                Text(item.label),
              ],
            ),
            selected: isSelected,
            onSelected: (_) => onSelected(item.key),
            backgroundColor: AppColors.surface,
            selectedColor: AppColors.primaryTint,
            checkmarkColor: AppColors.primary,
            showCheckmark: false,
            side: BorderSide(
              color: isSelected ? AppColors.primary : AppColors.cardBorder,
              width: isSelected ? 1.5 : 1,
            ),
            labelStyle: TextStyle(
              fontSize: 13,
              fontWeight:
                  isSelected ? FontWeight.w700 : FontWeight.w500,
              color: isSelected ? AppColors.primary : AppColors.inkLight,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 8),
          );
        },
      ),
    );
  }
}

/// Widget recherche par ville — barre de recherche mise en avant.
class SearchBar2 extends StatelessWidget {
  const SearchBar2({
    required this.controller,
    required this.onChanged,
    required this.onClear,
    super.key,
  });

  final TextEditingController controller;
  final VoidCallback onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(10),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: TextField(
        controller: controller,
        onChanged: (_) => onChanged(),
        style: const TextStyle(
          color: AppColors.ink,
          fontSize: 15,
          fontWeight: FontWeight.w500,
        ),
        decoration: InputDecoration(
          hintText: 'Ville, type de bien, titre…',
          hintStyle: const TextStyle(color: AppColors.muted, fontSize: 14),
          prefixIcon: const Padding(
            padding: EdgeInsets.only(left: 4),
            child: Icon(Icons.search_rounded, color: AppColors.muted, size: 22),
          ),
          suffixIcon: controller.text.isEmpty
              ? null
              : IconButton(
                  tooltip: 'Effacer',
                  icon: const Icon(Icons.close_rounded,
                      color: AppColors.muted, size: 20),
                  onPressed: onClear,
                ),
          filled: false,
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(vertical: 14),
        ),
      ),
    );
  }
}
