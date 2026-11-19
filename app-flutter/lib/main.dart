import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'app_theme.dart';
import 'services/supabase_client.dart';
import 'auth_screen.dart';
import 'auth_service.dart';
import 'demo_data.dart';
import 'favorites_screen.dart';
import 'firebase_options.dart';
import 'listing_screens.dart';
import 'map_screen.dart';
import 'messages_screens.dart';
import 'profile_screen.dart';
import 'publish_listing_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (error) {
    runApp(FirebaseSetupErrorApp(message: error.toString()));
    return;
  }
  // Supabase Storage pour les images des annonces.
  // La clé anon est publique. La service_role_key reste côté Edge Function.
  await SupabaseConfig.initialize();
  // Google Sign-In est optionnel : son échec ne bloque jamais le Marketplace.
  await initGoogleSignIn();
  // Injecte les annonces de démonstration si Firestore est vide.
  unawaited(DemoDataService.seedIfEmpty());
  runApp(const ImmoTNApp());
}

class ImmoTNApp extends StatelessWidget {
  const ImmoTNApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ImmoTN',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      // Le Marketplace est accessible sans compte.
      home: const MarketplaceShell(),
    );
  }
}

class FirebaseSetupErrorApp extends StatelessWidget {
  const FirebaseSetupErrorApp({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Configuration Firebase impossible : $message'),
          ),
        ),
      ),
    );
  }
}

/// Navigation principale : six sections (énoncé : Annonces, Carte, Favoris,
/// Publier, Messages, Profil). Les notifications sont dans l'en-tête.
class MarketplaceShell extends StatefulWidget {
  const MarketplaceShell({super.key});

  @override
  State<MarketplaceShell> createState() => _MarketplaceShellState();
}

class _MarketplaceShellState extends State<MarketplaceShell> {
  static const int _feed = 0;

  int _selectedIndex = _feed;

  void _goTo(int index) => setState(() => _selectedIndex = index);

  @override
  Widget build(BuildContext context) {
    final pages = [
      const ListingFeedScreen(),
      const MapScreen(),
      FavoritesScreen(onBrowse: () => _goTo(_feed)),
      // La publication exige un compte : invitation à se connecter sinon.
      AuthBuilder(
        builder: (user) => user == null
            ? const GuestScaffold(
                title: 'Publier une annonce',
                message: 'Connectez-vous pour publier une annonce.',
                reason: 'Connectez-vous pour publier une annonce.',
              )
            : CreateListingScreen(onPublished: () => _goTo(_feed)),
      ),
      const MessagesScreen(),
      const ProfileScreen(),
    ];
    return Scaffold(
      body: IndexedStack(index: _selectedIndex, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: _goTo,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Annonces',
          ),
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map_rounded),
            label: 'Carte',
          ),
          NavigationDestination(
            icon: Icon(Icons.favorite_outline),
            selectedIcon: Icon(Icons.favorite_rounded),
            label: 'Favoris',
          ),
          NavigationDestination(
            icon: Icon(Icons.add_circle_outline),
            selectedIcon: Icon(Icons.add_circle_rounded),
            label: 'Publier',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline),
            selectedIcon: Icon(Icons.chat_bubble_rounded),
            label: 'Messages',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}
