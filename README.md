# ImmoTN – Application mobile de services immobiliers

Projet ISET : application mobile de recherche, consultation et publication d'annonces immobilières, développée en **deux versions** (Flutter et React Native) avec un **backend Firebase commun**. Conception réalisée avec la méthode **C4**.

- Durée : 10 semaines
- Équipe : 3 à 4 étudiants
- Objectif : publication sur Google Play ou App Store

---

## 1. Structure du dépôt

Un seul dépôt Git (monorepo) pour garder la conception, le backend et les deux apps ensemble.

```
immotn/
├── docs/                  # Dossier de conception, diagrammes C4, maquettes (exports Figma)
├── backend/               # Règles Firestore/Storage, Cloud Functions
│   ├── firestore.rules
│   ├── storage.rules
│   └── functions/
├── app-flutter/           # Version Flutter
├── app-react-native/      # Version React Native
├── admin-web/             # (optionnel) panneau d'administration
└── README.md
```

---

## 2. Prérequis à installer (avant la semaine 1)

| Outil | Usage |
|---|---|
| Git + compte GitHub | Versionnage et travail en équipe |
| Android Studio (SDK + émulateur) | Compilation et tests Android |
| Flutter SDK | Version Flutter (`flutter doctor` doit être au vert) |
| Node.js LTS + npm | React Native et Firebase CLI |
| JDK 17 | Build Android |
| VS Code | Éditeur commun |
| Firebase CLI | `npm install -g firebase-tools` |
| Figma | Maquettes |
| Xcode (Mac uniquement) | Build iOS, si publication App Store |

Vérifier l'installation :

```bash
flutter doctor
node -v
firebase --version
```

---

## 3. Étapes de réalisation

### Étape 1 : Cadrage et organisation (semaine 1)

1. Créer le dépôt GitHub et inviter tous les membres.
2. Créer le tableau de suivi (GitHub Projects ou Trello) avec les colonnes : *À faire / En cours / Test / Terminé*.
3. Répartir les rôles : chef de projet et backend, dev Flutter, dev React Native, designer et testeur.
4. Définir les règles Git :
   - branche `main` protégée (jamais de push direct) ;
   - une branche par fonctionnalité : `feature/auth`, `feature/recherche`, etc. ;
   - une pull request relue par un autre membre avant fusion.
5. Fixer le nom de l'application et l'identifiant de package, par exemple `tn.iset.immotn`. Il doit être identique sur Android et iOS et ne pourra plus changer après publication.

### Étape 2 : Conception (semaine 2)

1. Compléter le dossier de conception (`docs/`).
2. Dessiner les diagrammes C4 : niveau 1 (contexte), niveau 2 (conteneurs), niveau 3 (composants). Outils possibles : draw.io, Structurizr, Mermaid.
3. Finaliser le modèle de données (utilisateurs, annonces, conversations, messages, favoris, signalements).
4. Créer les maquettes Figma des écrans principaux : connexion, accueil, recherche et filtres, carte, détail, publication, messagerie, favoris, profil.
5. Faire valider la conception par l'encadrant.

### Étape 3 : Mise en place du backend Firebase (semaine 3)

