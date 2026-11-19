import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import 'auth_service.dart';

/// Ouvre l'écran de connexion uniquement si nécessaire.
/// Retourne true si l'utilisateur est connecté à la fin.
Future<bool> requireSignIn(
  BuildContext context, {
  required String reason,
}) async {
  if (FirebaseAuth.instance.currentUser != null) return true;
  final result = await Navigator.of(context).push<bool>(
    MaterialPageRoute<bool>(
      fullscreenDialog: true,
      builder: (_) => AuthScreen(reason: reason),
    ),
  );
  return result == true && FirebaseAuth.instance.currentUser != null;
}

/// Reconstruit son contenu à chaque changement de session.
class AuthBuilder extends StatelessWidget {
  const AuthBuilder({required this.builder, super.key});

  final Widget Function(User? user) builder;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      initialData: FirebaseAuth.instance.currentUser,
      builder: (context, snapshot) => builder(snapshot.data),
    );
  }
}

/// Écran affiché à la place d'une fonctionnalité réservée aux comptes.
class GuestScaffold extends StatelessWidget {
  const GuestScaffold({
    required this.title,
    required this.message,
    required this.reason,
    super.key,
  });

  final String title;
  final String message;
  final String reason;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock_outline, size: 48),
              const SizedBox(height: 16),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => requireSignIn(context, reason: reason),
                child: const Text('Se connecter'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({this.reason, super.key});

  final String? reason;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _isRegistering = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  /// Exécute une action d'authentification. Si elle réussit, ferme l'écran
  /// en renvoyant true pour que l'action initiale puisse reprendre.
  Future<void> _runAuth(Future<bool> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final success = await action();
      if (success && mounted && Navigator.of(context).canPop()) {
        Navigator.of(context).pop(true);
        return;
      }
    } catch (error) {
      if (mounted) setState(() => _error = authErrorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submitGoogle() => _runAuth(() async {
        final user = await signInWithGoogle();
        if (user == null) return false; // Annulé par l'utilisateur.
        await ensureUserDocument(
          user,
          displayName: user.displayName,
          photoUrl: user.photoURL,
        );
        return true;
      });

  Future<void> _submitEmail() async {
    if (!_formKey.currentState!.validate()) return;
    await _runAuth(() async {
      final auth = FirebaseAuth.instance;
      final email = _email.text.trim();
      if (_isRegistering) {
        final credential = await auth.createUserWithEmailAndPassword(
          email: email,
          password: _password.text,
        );
        final user = credential.user;
        if (user == null) {
          throw StateError('Firebase n’a pas retourné de compte utilisateur.');
        }
        await ensureUserDocument(user);
      } else {
        await auth.signInWithEmailAndPassword(
          email: email,
          password: _password.text,
        );
      }
      return true;
    });
  }

  Future<void> _resetPassword() async {
    final email = _email.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'Saisissez votre adresse e-mail.');
      return;
    }
    try {
      await FirebaseAuth.instance.sendPasswordResetEmail(email: email);
      if (mounted) {
        setState(() => _error = 'E-mail de réinitialisation envoyé.');
      }
    } catch (error) {
      if (mounted) setState(() => _error = authErrorMessage(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final googleEnabled = !_busy && isGoogleSignInAvailable;
    return Scaffold(
      appBar: AppBar(
        title: Text(_isRegistering ? 'Créer un compte' : 'Connexion'),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (widget.reason != null) ...[
                    Text(
                      widget.reason!,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    const SizedBox(height: 20),
                  ],
                  OutlinedButton.icon(
                    onPressed: googleEnabled ? _submitGoogle : null,
                    icon: const Icon(Icons.login),
                    label: const Text('Continuer avec Google'),
                  ),
                  const SizedBox(height: 16),
                  const Row(
                    children: [
                      Expanded(child: Divider()),
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 12),
                        child: Text('ou'),
                      ),
                      Expanded(child: Divider()),
                    ],
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'E-mail'),
                    validator: (value) {
                      final email = value?.trim() ?? '';
                      return email.contains('@') ? null : 'E-mail invalide.';
                    },
                  ),
                  TextFormField(
                    controller: _password,
                    obscureText: true,
                    decoration:
                        const InputDecoration(labelText: 'Mot de passe'),
                    validator: (value) {
                      final password = value ?? '';
                      return password.length >= 6
                          ? null
                          : '6 caractères minimum.';
                    },
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _busy ? null : _submitEmail,
                    child: _busy
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(
                            _isRegistering
                                ? 'Créer mon compte'
                                : 'Se connecter avec e-mail',
                          ),
                  ),
                  if (!_isRegistering)
                    TextButton(
                      onPressed: _busy ? null : _resetPassword,
                      child: const Text('Mot de passe oublié ?'),
                    ),
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => setState(() {
                              _isRegistering = !_isRegistering;
                              _error = null;
                            }),
                    child: Text(
                      _isRegistering
                          ? 'J’ai déjà un compte'
                          : 'Créer un compte avec e-mail',
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
