import 'package:flutter/material.dart';

/// Palette ImmoTN — bleu professionnel, accents dorés, fonds chaleureux.
class AppColors {
  const AppColors._();

  // Primaire
  static const Color primary = Color(0xFF1565C0);
  static const Color primaryLight = Color(0xFF42A5F5);
  static const Color primaryTint = Color(0xFFE3EEFB);
  static const Color primaryDark = Color(0xFF0D47A1);

  // Accent
  static const Color accent = Color(0xFFF57C00); // Orange ambré
  static const Color accentLight = Color(0xFFFFCC80);

  // Fonds
  static const Color background = Color(0xFFF4F6FB);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFF0F4FF);

  // Texte
  static const Color ink = Color(0xFF1A2742);
  static const Color inkLight = Color(0xFF3D4F6B);
  static const Color muted = Color(0xFF8898B0);

  // Statuts
  static const Color success = Color(0xFF2E7D32);
  static const Color successLight = Color(0xFFE8F5E9);
  static const Color warning = Color(0xFFF57C00);
  static const Color warningLight = Color(0xFFFFF3E0);
  static const Color error = Color(0xFFC62828);
  static const Color errorLight = Color(0xFFFFEBEE);

  // Carte / divider
  static const Color cardBorder = Color(0xFFE8EEF6);
  static const Color divider = Color(0xFFECF0F7);
}

ThemeData buildAppTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.primary,
    brightness: Brightness.light,
    surface: AppColors.surface,
    error: AppColors.error,
  ).copyWith(
    secondary: AppColors.accent,
    tertiary: AppColors.primaryDark,
    surfaceContainerHighest: AppColors.surfaceVariant,
    onSurfaceVariant: AppColors.muted,
  );

  const fieldRadius = BorderRadius.all(Radius.circular(14));
  const cardRadius = BorderRadius.all(Radius.circular(20));
  const buttonRadius = BorderRadius.all(Radius.circular(14));

  final fieldBorder = OutlineInputBorder(
    borderRadius: fieldRadius,
    borderSide: const BorderSide(color: AppColors.cardBorder, width: 1),
  );

  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    scaffoldBackgroundColor: AppColors.background,

    // ── App bar ─────────────────────────────────────────────
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shadowColor: Colors.transparent,
      foregroundColor: AppColors.ink,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: AppColors.ink,
        fontSize: 20,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.3,
      ),
    ),

    // ── Cards ────────────────────────────────────────────────
    cardTheme: CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: cardRadius,
        side: const BorderSide(color: AppColors.cardBorder, width: 1),
      ),
    ),

    // ── Inputs ───────────────────────────────────────────────
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: fieldBorder,
      enabledBorder: fieldBorder,
      focusedBorder: OutlineInputBorder(
        borderRadius: fieldRadius,
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: fieldRadius,
        borderSide: const BorderSide(color: AppColors.error, width: 1),
      ),
      hintStyle: const TextStyle(color: AppColors.muted, fontSize: 14),
      labelStyle: const TextStyle(color: AppColors.inkLight),
    ),

    // ── Boutons ──────────────────────────────────────────────
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 50),
        shape: const RoundedRectangleBorder(borderRadius: buttonRadius),
        textStyle:
            const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        elevation: 0,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 48),
        shape: const RoundedRectangleBorder(borderRadius: buttonRadius),
        side: const BorderSide(color: AppColors.primary, width: 1.5),
        foregroundColor: AppColors.primary,
        textStyle:
            const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.primary,
        textStyle:
            const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: const Size(0, 48),
        shape: const RoundedRectangleBorder(borderRadius: buttonRadius),
        elevation: 2,
        shadowColor: AppColors.primary.withAlpha(60),
        textStyle:
            const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
      ),
    ),

    // ── Bottom nav ───────────────────────────────────────────
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      indicatorColor: AppColors.primaryTint,
      height: 64,
      elevation: 8,
      shadowColor: Colors.black12,
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected)
              ? AppColors.primary
              : AppColors.muted,
          size: 24,
        ),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 11,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
          color: states.contains(WidgetState.selected)
              ? AppColors.primary
              : AppColors.muted,
        ),
      ),
    ),

    // ── Chips ────────────────────────────────────────────────
    chipTheme: ChipThemeData(
      backgroundColor: AppColors.surfaceVariant,
      selectedColor: AppColors.primaryTint,
      labelStyle: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: AppColors.ink,
      ),
      shape: const StadiumBorder(
        side: BorderSide(color: AppColors.cardBorder),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    ),

    // ── Divider ──────────────────────────────────────────────
    dividerTheme: const DividerThemeData(
      color: AppColors.divider,
      thickness: 1,
      space: 0,
    ),

    // ── Typography ───────────────────────────────────────────
    textTheme: const TextTheme(
      displayLarge: TextStyle(
        fontWeight: FontWeight.w900,
        color: AppColors.ink,
        letterSpacing: -1,
      ),
      headlineLarge: TextStyle(
        fontWeight: FontWeight.w800,
        color: AppColors.ink,
        letterSpacing: -0.5,
      ),
      headlineMedium: TextStyle(
        fontWeight: FontWeight.w700,
        color: AppColors.ink,
        letterSpacing: -0.3,
      ),
      titleLarge: TextStyle(
        fontWeight: FontWeight.w700,
        color: AppColors.ink,
        letterSpacing: -0.2,
      ),
      titleMedium: TextStyle(
        fontWeight: FontWeight.w600,
        color: AppColors.ink,
      ),
      titleSmall: TextStyle(
        fontWeight: FontWeight.w600,
        color: AppColors.inkLight,
        fontSize: 13,
      ),
      bodyLarge: TextStyle(color: AppColors.ink, height: 1.5),
      bodyMedium: TextStyle(color: AppColors.inkLight, height: 1.4),
      bodySmall: TextStyle(color: AppColors.muted, height: 1.4),
      labelLarge: TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink),
      labelMedium: TextStyle(
        fontWeight: FontWeight.w500,
        color: AppColors.inkLight,
      ),
      labelSmall: TextStyle(color: AppColors.muted, fontSize: 11),
    ),
  );
}

// ── Helpers de style réutilisables ─────────────────────────────────────────

/// Badge coloré pour le type de transaction (Vente / Location).
class TransactionBadge extends StatelessWidget {
  const TransactionBadge({required this.label, super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    final isLocation = label.toLowerCase() == 'location';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isLocation ? AppColors.warningLight : AppColors.primaryTint,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isLocation ? AppColors.warning : AppColors.primary,
          width: 1,
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: isLocation ? AppColors.warning : AppColors.primary,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

/// Badge type de bien (Appartement, Villa, etc.).
class TypeBienBadge extends StatelessWidget {
  const TypeBienBadge({required this.label, super.key});

  final String label;

  static const Map<String, IconData> _icons = {
    'appartement': Icons.apartment_rounded,
    'maison': Icons.house_rounded,
    'villa': Icons.villa_rounded,
    'terrain': Icons.landscape_rounded,
    'local': Icons.store_rounded,
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.black54,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
