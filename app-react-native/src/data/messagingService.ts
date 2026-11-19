import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import {
  NOTIFICATION_TYPE_MESSAGE,
  conversationIdFor,
  normalizeConversation,
  normalizeMessage,
  normalizeNotification,
  otherParticipant,
} from './messagingModel';
import type {
  AppNotification,
  ChatMessage,
  Conversation,
} from './messagingModel';

// Collections Firestore partagées avec l'application Flutter :
//   conversations/{listingId}_{acheteurUid}  (+ sous-collection messages)
//   notifications/{uid}/items/{notificationId}

function conversationsCollection() {
  return collection(getFirestore(), 'conversations');
}

function notificationsCollection(uid: string) {
  return collection(getFirestore(), 'notifications', uid, 'items');
}

// Ouvre la conversation de l'acheteur sur cette annonce, en la créant si elle
// n'existe pas encore. Ne modifie jamais une conversation existante.
export async function openConversation(params: {
  listingId: string;
  titreAnnonce: string;
  ownerUid: string;
  buyerUid: string;
}): Promise<string> {
  const id = conversationIdFor(params.listingId, params.buyerUid);
  const reference = doc(conversationsCollection(), id);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) {
    await setDoc(reference, {
      listingId: params.listingId,
      titreAnnonce: params.titreAnnonce,
      participants: [params.ownerUid, params.buyerUid],
      dernierMessage: '',
      dateMiseAJour: serverTimestamp(),
    });
  }
  return id;
}

export async function fetchConversation(
  id: string,
): Promise<Conversation | null> {
  const snapshot = await getDoc(doc(conversationsCollection(), id));
  return snapshot.exists() ? normalizeConversation(snapshot.id, snapshot.data()) : null;
}

export function watchConversations(
  uid: string,
  onChange: (conversations: Conversation[]) => void,
  onError: (error: Error) => void,
): () => void {
  const q = query(
    conversationsCollection(),
    where('participants', 'array-contains', uid),
    orderBy('dateMiseAJour', 'desc'),
  );
  return onSnapshot(
    q,
    snapshot =>
      onChange(
        snapshot.docs.map(document =>
          normalizeConversation(document.id, document.data()),
        ),
      ),
    onError,
  );
}

export function watchMessages(
  conversationId: string,
  onChange: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void,
): () => void {
  const q = query(
    collection(doc(conversationsCollection(), conversationId), 'messages'),
    orderBy('date'),
  );
  return onSnapshot(
    q,
    snapshot =>
      onChange(
        snapshot.docs.map(document =>
          normalizeMessage(document.id, document.data()),
        ),
      ),
    onError,
  );
}

// Envoie le message, met à jour la conversation et notifie le destinataire,
// le tout dans un lot : soit tout réussit, soit rien.
export async function sendMessage(params: {
  conversation: Conversation;
  senderUid: string;
  text: string;
}): Promise<void> {
  const { conversation, senderUid, text } = params;
  const recipient = otherParticipant(conversation, senderUid);
  const db = getFirestore();
  const conversationRef = doc(conversationsCollection(), conversation.id);
  const batch = writeBatch(db);

  batch.set(doc(collection(conversationRef, 'messages')), {
    expediteurId: senderUid,
    contenu: text,
    date: serverTimestamp(),
    lu: false,
  });
  batch.update(conversationRef, {
    dernierMessage: text,
    dateMiseAJour: serverTimestamp(),
  });
  batch.set(doc(notificationsCollection(recipient)), {
    type: NOTIFICATION_TYPE_MESSAGE,
    titre: `Nouveau message · ${conversation.titreAnnonce}`,
    corps: text,
    date: serverTimestamp(),
    lu: false,
    conversationId: conversation.id,
    expediteurId: senderUid,
  });
  await batch.commit();
}

// ----------------------------------------------------------- Notifications

export function watchNotifications(
  uid: string,
  onChange: (items: AppNotification[]) => void,
  onError: (error: Error) => void,
): () => void {
  const q = query(
    notificationsCollection(uid),
    orderBy('date', 'desc'),
    limit(50),
  );
  return onSnapshot(
    q,
    snapshot =>
      onChange(
        snapshot.docs.map(document =>
          normalizeNotification(document.id, document.data()),
        ),
      ),
    onError,
  );
}

export function watchUnreadCount(
  uid: string,
  onChange: (count: number) => void,
): () => void {
  const q = query(notificationsCollection(uid), where('lu', '==', false));
  return onSnapshot(
    q,
    snapshot => onChange(snapshot.size),
    () => onChange(0),
  );
}

export async function markNotificationRead(
  uid: string,
  id: string,
): Promise<void> {
  await updateDoc(doc(notificationsCollection(uid), id), { lu: true });
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const unread = await getDocs(
    query(notificationsCollection(uid), where('lu', '==', false)),
  );
  if (unread.docs.length === 0) {
    return;
  }
  const batch = writeBatch(getFirestore());
  unread.docs.forEach(document => {
    batch.update(document.ref, { lu: true });
  });
  await batch.commit();
}