1. Créer un projet sur la [console Firebase](https://console.firebase.google.com).
2. Activer les services :
   - Authentication (email/mot de passe et Google) ;
   - Cloud Firestore ;
   - Storage ;
   - Cloud Messaging.
3. Se connecter et initialiser le dossier backend :

```bash
firebase login
cd backend
firebase init firestore storage functions
```

4. Écrire les règles de sécurité Firestore. Exemple de départ :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    match /listings/{listingId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.ownerId;
    }
    match /favorites/{id} {
      allow read, write: if request.auth.uid == resource.data.userId;
      allow create: if request.auth.uid == request.resource.data.userId;
    }
    match /conversations/{id} {
      allow read, write: if request.auth.uid in resource.data.participants;
      allow create: if request.auth != null;
    }
  }
}
```

5. Déployer les règles : `firebase deploy --only firestore:rules,storage`.
6. Saisir quelques annonces de test pour que les deux développeurs travaillent sur les mêmes données.

### Étape 4 : Initialisation des deux applications (semaine 3)

**Flutter**

```bash
flutter create --org tn.iset --project-name immotn app-flutter
cd app-flutter
dart pub global activate flutterfire_cli
flutterfire configure
flutter pub add firebase_core firebase_auth cloud_firestore firebase_storage firebase_messaging
flutter pub add go_router flutter_riverpod geolocator google_maps_flutter image_picker cached_network_image
flutter run
```

**React Native**

```bash
npx @react-native-community/cli init ImmoTN --directory app-react-native
cd app-react-native
npm install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore @react-native-firebase/storage @react-native-firebase/messaging
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context react-native-maps react-native-image-picker @react-native-community/geolocation zustand
npx react-native run-android
```

Ajouter le fichier `google-services.json` (Android) dans le dossier de chaque application, selon la documentation Firebase de chaque framework. Ne jamais publier de clés secrètes dans le dépôt.

Organisation interne conseillée pour les deux apps (même logique, mêmes noms) :

```
lib/ ou src/
├── core/        # thème, constantes, utilitaires
├── data/        # services Firebase, modèles
├── features/
│   ├── auth/
│   ├── listings/
│   ├── map/
│   ├── chat/
│   ├── favorites/
│   └── profile/
└── main
```

### Étape 5 : Authentification et profil (semaine 3-4)

1. Écrans d'inscription, de connexion et de réinitialisation du mot de passe.
2. Connexion Google.
3. Création du document `users/{uid}` à l'inscription.
4. Écran de profil (modification du nom, de la photo et du téléphone).
5. Gestion de session : redirection automatique selon l'état de connexion.

### Étape 6 : Consultation des annonces (semaine 4)

1. Écran d'accueil avec les annonces récentes (pagination).
2. Carte d'annonce (photo, prix, ville, surface).
3. Écran de détail avec galerie de photos, description, caractéristiques et bouton de contact.

### Étape 7 : Publication d'annonces (semaine 5)

1. Formulaire en 4 étapes : informations, photos, localisation, confirmation.
2. Sélection et compression des images avant envoi vers Storage.
3. Choix de la position sur la carte, enregistrement de la latitude, de la longitude et du geohash.
4. Modification, suppression et changement de statut (active, vendue, masquée).
5. Page « Mes annonces » dans le profil.

### Étape 8 : Recherche, filtres et carte (semaine 6)

1. Filtres : type de transaction, type de bien, prix min et max, ville, surface, pièces.
2. Vue liste et vue carte avec marqueurs.
3. Recherche « autour de moi » avec la permission de localisation (utiliser le geohash pour limiter les requêtes).
4. Sauvegarde des recherches (optionnel).

### Étape 9 : Messagerie et favoris (semaine 7)

1. Création d'une conversation depuis une annonce.
2. Chat en temps réel avec les écouteurs Firestore (`snapshots` en Flutter, `onSnapshot` en React Native).
3. Liste des conversations avec dernier message et indicateur de lecture.
4. Ajout et retrait des favoris, écran Favoris, cache local.

### Étape 10 : Notifications, hors-ligne, modération (semaine 8)

1. Enregistrer le jeton de l'appareil dans le profil utilisateur.
2. Créer une Cloud Function qui envoie une notification à chaque nouveau message.
3. Navigation vers la bonne conversation au clic sur la notification.
4. Cache hors-ligne des favoris et des dernières annonces.
5. Bouton de signalement d'une annonce et écran simple de modération.
6. Option de suppression du compte (obligatoire pour les stores).

### Étape 11 : Tests et finitions (semaine 9)

1. Tests unitaires de la logique métier (validation de formulaires, formatage des prix).
2. Tests de parcours complets : inscription, publication, recherche, message.
3. Tests sur appareils réels Android (et iOS si possible).
4. Corrections de bugs, optimisation des images et des requêtes.
5. Traduction français / arabe (RTL) si prévu.
6. Icône, écran de démarrage, nom d'affichage.

Commandes de test :

```bash
# Flutter
flutter analyze
flutter test

# React Native
npm run lint
npm test
```

### Étape 12 : Publication (semaine 9-10)

**Google Play**

1. Créer un compte développeur Google Play (frais uniques, à vérifier sur le site officiel).
2. Créer la clé de signature :

```bash
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Conserver ce fichier et ses mots de passe en lieu sûr, hors du dépôt Git.

3. Générer le bundle de production :

