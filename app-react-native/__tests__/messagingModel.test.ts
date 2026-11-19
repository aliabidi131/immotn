import {
  conversationIdFor,
  displayNameOf,
  normalizeConversation,
  normalizeMessage,
  normalizeNotification,
  otherParticipant,
} from '../src/data/messagingModel';

describe('conversations', () => {
  test('identifiant {listingId}_{acheteurUid}, identique à Flutter', () => {
    expect(conversationIdFor('L42', 'buyer7')).toBe('L42_buyer7');
  });

  test('otherParticipant renvoie l’autre utilisateur', () => {
    const conv = { participants: ['owner', 'buyer'] };
    expect(otherParticipant(conv, 'owner')).toBe('buyer');
    expect(otherParticipant(conv, 'buyer')).toBe('owner');
    expect(otherParticipant({ participants: [] }, 'x')).toBe('');
  });

  test('normalizeConversation avec valeurs par défaut', () => {
    const conv = normalizeConversation('c1', {
      listingId: 'L1',
      titreAnnonce: 'Villa',
      participants: ['a', 'b', 3],
      dernierMessage: 'Bonjour',
    });
    expect(conv.id).toBe('c1');
    expect(conv.participants).toEqual(['a', 'b']);
    expect(conv.dateMiseAJour).toBeNull();
    const empty = normalizeConversation('c2', undefined);
    expect(empty.titreAnnonce).toBe('Annonce');
    expect(empty.participants).toEqual([]);
    expect(empty.dernierMessage).toBe('');
  });
});

describe('messages et notifications', () => {
  test('normalizeMessage', () => {
    const msg = normalizeMessage('m1', { expediteurId: 'u', contenu: 'Salut' });
    expect(msg).toEqual({
      id: 'm1',
      expediteurId: 'u',
      contenu: 'Salut',
      date: null,
    });
  });

  test('normalizeNotification', () => {
    const n = normalizeNotification('n1', {
      type: 'message',
      titre: 'Nouveau message · Villa',
      corps: 'Bonjour',
      lu: false,
      conversationId: 'L1_b',
    });
    expect(n.lu).toBe(false);
    expect(n.conversationId).toBe('L1_b');
    const def = normalizeNotification('n2', {});
    expect(def.titre).toBe('Notification');
    expect(def.lu).toBe(false);
    expect(def.conversationId).toBeNull();
  });

  test('displayNameOf', () => {
    expect(displayNameOf('  Sami  ')).toBe('Sami');
    expect(displayNameOf('')).toBe('Utilisateur ImmoTN');
    expect(displayNameOf(undefined)).toBe('Utilisateur ImmoTN');
  });
});
