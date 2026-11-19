import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GuestGate, StatusMessage } from '../../core/components';
import { toDate } from '../../core/format';
import { colors, spacing } from '../../core/theme';
import { NOTIFICATION_TYPE_MESSAGE } from '../../data/messagingModel';
import type { AppNotification } from '../../data/messagingModel';
import {
  fetchConversation,
  markAllNotificationsRead,
  markNotificationRead,
  watchNotifications,
} from '../../data/messagingService';
import { useAuthStore } from '../auth/authStore';
import type { AppStackParamList } from '../listings/navigationTypes';

type Props = NativeStackScreenProps<AppStackParamList, 'Notifications'>;

// Centre de notifications (NotificationsScreen Flutter).
export default function NotificationsScreen({ navigation }: Props) {
  const uid = useAuthStore(state => state.uid);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    return watchNotifications(uid, setItems, () => setError(true));
  }, [uid]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        uid ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tout marquer comme lu"
            hitSlop={8}
            onPress={() =>
              markAllNotificationsRead(uid).catch(() =>
                Alert.alert('Action impossible', 'Réessayez plus tard.'),
              )
            }>
            <Text style={styles.markAll}>Tout lu ✓</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, uid]);

  if (!uid) {
    return (
      <GuestGate
        title="Notifications"
        message="Connectez-vous pour suivre vos échanges et annonces."
      />
    );
  }
  if (error) {
    return <StatusMessage title="Impossible de charger vos notifications." />;
  }
  if (items === null) {
    return <ActivityIndicator style={styles.loader} color={colors.primary} />;
  }
  if (items.length === 0) {
    return (
      <StatusMessage
        title="Vous êtes à jour !"
        message="Vos nouvelles notifications apparaîtront ici."
      />
    );
  }
  return (
    <FlatList
      data={items}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <NotificationTile
          notification={item}
          uid={uid}
          onOpenChat={conversationId =>
            navigation.navigate('Chat', { conversationId })
          }
        />
      )}
    />
  );
}

function NotificationTile({
  notification,
  uid,
  onOpenChat,
}: {
  notification: AppNotification;
  uid: string;
  onOpenChat: (conversationId: string) => void;
}) {
  const unread = !notification.lu;
  const sent = toDate(notification.date);

  const open = async () => {
    try {
      if (unread) {
        await markNotificationRead(uid, notification.id);
      }
      const conversationId = notification.conversationId;
      if (!conversationId) {
        return;
      }
      const conversation = await fetchConversation(conversationId);
      if (conversation) {
        onOpenChat(conversation.id);
      }
    } catch {
      Alert.alert('Ouverture impossible', 'Réessayez plus tard.');
    }
  };

  return (
    <Pressable accessibilityRole="button" onPress={open} style={styles.tile}>
      <View style={styles.iconCircle}>
        <Text>{notification.type === NOTIFICATION_TYPE_MESSAGE ? '💬' : '🔔'}</Text>
      </View>
      <View style={styles.tileBody}>
        <Text style={[styles.title, unread && styles.titleUnread]}>
          {notification.titre}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {notification.corps}
        </Text>
      </View>
      <View style={styles.meta}>
        {sent ? (
          <Text style={styles.date}>
            {String(sent.getDate()).padStart(2, '0')}/
            {String(sent.getMonth() + 1).padStart(2, '0')}
          </Text>
        ) : null}
        {unread ? <View style={styles.dot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.lg },
  list: { padding: spacing.md, gap: 10 },
  markAll: { color: colors.primary, fontWeight: '600' },
  tile: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBody: { flex: 1 },
  title: { color: colors.text, fontWeight: '500', fontSize: 14 },
  titleUnread: { fontWeight: '800' },
  body: { color: colors.muted, fontSize: 13, marginTop: 2 },
  meta: { alignItems: 'center', gap: 6 },
  date: { color: colors.muted, fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
