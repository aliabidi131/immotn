import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar, GuestGate, StatusMessage } from '../../core/components';
import { formatHourMinute, toDate } from '../../core/format';
import { colors, spacing } from '../../core/theme';
import { MAX_MESSAGE_LENGTH, otherParticipant } from '../../data/messagingModel';
import type { ChatMessage, Conversation } from '../../data/messagingModel';
import {
  fetchConversation,
  sendMessage,
  watchMessages,
} from '../../data/messagingService';
import { useAuthStore } from '../auth/authStore';
import type { AppStackParamList } from '../listings/navigationTypes';
import { useCorrespondant } from './useCorrespondant';

type Props = NativeStackScreenProps<AppStackParamList, 'Chat'>;

// Écran de conversation : messages en temps réel et envoi (ChatScreen Flutter).
export default function ChatScreen({ route, navigation }: Props) {
  const uid = useAuthStore(state => state.uid);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    fetchConversation(route.params.conversationId)
      .then(result => {
        if (!active) {
          return;
        }
        if (result) {
          setConversation(result);
        } else {
          setMissing(true);
        }
      })
      .catch(() => active && setMissing(true));
    return () => {
      active = false;
    };
  }, [route.params.conversationId]);

  if (!uid) {
    return (
      <GuestGate
        title="Conversation"
        message="Connectez-vous pour lire cette conversation."
      />
    );
  }
  if (missing) {
    return <StatusMessage title="Conversation introuvable." />;
  }
  if (!conversation) {
    return <ActivityIndicator style={styles.loader} color={colors.primary} />;
  }
  return (
    <ChatBody uid={uid} conversation={conversation} setTitle={navigation.setOptions} />
  );
}

function ChatBody({
  uid,
  conversation,
  setTitle,
}: {
  uid: string;
  conversation: Conversation;
  setTitle: (options: { title: string }) => void;
}) {
  const otherUid = otherParticipant(conversation, uid);
  const { name, photoUrl } = useCorrespondant(otherUid);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setTitle({ title: name });
  }, [name, setTitle]);

  useEffect(() => {
    return watchMessages(conversation.id, setMessages, () => setError(true));
  }, [conversation.id]);

  // Liste inversée : le plus récent en bas.
  const reversed = useMemo(() => (messages ? [...messages].reverse() : []), [messages]);

  const send = async () => {
    const content = text.trim();
    if (content.length === 0 || sending) {
      return;
    }
    setSending(true);
    try {
      await sendMessage({ conversation, senderUid: uid, text: content });
      setText('');
    } catch {
      Alert.alert('Message non envoyé', 'Vérifiez votre connexion et réessayez.');
    } finally {
      setSending(false);
    }
  };

  let content: React.ReactNode;
  if (error) {
    content = <StatusMessage title="Impossible de charger les messages." />;
  } else if (messages === null) {
    content = <ActivityIndicator style={styles.loader} color={colors.primary} />;
  } else if (messages.length === 0) {
    content = (
      <StatusMessage
        title="Dites bonjour !"
        message="Posez vos questions sur ce bien au propriétaire."
      />
    );
  } else {
    content = (
      <FlatList
        inverted
        data={reversed}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messages}
        renderItem={({ item }) => (
          <Bubble message={item} mine={item.expediteurId === uid} />
        )}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={styles.header}>
        <Avatar name={name} photoUrl={photoUrl} size={32} />
        <Text style={styles.headerListing} numberOfLines={1}>
          {conversation.titreAnnonce}
        </Text>
      </View>
      <View style={styles.flex}>{content}</View>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Écrire un message…"
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Envoyer"
          disabled={sending}
          onPress={send}
          style={[styles.send, sending && styles.sendDisabled]}>
          {sending ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.sendText}>➤</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const date = toDate(message.date);
  return (
    <View style={[styles.bubbleRow, mine ? styles.rowRight : styles.rowLeft]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
        <Text style={mine ? styles.textMine : styles.textOther}>
          {message.contenu}
        </Text>
        <Text style={mine ? styles.timeMine : styles.timeOther}>
          {date ? formatHourMinute(date) : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screen },
  flex: { flex: 1 },
  loader: { marginTop: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerListing: { color: colors.primary, flex: 1, fontSize: 13 },
  messages: { padding: spacing.md },
  bubbleRow: { flexDirection: 'row', marginBottom: 8 },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, borderRadius: 18 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  textMine: { color: colors.background, lineHeight: 20 },
  textOther: { color: colors.text, lineHeight: 20 },
  timeMine: { color: 'rgba(255,255,255,0.75)', fontSize: 11, alignSelf: 'flex-end', marginTop: 4 },
  timeOther: { color: colors.muted, fontSize: 11, alignSelf: 'flex-end', marginTop: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: spacing.sm + 4,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: colors.text,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.6 },
  sendText: { color: colors.background, fontSize: 18 },
});
