import 'package:cloud_firestore/cloud_firestore.dart';

const String notificationTypeMessage = 'message';

class Conversation {
  const Conversation({
    required this.id,
    required this.listingId,
    required this.titreAnnonce,
    required this.participants,
    required this.dernierMessage,
    this.dateMiseAJour,
  });

  final String id;
  final String listingId;
  final String titreAnnonce;
  final List<String> participants;
  final String dernierMessage;
  final DateTime? dateMiseAJour;

  /// Identifiant de l'autre participant.
  String otherUid(String me) {
    for (final uid in participants) {
      if (uid != me) return uid;
    }
    return '';
  }

  factory Conversation.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    final updated = data['dateMiseAJour'];
    return Conversation(
      id: doc.id,
      listingId: data['listingId'] as String? ?? '',
      titreAnnonce: data['titreAnnonce'] as String? ?? 'Annonce',
      participants: (data['participants'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList(),
      dernierMessage: data['dernierMessage'] as String? ?? '',
      dateMiseAJour: updated is Timestamp ? updated.toDate() : null,
    );
  }
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.expediteurId,
    required this.contenu,
    this.date,
  });

  final String id;
  final String expediteurId;
  final String contenu;

  /// Null tant que l'horodatage serveur n'est pas encore connu.
  final DateTime? date;

  factory ChatMessage.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    final sent = data['date'];
    return ChatMessage(
      id: doc.id,
      expediteurId: data['expediteurId'] as String? ?? '',
      contenu: data['contenu'] as String? ?? '',
      date: sent is Timestamp ? sent.toDate() : null,
    );
  }
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.titre,
    required this.corps,
    required this.lu,
    this.date,
    this.conversationId,
  });

  final String id;
  final String type;
  final String titre;
  final String corps;
  final bool lu;
  final DateTime? date;
  final String? conversationId;

  factory AppNotification.fromDoc(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? <String, dynamic>{};
    final sent = data['date'];
    return AppNotification(
      id: doc.id,
      type: data['type'] as String? ?? '',
      titre: data['titre'] as String? ?? 'Notification',
      corps: data['corps'] as String? ?? '',
      lu: data['lu'] as bool? ?? false,
      date: sent is Timestamp ? sent.toDate() : null,
      conversationId: data['conversationId'] as String?,
    );
  }
}

class MessagingRepository {
  const MessagingRepository._();

  static FirebaseFirestore get _db => FirebaseFirestore.instance;

  static CollectionReference<Map<String, dynamic>> get _conversations =>
      _db.collection('conversations');

  static CollectionReference<Map<String, dynamic>> _notifications(
    String uid,
  ) =>
      _db.collection('notifications').doc(uid).collection('items');

  static String conversationIdFor(String listingId, String buyerUid) =>
      '${listingId}_$buyerUid';

  /// Ouvre la conversation de l'acheteur sur cette annonce, en la créant
  /// si elle n'existe pas encore. Ne modifie jamais une conversation existante.
  static Future<String> openConversation({
    required String listingId,
    required String titreAnnonce,
    required String ownerUid,
    required String buyerUid,
  }) async {
    final id = conversationIdFor(listingId, buyerUid);
    final ref = _conversations.doc(id);
    final snapshot = await ref.get();
    if (!snapshot.exists) {
      await ref.set({
        'listingId': listingId,
        'titreAnnonce': titreAnnonce,
        'participants': [ownerUid, buyerUid],
        'dernierMessage': '',
        'dateMiseAJour': FieldValue.serverTimestamp(),
      });
    }
    return id;
  }

  static Future<Conversation?> fetchConversation(String id) async {
    final snapshot = await _conversations.doc(id).get();
    if (!snapshot.exists) return null;
    return Conversation.fromDoc(snapshot);
  }

  static Stream<List<Conversation>> conversationsFor(String uid) =>
      _conversations
          .where('participants', arrayContains: uid)
          .orderBy('dateMiseAJour', descending: true)
          .snapshots()
          .map((snapshot) =>
              snapshot.docs.map(Conversation.fromDoc).toList());

  static Stream<List<ChatMessage>> messagesOf(String conversationId) =>
      _conversations
          .doc(conversationId)
          .collection('messages')
          .orderBy('date')
          .snapshots()
          .map((snapshot) => snapshot.docs.map(ChatMessage.fromDoc).toList());

  /// Envoie le message, met à jour la conversation et notifie le destinataire,
  /// le tout dans un lot : soit tout réussit, soit rien.
  static Future<void> sendMessage({
    required Conversation conversation,
    required String senderUid,
    required String text,
  }) async {
    final recipient = conversation.otherUid(senderUid);
    final conversationRef = _conversations.doc(conversation.id);
    final batch = _db.batch();

    batch.set(conversationRef.collection('messages').doc(), {
      'expediteurId': senderUid,
      'contenu': text,
      'date': FieldValue.serverTimestamp(),
      'lu': false,
    });
    batch.update(conversationRef, {
      'dernierMessage': text,
      'dateMiseAJour': FieldValue.serverTimestamp(),
    });
    batch.set(_notifications(recipient).doc(), {
      'type': notificationTypeMessage,
      'titre': 'Nouveau message · ${conversation.titreAnnonce}',
      'corps': text,
      'date': FieldValue.serverTimestamp(),
      'lu': false,
      'conversationId': conversation.id,
      'expediteurId': senderUid,
    });
    await batch.commit();
  }

  static Stream<List<AppNotification>> notificationsFor(String uid) =>
      _notifications(uid)
          .orderBy('date', descending: true)
          .limit(50)
          .snapshots()
          .map((snapshot) =>
              snapshot.docs.map(AppNotification.fromDoc).toList());

  static Stream<int> unreadCountFor(String uid) => _notifications(uid)
      .where('lu', isEqualTo: false)
      .snapshots()
      .map((snapshot) => snapshot.size);

  static Future<void> markNotificationRead(String uid, String id) =>
      _notifications(uid).doc(id).update({'lu': true});

  static Future<void> markAllNotificationsRead(String uid) async {
    final unread =
        await _notifications(uid).where('lu', isEqualTo: false).get();
    if (unread.docs.isEmpty) return;
    final batch = _db.batch();
    for (final doc in unread.docs) {
      batch.update(doc.reference, {'lu': true});
    }
    await batch.commit();
  }
}
