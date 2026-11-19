import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Avatar,
  GuestGate,
  StatusMessage,
  useAppNavigation,
} from '../../core/components';
import { formatHourOrDate, toDate } from '../../core/format';
import { colors, spacing } from '../../core/theme';
import { otherParticipant } from '../../data/messagingModel';
import type { Conversation } from '../../data/messagingModel';
import { watchConversations } from '../../data/messagingService';
import { useAuthStore } from '../auth/authStore';
import { useCorrespondant } from './useCorrespondant';

// Liste des conversations (MessagesScreen Flutter).
export default function MessagesScreen() {
  const uid = useAuthStore(state => state.uid);
  if (!uid) {
    return (
      <GuestGate
        title="Messages"
        message="Connectez-vous pour échanger avec les propriétaires."
      />
    );
  }
  return <ConversationList uid={uid} />;
}

function ConversationList({ uid }: { uid: string }) {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setConversations(null);
    setError(false);
    return watchConversations(uid, setConversations, () => setError(true));
  }, [uid]);

  if (error) {
    return <StatusMessage title="Impossible de charger vos messages." />;
  }
  if (conversations === null) {
    return <ActivityIndicator style={styles.loader} color={colors.primary} />;
  }
  if (conversations.length === 0) {
    return (
      <StatusMessage
        title="Aucune conversation"
        message="Contactez un propriétaire depuis une annonce pour démarrer un échange."
      />
    );
  }
  return (
    <FlatList
      data={conversations}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => <ConversationTile conversation={item} uid={uid} />}
    />
  );
}

function ConversationTile({
  conversation,
  uid,
}: {
  conversation: Conversation;
  uid: string;
}) {
  const navigation = useAppNavigation();
  const { name, photoUrl } = useCorrespondant(otherParticipant(conversation, uid));
  const updated = toDate(conversation.dateMiseAJour);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('Chat', { conversationId: conversation.id })}
      style={styles.tile}>
      <Avatar name={name} photoUrl={photoUrl} size={52} />
      <View style={styles.tileBody}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.listing} numberOfLines={1}>
          {conversation.titreAnnonce}
        </Text>
        <Text style={styles.last} numberOfLines={1}>
          {conversation.dernierMessage.length === 0
            ? 'Démarrez la conversation'
            : conversation.dernierMessage}
        </Text>
      </View>
      {updated ? <Text style={styles.time}>{formatHourOrDate(updated)}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.lg },
  list: { padding: spacing.md, gap: 10 },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  tileBody: { flex: 1 },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  listing: { color: colors.primary, fontSize: 12 },
  last: { color: colors.muted, fontSize: 13, marginTop: 2 },
  time: { color: colors.muted, fontSize: 11 },
});
