// Modèles de la messagerie et des notifications (messaging.dart côté Flutter).
// Collections Firestore :
//   conversations/{listingId}_{acheteurUid}          (+ sous-collection messages)
//   notifications/{uid}/items/{notificationId}

export const NOTIFICATION_TYPE_MESSAGE = 'message';

export interface Conversation {
  id: string;
  listingId: string;
  titreAnnonce: string;
  participants: string[];
  dernierMessage: string;
  dateMiseAJour: unknown;
}

export interface ChatMessage {
  id: string;
  expediteurId: string;
  contenu: string;
  // Null tant que l'horodatage serveur n'est pas connu.
  date: unknown;
}

export interface AppNotification {
  id: string;
  type: string;
  titre: string;
  corps: string;
  lu: boolean;
  date: unknown;
  conversationId: string | null;
}

// Longueur maximale d'un message (règle Firestore : contenu.size() <= 2000).
export const MAX_MESSAGE_LENGTH = 2000;

// Identifiant de la conversation d'un acheteur sur une annonce.
export function conversationIdFor(listingId: string, buyerUid: string): string {
  return `${listingId}_${buyerUid}`;
}

// Identifiant de l'autre participant d'une conversation.
export function otherParticipant(
  conversation: Pick<Conversation, 'participants'>,
  me: string,
): string {
  return conversation.participants.find(uid => uid !== me) ?? '';
}

function record(data: unknown): Record<string, unknown> {
  return (typeof data === 'object' && data !== null ? data : {}) as Record<
    string,
    unknown
  >;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export function normalizeConversation(id: string, data: unknown): Conversation {
  const raw = record(data);
  return {
    id,
    listingId: text(raw.listingId, ''),
    titreAnnonce: text(raw.titreAnnonce, 'Annonce'),
    participants: Array.isArray(raw.participants)
      ? raw.participants.filter((p): p is string => typeof p === 'string')
      : [],
    dernierMessage: text(raw.dernierMessage, ''),
    dateMiseAJour: raw.dateMiseAJour ?? null,
  };
}

export function normalizeMessage(id: string, data: unknown): ChatMessage {
  const raw = record(data);
  return {
    id,
    expediteurId: text(raw.expediteurId, ''),
    contenu: text(raw.contenu, ''),
    date: raw.date ?? null,
  };
}

export function normalizeNotification(
  id: string,
  data: unknown,
): AppNotification {
  const raw = record(data);
  return {
    id,
    type: text(raw.type, ''),
    titre: text(raw.titre, 'Notification'),
    corps: text(raw.corps, ''),
    lu: raw.lu === true,
    date: raw.date ?? null,
    conversationId:
      typeof raw.conversationId === 'string' ? raw.conversationId : null,
  };
}

// Nom d'affichage d'un correspondant (profil users/{uid}).
export function displayNameOf(nom: unknown): string {
  const value = typeof nom === 'string' ? nom.trim() : '';
  return value.length === 0 ? 'Utilisateur ImmoTN' : value;
}
