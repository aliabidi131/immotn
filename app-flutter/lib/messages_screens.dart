import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_theme.dart';
import 'auth_screen.dart';
import 'edit_listing_screen.dart';
import 'listing_model.dart';
import 'listing_repository.dart';
import 'listing_widgets.dart';
import 'messaging.dart';

/// Nom et photo publics d'un utilisateur, lus depuis users/{uid}.
class _Correspondant extends StatelessWidget {
  const _Correspondant({required this.uid, required this.builder});

  final String uid;
  final Widget Function(String name, String photoUrl) builder;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: ListingRepository.userProfile(uid),
      builder: (context, snapshot) {
        final data = snapshot.data?.data() ?? <String, dynamic>{};
        final nom = (data['nom'] as String? ?? '').trim();
        final photo = (data['photoUrl'] as String? ?? '').trim();
        return builder(nom.isEmpty ? 'Utilisateur ImmoTN' : nom, photo);
      },
    );
  }
}

class MessagesScreen extends StatelessWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthBuilder(
      builder: (user) {
        if (user == null) {
          return const GuestScaffold(
            title: 'Messages',
            message: 'Connectez-vous pour échanger avec les propriétaires.',
            reason: 'Connectez-vous pour consulter vos messages.',
          );
        }
        return Scaffold(
          appBar: AppBar(title: const Text('Messages')),
          body: StreamBuilder<List<Conversation>>(
            stream: MessagingRepository.conversationsFor(user.uid),
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return const StatusMessage(
                  icon: Icons.cloud_off_outlined,
                  title: 'Impossible de charger vos messages.',
                );
              }
              if (!snapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              final conversations = snapshot.data!;
              if (conversations.isEmpty) {
                return const StatusMessage(
                  icon: Icons.chat_bubble_outline,
                  title: 'Aucune conversation',
                  message:
                      'Contactez un propriétaire depuis une annonce pour démarrer un échange.',
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: conversations.length,
                separatorBuilder: (context, index) =>
                    const SizedBox(height: 10),
                itemBuilder: (context, index) => _ConversationTile(
                  conversation: conversations[index],
                  uid: user.uid,
                ),
              );
            },
          ),
        );
      },
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({required this.conversation, required this.uid});

  final Conversation conversation;
  final String uid;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final otherUid = conversation.otherUid(uid);
    return _Correspondant(
      uid: otherUid,
      builder: (name, photo) => Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => ChatScreen(conversation: conversation),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                _Avatar(name: name, photoUrl: photo, radius: 26),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        conversation.titreAnnonce,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        conversation.dernierMessage.isEmpty
                            ? 'Démarrez la conversation'
                            : conversation.dernierMessage,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
                if (conversation.dateMiseAJour != null)
                  Text(
                    _hhmmOrDate(conversation.dateMiseAJour!),
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: AppColors.muted,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.name, required this.photoUrl, this.radius = 20});

  final String name;
  final String photoUrl;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final initial = name.isEmpty ? '?' : name[0].toUpperCase();
    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.primaryTint,
      backgroundImage: photoUrl.isEmpty ? null : NetworkImage(photoUrl),
      child: photoUrl.isEmpty
          ? Text(
              initial,
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w700,
              ),
            )
          : null,
    );
  }
}

String _two(int value) => value.toString().padLeft(2, '0');

String _hhmm(DateTime date) => '${_two(date.hour)}:${_two(date.minute)}';

String _hhmmOrDate(DateTime date) {
  final now = DateTime.now();
  final sameDay =
      now.year == date.year && now.month == date.month && now.day == date.day;
  return sameDay ? _hhmm(date) : '${_two(date.day)}/${_two(date.month)}';
}

/// Écran de conversation : messages en temps réel et envoi.
class ChatScreen extends StatefulWidget {
  const ChatScreen({required this.conversation, super.key});

