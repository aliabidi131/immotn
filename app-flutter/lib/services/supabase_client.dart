import 'package:supabase_flutter/supabase_flutter.dart';

/// Initialise le client Supabase pour l'application.
/// L'URL et la clé anon sont publiques et peuvent être embarquées dans le build.
/// La service_role_key NE DOIT JAMAIS se trouver ici (elle reste côté serveur dans l'Edge Function).
class SupabaseConfig {
  static const String url = 'https://sjtsymnbacouhpwyhcre.supabase.co';
  static const String anonKey =
      'sb_publishable_K3-81Z1PuCCVFakoJ7guKg_HgWB5Bdq';

  static Future<void> initialize() async {
    await Supabase.initialize(
      url: url,
      anonKey: anonKey,
      // debug: true, // activer temporairement pour le débogage
    );
  }

  static SupabaseClient get client => Supabase.instance.client;
}