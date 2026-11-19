# ImmoTN Flutter

Cette application contient le MVP Flutter : inscription/connexion Firebase,
recherche textuelle et filtre vente/location, détail et publication d’annonces.

## Préparation

1. Installer Flutter et vérifier `flutter doctor`.
2. Depuis ce dossier, générer les plateformes natives :

   ```powershell
   flutter create --platforms=android,ios --org tn.iset --project-name immotn .
   ```

3. Configurer une application Flutter distincte dans le projet Firebase
   `immotn-444d2` :

   ```powershell
   dart pub global activate flutterfire_cli
   flutterfire configure --project=immotn-444d2
   ```

   Cette configuration est distincte de l’application React Native (`com.immotn`).
   Ne réutilisez pas son `google-services.json` si l’identifiant Android généré
   pour Flutter est différent.

4. Installer les paquets et lancer l’application :

   ```powershell
   flutter pub get
   flutter run
   ```

## Tests

```powershell
flutter analyze
flutter test
```

Le dépôt doit contenir ou générer les configurations Firebase natives avant
l’exécution. Le MVP ne comprend pas encore photos, carte, favoris ou messagerie.
