import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'auth_screen.dart';
import 'auth_service.dart';
import 'edit_listing_screen.dart';
import 'listing_model.dart';
import 'listing_repository.dart';
import 'listing_screens.dart';
import 'listing_validation.dart';
import 'listing_widgets.dart';
import 'notifications_screen.dart';

const Map<String, String> _roleLabels = {
  'utilisateur': 'Utilisateur',
  'agence': 'Agence',
  'admin': 'Administrateur',
};

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthBuilder(
      builder: (user) {
        if (user == null) {
          return const GuestScaffold(
            title: 'Mon profil',
            message: 'Vous consultez ImmoTN en tant que visiteur. '
                'Connectez-vous pour gérer votre profil et vos annonces.',
            reason: 'Connectez-vous à votre compte ImmoTN.',
          );
        }
        return _ProfileBody(user: user);
      },
    );
  }
}

class _ProfileBody extends StatefulWidget {
  const _ProfileBody({required this.user});

  final User user;

  @override
  State<_ProfileBody> createState() => _ProfileBodyState();
}

class _ProfileBodyState extends State<_ProfileBody> {
  @override
  void initState() {
    super.initState();
    _ensureProfile();
  }

  /// Crée users/{uid} si l'utilisateur n'en a pas encore (ex. ancien compte).
  Future<void> _ensureProfile() async {
    try {
      await ensureUserDocument(
        widget.user,
        displayName: widget.user.displayName,
        photoUrl: widget.user.photoURL,
      );
    } catch (_) {
      // Le profil reste consultable avec les données de l'authentification.
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.user;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Mon profil')),
      body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: ListingRepository.userProfile(user.uid),
        builder: (context, snapshot) {
          final data = snapshot.data?.data() ?? <String, dynamic>{};
          final nom = (data['nom'] as String? ?? '').trim();
          final telephone = (data['telephone'] as String? ?? '').trim();
          final storedPhoto = (data['photoUrl'] as String? ?? '').trim();
          final photoUrl =
              storedPhoto.isNotEmpty ? storedPhoto : (user.photoURL ?? '');
          final email = (data['email'] as String?) ?? user.email ?? '';
          final role = data['role'] as String? ?? 'utilisateur';
          final created = data['dateCreation'];
          final displayName =
              nom.isNotEmpty ? nom : (user.displayName ?? 'Utilisateur ImmoTN');
          final initial =
              displayName.isNotEmpty ? displayName[0].toUpperCase() : '?';

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Column(
                children: [
                  CircleAvatar(
                    radius: 48,
                    backgroundColor: scheme.primaryContainer,
                    backgroundImage:
                        photoUrl.isEmpty ? null : NetworkImage(photoUrl),
                    child: photoUrl.isEmpty
                        ? Text(
                            initial,
                            style: theme.textTheme.headlineMedium?.copyWith(
                              color: scheme.onPrimaryContainer,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(height: 12),
                  Text(displayName, style: theme.textTheme.titleLarge),
                  const SizedBox(height: 4),
                  Text(
                    email,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () => _editProfile(
                      context,
                      nom: nom,
                      telephone: telephone,
                      photoUrl: photoUrl,
                    ),
                    icon: const Icon(Icons.edit_outlined),
                    label: const Text('Modifier le profil'),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Card(
                child: Column(
                  children: [
                    _InfoTile(
                      icon: Icons.phone_outlined,
                      label: 'Téléphone',
                      value: telephone.isEmpty ? 'Non renseigné' : telephone,
                    ),
                    const Divider(height: 1),
                    _InfoTile(
                      icon: Icons.mail_outline,
                      label: 'E-mail',
                      value: email.isEmpty ? '-' : email,
                    ),
                    const Divider(height: 1),
                    _InfoTile(
                      icon: Icons.badge_outlined,
                      label: 'Type de compte',
                      value: _roleLabels[role] ?? role,
                    ),
                    const Divider(height: 1),
                    _InfoTile(
                      icon: Icons.calendar_today_outlined,
                      label: 'Membre depuis',
                      value: created is Timestamp
                          ? formatDate(created.toDate())
                          : '-',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.notifications_none_rounded),
                  title: const Text('Notifications'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => openNotifications(context),
                ),
              ),
              const SizedBox(height: 24),
              Text('Mes annonces', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              _MyListings(uid: user.uid),
              const SizedBox(height: 24),
              OutlinedButton.icon(
                onPressed: signOutAll,
                icon: const Icon(Icons.logout),
                label: const Text('Se déconnecter'),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _editProfile(
    BuildContext context, {
    required String nom,
    required String telephone,
    required String photoUrl,
  }) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _EditProfileSheet(
        uid: widget.user.uid,
        nom: nom,
        telephone: telephone,
        photoUrl: photoUrl,
      ),
    );
    if (saved == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profil mis à jour.')),
      );
    }
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon),
      title: Text(label),
      subtitle: Text(value),
    );
  }
}

class _MyListings extends StatelessWidget {
  const _MyListings({required this.uid});

  final String uid;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Listing>>(
      stream: ListingRepository.myListings(uid),
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return const Text('Impossible de charger vos annonces.');
        }
        if (!snapshot.hasData) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: CircularProgressIndicator(),
            ),
          );
        }
        final listings = snapshot.data!;
        if (listings.isEmpty) {
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Vous n’avez pas encore publié d’annonce. '
                'Utilisez l’onglet Publier pour commencer.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          );
        }
        return Column(
          children: [
            for (final listing in listings) _MyListingTile(listing: listing),
          ],
        );
      },
    );
  }
}

class _MyListingTile extends StatelessWidget {
  const _MyListingTile({required this.listing});

  final Listing listing;

  Future<void> _onAction(BuildContext context, String action) async {
    if (action == 'edit') {
      await openEditListing(context, listing);
      return;
    }
    final messenger = ScaffoldMessenger.of(context);
    try {
      if (action == 'delete') {
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: const Text('Supprimer l’annonce ?'),
            content: const Text('Cette action est définitive.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('Annuler'),
              ),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: Colors.red),
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: const Text('Supprimer'),
              ),
            ],
          ),
        );
        if (confirmed != true) return;
        await ListingRepository.deleteListing(listing);
        messenger.showSnackBar(
          const SnackBar(content: Text('Annonce supprimée.')),
        );
      } else {
        await ListingRepository.updateStatus(listing.id, action);
        messenger.showSnackBar(
          const SnackBar(content: Text('Annonce mise à jour.')),
        );
      }
    } catch (error) {
      messenger.showSnackBar(
        SnackBar(content: Text('Action impossible : $error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        contentPadding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
        leading: SizedBox(
          width: 64,
          height: 64,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: ListingPhoto(url: listing.coverPhoto, height: 64),
          ),
        ),
        title: Text(
          listing.titre,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          '${formatPrice(listing.prix)} · '
          '${statutLabels[listing.statut] ?? listing.statut}',
        ),
        onTap: () => openListingDetail(context, listing),
        trailing: PopupMenuButton<String>(
          tooltip: 'Actions',
          onSelected: (action) => _onAction(context, action),
          itemBuilder: (_) => [
            const PopupMenuItem(
              value: 'edit',
              child: Text('Modifier l’annonce'),
            ),
            if (listing.statut != statutVendue)
              const PopupMenuItem(
                value: statutVendue,
                child: Text('Marquer comme vendue'),
              ),
            if (listing.statut == statutActive)
              const PopupMenuItem(
                value: statutMasquee,
                child: Text('Masquer'),
              ),
            if (listing.statut != statutActive)
              const PopupMenuItem(
                value: statutActive,
                child: Text('Remettre en ligne'),
              ),
            const PopupMenuItem(
              value: 'delete',
              child: Text('Supprimer', style: TextStyle(color: Colors.red)),
            ),
          ],
        ),
      ),
    );
  }
}

