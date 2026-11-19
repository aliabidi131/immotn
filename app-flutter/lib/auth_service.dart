import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

/// Client OAuth « Web » (client_type 3) présent dans google-services.json.
/// Ce n'est pas un secret : il sert d'audience (serverClientId) pour obtenir
/// un idToken Google sur Android.
const String _googleServerClientId =
    '517301967098-bug8m9te42ccmqnh1bfeufke3hp8alg4.apps.googleusercontent.com';

bool _googleReady = false;

/// Vrai si le bouton Google peut fonctionner sur la plateforme courante.
bool get isGoogleSignInAvailable => kIsWeb || _googleReady;

/// À appeler une seule fois au démarrage, après Firebase.initializeApp.
/// Ne lève jamais d'exception : un échec désactive seulement Google,
/// le Marketplace reste accessible.
Future<void> initGoogleSignIn() async {
  if (kIsWeb) return;
  try {
    await GoogleSignIn.instance.initialize(
      serverClientId: _googleServerClientId,
    );
    _googleReady = true;
  } catch (error) {
    debugPrint('Google Sign-In non initialisé : $error');
  }
}

/// Connexion avec Google. Retourne null si l'utilisateur annule.
Future<User?> signInWithGoogle() async {
  if (kIsWeb) {
    try {
      final credential =
          await FirebaseAuth.instance.signInWithPopup(GoogleAuthProvider());
      return credential.user;
    } on FirebaseAuthException catch (error) {
      if (error.code == 'popup-closed-by-user' ||
          error.code == 'cancelled-popup-request') {
        return null;
      }
      rethrow;
    }
  }

  if (!_googleReady) {
    throw StateError('Connexion Google indisponible sur cet appareil.');
  }

  final GoogleSignInAccount account;
  try {
    account = await GoogleSignIn.instance.authenticate();
  } on GoogleSignInException catch (error) {
    if (error.code == GoogleSignInExceptionCode.canceled) return null;
    rethrow;
  }

  final idToken = account.authentication.idToken;
  if (idToken == null) {
    throw StateError('Google n’a pas fourni de jeton d’identification.');
  }

  final credential = await FirebaseAuth.instance.signInWithCredential(
    GoogleAuthProvider.credential(idToken: idToken),
  );
  return credential.user;
}

/// Crée users/{uid} uniquement s'il n'existe pas encore.
/// Ne modifie jamais un document existant.
Future<void> ensureUserDocument(
  User user, {
  String? displayName,
  String? photoUrl,
}) async {
  final db = FirebaseFirestore.instance;
  final ref = db.collection('users').doc(user.uid);
  await db.runTransaction((transaction) async {
    final snapshot = await transaction.get(ref);
    if (snapshot.exists) return;
    transaction.set(ref, {
      'id': user.uid,
      'nom': displayName ?? '',
      'email': user.email ?? '',
      'telephone': '',
      'photoUrl': photoUrl ?? '',
      'role': 'utilisateur',
      'dateCreation': FieldValue.serverTimestamp(),
      'jetonNotification': '',
    });
  });
}

/// Déconnexion Google (si active) puis Firebase.
Future<void> signOutAll() async {
  if (!kIsWeb && _googleReady) {
    try {
      await GoogleSignIn.instance.signOut();
    } catch (_) {
      // Ignoré : la déconnexion Firebase doit quand même aboutir.
    }
  }
  await FirebaseAuth.instance.signOut();
}

/// Message lisible pour l'utilisateur.
String authErrorMessage(Object error) {
  if (error is FirebaseAuthException) {
    switch (error.code) {
      case 'email-already-in-use':
        return 'Un compte existe déjà avec cet e-mail.';
      case 'invalid-email':
        return 'L’adresse e-mail est invalide.';
      case 'weak-password':
        return 'Le mot de passe est trop faible.';
      case 'invalid-credential':
      case 'user-not-found':
      case 'wrong-password':
        return 'E-mail ou mot de passe incorrect.';
      case 'too-many-requests':
        return 'Trop de tentatives. Réessayez plus tard.';
      case 'account-exists-with-different-credential':
        return 'Un compte existe déjà avec cet e-mail. Connectez-vous par e-mail.';
      case 'network-request-failed':
        return 'Pas de connexion réseau.';
      default:
        return error.message ?? 'Erreur d’authentification.';
    }
  }
  if (error is StateError) return error.message;
  if (error is GoogleSignInException) {
    return 'Connexion Google impossible.';
  }
  return 'Opération impossible : $error';
}