```bash
# Flutter
flutter build appbundle --release

# React Native
cd android && ./gradlew bundleRelease
```

4. Dans la Google Play Console : créer l'application, ajouter icône, captures d'écran, description, politique de confidentialité (URL publique) et formulaire de sécurité des données.
5. Envoyer le fichier AAB en test interne, puis en test fermé, puis demander la mise en production. Consulter les exigences de test actuelles de Google pour les nouveaux comptes personnels.

**App Store (si Mac disponible)**

1. Compte Apple Developer (abonnement annuel).
2. Configurer les certificats et profils dans Xcode.
3. Envoyer la build via TestFlight, puis soumettre à la revue.

> Conseil : soumettre une première version dès la semaine 8 ou 9. Les délais de validation des stores peuvent prendre plusieurs jours.

### Étape 13 : Documentation et soutenance (semaine 10)

1. Finaliser le dossier de conception et le rapport.
2. Compléter ce README avec les instructions d'installation et de lancement.
3. Préparer la présentation : problématique, architecture C4, démonstration des deux versions, comparaison Flutter / React Native, lien du store.
4. Préparer une démonstration de secours (vidéo ou APK) en cas de problème de connexion.

---

## 4. Planning récapitulatif

| Semaine | Objectif | Livrable |
|---|---|---|
| 1 | Cadrage, rôles, Git | Dépôt et tableau de suivi |
| 2 | Conception C4, maquettes | Diagrammes et Figma |
| 3 | Backend, init des deux apps, authentification | Connexion fonctionnelle |
| 4 | Profil, liste et détail des annonces | Consultation |
| 5 | Publication d'annonces | Formulaire complet |
| 6 | Filtres, carte, géolocalisation | Recherche |
| 7 | Messagerie, favoris | Chat et favoris |
| 8 | Notifications, hors-ligne, modération | Version bêta |
| 9 | Tests, corrections, build de production | Version candidate |
| 10 | Publication, documentation, soutenance | Application publiée |

---

## 5. Bonnes pratiques d'équipe

- Réunion de 15 minutes chaque semaine : fait, à faire, blocages.
- Commits courts et clairs : `feat: ajout du filtre par prix`, `fix: crash à l'envoi de photo`.
- Ne jamais committer : `google-services.json` de production, clés d'API, fichiers `.jks`, mots de passe. Ajouter ces éléments au `.gitignore`.
- Développer chaque fonctionnalité dans une version, puis la porter dans l'autre en réutilisant la même conception et les mêmes noms de modules.
- Livrer tôt une version minimale (authentification, liste, détail, publication), puis enrichir.
- Tester sur de vrais téléphones, pas seulement sur émulateur.

---

## 6. Lancer le projet

```bash
git clone https://github.com/aliabidi131/immotn.git
cd immotn
```

### Firebase

Le projet utilise Firebase `immotn-444d2`. Dans la console, activer
Authentication (e-mail/mot de passe), Cloud Firestore et Storage. Vérifier les
règles avant tout déploiement :

```powershell
firebase login
firebase use immotn-444d2
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Le fichier `google-services.json` de React Native est local et ignoré par Git.
Chaque variante mobile doit être enregistrée comme application distincte dans
Firebase. Ne publiez pas de fichiers de configuration locaux par inadvertance.

### React Native (Android)

Placez le fichier Android Firebase dans `app-react-native/android/app/`, puis :

```powershell
Set-Location app-react-native
npm ci
npm test -- --runInBand
npm run lint
npm run android
```

### Flutter

Suivez les étapes de [app-flutter/README.md](./app-flutter/README.md) pour
générer les plateformes natives et enregistrer l’application Flutter auprès de
Firebase, puis lancez `flutter pub get` et `flutter run`.

### Périmètre du MVP actuel

Les deux applications contiennent l’authentification e-mail/mot de passe, la
recherche textuelle d’annonces, le filtre vente/location, le détail et la
publication. Les photos, la carte, les favoris, la messagerie, les notifications,
la modération et les fonctions hors ligne restent à développer.
```

## 7. Équipe

| Nom | Rôle |
|---|---|
| … | Chef de projet et backend |
| … | Développeur Flutter |
| … | Développeur React Native |
| … | Designer UI/UX et testeur |

Encadrant : …