class _EditProfileSheet extends StatefulWidget {
  const _EditProfileSheet({
    required this.uid,
    required this.nom,
    required this.telephone,
    required this.photoUrl,
  });

  final String uid;
  final String nom;
  final String telephone;
  final String photoUrl;

  @override
  State<_EditProfileSheet> createState() => _EditProfileSheetState();
}

class _EditProfileSheetState extends State<_EditProfileSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nom;
  late final TextEditingController _telephone;
  Uint8List? _newPhoto;
  String _newPhotoType = 'image/jpeg';
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _nom = TextEditingController(text: widget.nom);
    _telephone = TextEditingController(text: widget.telephone);
  }

  @override
  void dispose() {
    _nom.dispose();
    _telephone.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    try {
      final file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        imageQuality: 80,
        maxWidth: 800,
        maxHeight: 800,
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      setState(() {
        _newPhoto = bytes;
        _newPhotoType = file.mimeType ?? 'image/jpeg';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Impossible de charger la photo.');
    }
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      String? photoUrl;
      final bytes = _newPhoto;
      if (bytes != null) {
        photoUrl = await ListingRepository.uploadProfilePhoto(
          widget.uid,
          PhotoFile(bytes: bytes, contentType: _newPhotoType),
        );
      }
      await ListingRepository.updateProfile(
        widget.uid,
        nom: _nom.text.trim(),
        telephone: _telephone.text.trim(),
        photoUrl: photoUrl,
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Enregistrement impossible : $error');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String? _validatePhone(String? value) {
    final phone = value?.trim() ?? '';
    if (phone.isEmpty) return null;
    return RegExp(r'^\+?[0-9 ]{8,15}$').hasMatch(phone)
        ? null
        : 'Numéro de téléphone invalide.';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final preview = _newPhoto;
    ImageProvider? avatar;
    if (preview != null) {
      avatar = MemoryImage(preview);
    } else if (widget.photoUrl.isNotEmpty) {
      avatar = NetworkImage(widget.photoUrl);
    }

    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        4,
        20,
        MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Modifier le profil', style: theme.textTheme.titleLarge),
              const SizedBox(height: 16),
              CircleAvatar(radius: 40, backgroundImage: avatar),
              TextButton.icon(
                onPressed: _saving ? null : _pickPhoto,
                icon: const Icon(Icons.photo_camera_outlined),
                label: const Text('Changer la photo'),
              ),
              TextFormField(
                controller: _nom,
                decoration: const InputDecoration(labelText: 'Nom'),
                validator: validateRequiredField,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _telephone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Téléphone (facultatif)',
                ),
                validator: _validatePhone,
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ],
              const SizedBox(height: 20),
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
                    child: FilledButton(
                      onPressed: _saving ? null : _save,
                      child: _saving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child:
                                  CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Enregistrer'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
