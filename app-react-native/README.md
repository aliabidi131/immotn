# ImmoTN — React Native

MVP mobile connecté à Firebase : inscription/connexion/réinitialisation par
e-mail, profil, consultation et recherche textuelle d’annonces, filtre
vente/location, détail et publication.

## Configuration locale

1. Installer Node.js 22.11 ou supérieur, Android Studio et le SDK Android.
2. Dans Firebase Console, enregistrer une application Android avec
   l’identifiant `com.immotn`.
3. Télécharger le fichier Firebase Android et le placer à
   `android/app/google-services.json`. Ce fichier est ignoré par Git.
4. Activer le fournisseur **E-mail/Mot de passe** dans Authentication.
5. Vérifier que les règles Firestore et Storage de la racine du dépôt sont
   publiées avant d’utiliser l’application. Le bucket Storage n’est requis que
   pour l’envoi des photos, fonctionnalité à venir.

## Installation et lancement (PowerShell)

Depuis la racine du dépôt :

```powershell
Set-Location app-react-native
npm ci
npm run android
```

## Vérifications

```powershell
npm test -- --runInBand
npm run lint
npx tsc --noEmit
```

Le MVP ne comprend pas encore les photos d’annonces, la carte, les favoris,
la messagerie, les notifications, la modération ou la consultation hors ligne.
