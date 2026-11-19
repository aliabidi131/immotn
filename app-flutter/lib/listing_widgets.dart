import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_theme.dart';
import 'auth_screen.dart';
import 'listing_model.dart';
import 'listing_repository.dart';

/// Photo d'annonce avec état de chargement et repli si l'image est absente.
class ListingPhoto extends StatelessWidget {
  const ListingPhoto({required this.url, this.height = 180, super.key});

  final String url;
  final double height;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final placeholder = Container(
      height: height,
      width: double.infinity,
      color: scheme.surfaceContainerHighest,
      alignment: Alignment.center,
      child: Icon(
        Icons.home_work_outlined,
        size: 48,
        color: scheme.onSurfaceVariant,
      ),
    );
    if (url.isEmpty) return placeholder;
    return Image.network(
      url,
      height: height,
      width: double.infinity,
      fit: BoxFit.cover,
      loadingBuilder: (context, child, progress) {
        if (progress == null) return child;
        return SizedBox(
          height: height,
          child: const Center(
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        );
      },
      errorBuilder: (context, error, stack) => placeholder,
    );
  }
}

/// Carte d'annonce (liste verticale : favoris, annonces propriétaire).
class ListingCard extends StatelessWidget {
  const ListingCard({
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
      margin: const EdgeInsets.only(bottom: 14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                ListingPhoto(url: listing.coverPhoto, height: 180),
                Positioned(
                  left: 12,
                  top: 12,
                  child: TransactionBadge(
                    label: transactionLabel(listing.typeTransaction),
                  ),
                ),
                if (listing.isDemo)
                  const Positioned(
                    left: 12,
                    bottom: 12,
                    child: DemoBadge(),
                  ),
                if (trailing != null)
                  Positioned(
                    right: 8,
                    top: 8,
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
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    listing.titre,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleSmall?.copyWith(
                      color: AppColors.ink,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    formatPrice(listing.prix),
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.place_rounded,
                          size: 15, color: AppColors.muted),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          listing.ville.isEmpty
                              ? typeBienLabel(listing.typeBien)
                              : '${listing.ville} · ${typeBienLabel(listing.typeBien)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.muted,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${formatQuantity(listing.surface)} m²'
                    '${listing.nombrePieces > 0 ? ' · ${listing.nombrePieces} pièce(s)' : ''}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.muted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Cœur favori. Un visiteur est invité à se connecter au moment de l'action.
class FavoriteButton extends StatelessWidget {
  const FavoriteButton({required this.listingId, super.key});

  final String listingId;

  @override
  Widget build(BuildContext context) {
    return AuthBuilder(
      builder: (user) {
        if (user == null) {
          return IconButton(
            tooltip: 'Ajouter aux favoris',
            icon: const Icon(Icons.favorite_border, color: Colors.grey),
            onPressed: () async {
              final signedIn = await requireSignIn(
                context,
                reason:
                    'Connectez-vous pour ajouter cette annonce à vos favoris.',
              );
              if (!signedIn) return;
              final uid = FirebaseAuth.instance.currentUser?.uid;
              if (uid == null) return;
              // Intention : ajouter. set() est idempotent.
              await ListingRepository.setFavorite(uid, listingId, true);
            },
          );
        }
        return StreamBuilder<bool>(
          stream: ListingRepository.isFavorite(user.uid, listingId),
          builder: (context, snapshot) {
            final isFavorite = snapshot.data ?? false;
            return IconButton(
              tooltip:
                  isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris',
              icon: Icon(
                isFavorite ? Icons.favorite : Icons.favorite_border,
                color: isFavorite ? Colors.red : Colors.grey,
              ),
              onPressed: () => ListingRepository.setFavorite(
                user.uid,
                listingId,
                !isFavorite,
              ),
            );
          },
        );
      },
    );
  }
}

/// Barre fixe en bas du detail screen : contacter ou envoyer un message.
class ContactOwnerBar extends StatelessWidget {
  const ContactOwnerBar({required this.listing, super.key});

  final Listing listing;

  @override
  Widget build(BuildContext context) {
    // Annonces DEMO : pas de vrai propriétaire
    final isDemo = listing.proprietaireId == 'DEMO';

    return SafeArea(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(
            top: BorderSide(color: AppColors.divider),
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: isDemo
                    ? () => _showDemoInfo(context)
                    : () => _contactOwner(context),
                icon: const Icon(Icons.message_rounded, size: 18),
                label: const Text('Contacter'),
              ),
            ),
            const SizedBox(width: 10),
            OutlinedButton(
              onPressed: () => _share(context),
              child: const Icon(Icons.share_rounded),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _contactOwner(BuildContext context) async {
    final signedIn = await requireSignIn(
      context,
      reason: 'Connectez-vous pour contacter le propriétaire.',
    );
    if (!signedIn || !context.mounted) return;
    // La navigation vers la conversation est gérée dans messages_screens
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Fonctionnalité de messagerie disponible dans l’onglet Messages.'),
        duration: Duration(seconds: 3),
      ),
    );
  }

  void _showDemoInfo(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Ceci est une annonce de démonstration. Publiez une vraie annonce pour être contacté.',
        ),
        duration: Duration(seconds: 4),
      ),
    );
  }

  void _share(BuildContext context) {
    final text =
        '${listing.titre}\n${formatPrice(listing.prix)} \u2022 ${listing.ville}\n';
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Annonce copiée dans le presse-papier.')),
    );
  }
}

/// Pastille « DÉMO » : signale une annonce fictive, jamais une vraie annonce.
class DemoBadge extends StatelessWidget {
  const DemoBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.black.withAlpha(170),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Text(
        'DÉMO',
        style: TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

class StatusMessage extends StatelessWidget {
  const StatusMessage({
    required this.icon,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
    super.key,
  });

  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: theme.colorScheme.primary),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium,
            ),
            if (message != null) ...[
              const SizedBox(height: 8),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 16),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}