  final Conversation conversation;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _controller = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send(String uid) async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await MessagingRepository.sendMessage(
        conversation: widget.conversation,
        senderUid: uid,
        text: text,
      );
      if (!mounted) return;
      _controller.clear();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Message non envoyé : $error')),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      return const GuestScaffold(
        title: 'Conversation',
        message: 'Connectez-vous pour lire cette conversation.',
        reason: 'Connectez-vous pour lire cette conversation.',
      );
    }
    final uid = user.uid;
    final otherUid = widget.conversation.otherUid(uid);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: _Correspondant(
          uid: otherUid,
          builder: (name, photo) => Row(
            children: [
              _Avatar(name: name, photoUrl: photo, radius: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: const TextStyle(fontSize: 16)),
                    Text(
                      widget.conversation.titreAnnonce,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.muted,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: StreamBuilder<List<ChatMessage>>(
              stream: MessagingRepository.messagesOf(widget.conversation.id),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return const StatusMessage(
                    icon: Icons.cloud_off_outlined,
                    title: 'Impossible de charger les messages.',
                  );
                }
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                final messages = snapshot.data!;
                if (messages.isEmpty) {
                  return const StatusMessage(
                    icon: Icons.waving_hand_outlined,
                    title: 'Dites bonjour !',
                    message:
                        'Posez vos questions sur ce bien au propriétaire.',
                  );
                }
                return ListView.builder(
                  reverse: true,
                  padding: const EdgeInsets.all(16),
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    final message = messages[messages.length - 1 - index];
                    return _Bubble(
                      message: message,
                      mine: message.expediteurId == uid,
                    );
                  },
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      minLines: 1,
                      maxLines: 4,
                      textCapitalization: TextCapitalization.sentences,
                      decoration:
                          const InputDecoration(hintText: 'Écrire un message…'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    tooltip: 'Envoyer',
                    onPressed: _sending ? null : () => _send(uid),
                    icon: _sending
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.send_rounded),
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

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.mine});

  final ChatMessage message;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    final maxWidth = MediaQuery.sizeOf(context).width * 0.75;
    final date = message.date;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: maxWidth),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 6),
        decoration: BoxDecoration(
          color: mine ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(18),
            topRight: const Radius.circular(18),
            bottomLeft: Radius.circular(mine ? 18 : 4),
            bottomRight: Radius.circular(mine ? 4 : 18),
          ),
        ),
        child: Column(
          crossAxisAlignment:
              mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Text(
              message.contenu,
              style: TextStyle(
                color: mine ? Colors.white : AppColors.ink,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              date == null ? '' : _hhmm(date),
              style: TextStyle(
                fontSize: 11,
                color: mine ? Colors.white70 : AppColors.muted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Barre du bas de la fiche annonce : ouvre ou crée la conversation avec le
/// propriétaire. Un visiteur est invité à se connecter avant.
class ContactOwnerBar extends StatelessWidget {
  const ContactOwnerBar({required this.listing, super.key});

  final Listing listing;

  /// Annonce de démonstration : aucun vrai propriétaire à contacter.
  bool get _isDemo => listing.proprietaireId == 'DEMO';

  void _showDemoInfo(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Ceci est une annonce de démonstration. '
          'Publiez une vraie annonce pour être contacté.',
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

  Future<void> _contact(BuildContext context) async {
    final signedIn = await requireSignIn(
      context,
      reason: 'Connectez-vous pour contacter le propriétaire.',
    );
    if (!signedIn || !context.mounted) return;
    final buyer = FirebaseAuth.instance.currentUser;
    if (buyer == null) return;
    try {
      final id = await MessagingRepository.openConversation(
        listingId: listing.id,
        titreAnnonce: listing.titre,
        ownerUid: listing.proprietaireId,
        buyerUid: buyer.uid,
      );
      final conversation = await MessagingRepository.fetchConversation(id);
      if (conversation == null || !context.mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ChatScreen(conversation: conversation),
        ),
      );
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Conversation impossible : $error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthBuilder(
      builder: (user) {
        final isOwner = user != null && user.uid == listing.proprietaireId;
        return Container(
          color: Colors.white,
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: isOwner
                  ? SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: () => openEditListing(context, listing),
                        icon: const Icon(Icons.edit_outlined),
                        label: const Text('Modifier l’annonce'),
                      ),
                    )
                  : Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: _isDemo
                                ? () => _showDemoInfo(context)
                                : () => _contact(context),
                            icon: const Icon(Icons.chat_bubble_outline),
                            label: const Text('Contacter le propriétaire'),
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
          ),
        );
      },
    );
  }
}
