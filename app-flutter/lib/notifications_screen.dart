import 'package:flutter/material.dart';

import 'app_theme.dart';
import 'auth_screen.dart';
import 'listing_widgets.dart';
import 'messages_screens.dart';
import 'messaging.dart';

/// Ouvre le centre de notifications (la page gère elle-même le visiteur).
void openNotifications(BuildContext context) {
  Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => const NotificationsScreen()),
  );
}

/// Cloche de l'en-tête avec compteur de notifications non lues.
class NotificationBell extends StatelessWidget {
  const NotificationBell({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthBuilder(
      builder: (user) {
        if (user == null) {
          return IconButton(
            tooltip: 'Notifications',
            icon: const Icon(Icons.notifications_none_rounded),
            onPressed: () async {
              final signedIn = await requireSignIn(
                context,
                reason: 'Connectez-vous pour voir vos notifications.',
              );
              if (signedIn && context.mounted) openNotifications(context);
            },
          );
        }
        return StreamBuilder<int>(
          stream: MessagingRepository.unreadCountFor(user.uid),
          builder: (context, snapshot) {
            final count = snapshot.data ?? 0;
            return IconButton(
              tooltip: 'Notifications',
              onPressed: () => openNotifications(context),
              icon: Badge(
                isLabelVisible: count > 0,
                label: Text(count > 9 ? '9+' : '$count'),
                child: const Icon(Icons.notifications_none_rounded),
              ),
            );
          },
        );
      },
    );
  }
}

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthBuilder(
      builder: (user) {
        if (user == null) {
          return const GuestScaffold(
            title: 'Notifications',
            message: 'Connectez-vous pour suivre vos échanges et annonces.',
            reason: 'Connectez-vous pour voir vos notifications.',
          );
        }
        return Scaffold(
          appBar: AppBar(
            title: const Text('Notifications'),
            actions: [
              IconButton(
                tooltip: 'Tout marquer comme lu',
                icon: const Icon(Icons.done_all_rounded),
                onPressed: () async {
                  final messenger = ScaffoldMessenger.of(context);
                  try {
                    await MessagingRepository.markAllNotificationsRead(
                      user.uid,
                    );
                  } catch (error) {
                    messenger.showSnackBar(
                      SnackBar(content: Text('Action impossible : $error')),
                    );
                  }
                },
              ),
            ],
          ),
          body: StreamBuilder<List<AppNotification>>(
            stream: MessagingRepository.notificationsFor(user.uid),
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return const StatusMessage(
                  icon: Icons.cloud_off_outlined,
                  title: 'Impossible de charger vos notifications.',
                );
              }
              if (!snapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              final items = snapshot.data!;
              if (items.isEmpty) {
                return const StatusMessage(
                  icon: Icons.notifications_off_outlined,
                  title: 'Vous êtes à jour !',
                  message: 'Vos nouvelles notifications apparaîtront ici.',
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                separatorBuilder: (context, index) =>
                    const SizedBox(height: 10),
                itemBuilder: (context, index) => _NotificationTile(
                  notification: items[index],
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

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.uid});

  final AppNotification notification;
  final String uid;

  Future<void> _open(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      if (!notification.lu) {
        await MessagingRepository.markNotificationRead(uid, notification.id);
      }
      final conversationId = notification.conversationId;
      if (conversationId == null || conversationId.isEmpty) return;
      final conversation =
          await MessagingRepository.fetchConversation(conversationId);
      if (conversation == null || !context.mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ChatScreen(conversation: conversation),
        ),
      );
    } catch (error) {
      messenger.showSnackBar(
        SnackBar(content: Text('Ouverture impossible : $error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final unread = !notification.lu;
    final sent = notification.date;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _open(context),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                backgroundColor: AppColors.primaryTint,
                child: Icon(
                  notification.type == notificationTypeMessage
                      ? Icons.chat_bubble_rounded
                      : Icons.notifications_rounded,
                  color: AppColors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notification.titre,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight:
                            unread ? FontWeight.w800 : FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      notification.corps,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                children: [
                  if (sent != null)
                    Text(
                      '${sent.day.toString().padLeft(2, '0')}/'
                      '${sent.month.toString().padLeft(2, '0')}',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: AppColors.muted,
                      ),
                    ),
                  const SizedBox(height: 6),
                  if (unread)
                    const CircleAvatar(
                      radius: 4,
                      backgroundColor: AppColors.primary,
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
