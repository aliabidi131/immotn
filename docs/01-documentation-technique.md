# Documentation technique – ImmoTN

Sources : `Enoncé_projet.txt`, dossier de conception (PDF), `README.md`. Les diagrammes C4 sont dans les fichiers `02` à `05`.

## 1. Objectif

Application mobile cross-platform de recherche, consultation et publication d'annonces immobilières (vente et location), avec inscription, détails et photos, messagerie intégrée, géolocalisation, base de données et notifications. Elle est développée en **deux versions distinctes** (Flutter et React Native) partageant la même conception et le même backend **Firebase**. Conception selon la méthode **C4**. Objectif ambitieux : publication sur Google Play ou App Store. Durée : 10 semaines, équipe de 3 à 4 étudiants.

## 2. Acteurs

| Acteur | Description |
|---|---|
| Visiteur | Non connecté : peut parcourir les annonces |
| Utilisateur inscrit | Recherche, met en favoris, contacte, publie |
| Annonceur (propriétaire / agence) | Utilisateur inscrit qui publie et gère ses annonces |
| Administrateur | Modère les annonces et les utilisateurs signalés |
| Services externes | Cartographie, notifications push, stockage d'images |

## 3. Exigences fonctionnelles

| Réf. | Exigence | Priorité |
|---|---|---|
| F1 | Inscription, connexion, déconnexion, réinitialisation du mot de passe (email, Google) | Haute |
| F2 | Gestion du profil (nom, photo, téléphone, type de compte) | Haute |
| F3 | Recherche avec filtres : prix, localisation, type de bien, surface, nombre de pièces, vente/location | Haute |
| F4 | Détail d'une annonce avec galerie de photos | Haute |
| F5 | Publication, modification, suppression d'une annonce avec photos | Haute |
| F6 | Localisation des biens sur carte et recherche « autour de moi » | Haute |
| F7 | Messagerie intégrée entre utilisateurs (par annonce) | Haute |
| F8 | Gestion des favoris | Moyenne |
| F9 | Notifications push (nouveau message, nouvelle annonce correspondant à une recherche sauvegardée) | Moyenne |
| F10 | Sauvegarde de recherches et alertes | Moyenne |
| F11 | Signalement d'annonces, modération par l'administrateur | Moyenne |
| F12 | Partage d'une annonce, appel direct de l'annonceur | Basse |
| F13 | Support du français et de l'arabe (RTL), option anglais | Basse |

## 4. Exigences non fonctionnelles

| Catégorie | Exigence |
|---|---|
| Performance | Liste d'annonces affichée en moins de 2 s sur 4G ; pagination ; images compressées et mises en cache |
| Sécurité | Authentification forte, règles d'accès par utilisateur, HTTPS uniquement, validation des entrées |
| Disponibilité | Backend managé, disponibilité supérieure à 99 % |
| Utilisabilité | Parcours de recherche en 3 écrans maximum ; guidelines Material Design et Human Interface |
| Compatibilité | Android 8+ et iOS 14+ |
| Confidentialité | Consentement explicite, politique de confidentialité, suppression de compte (exigée par les stores) |
| Maintenabilité | Architecture en couches, code documenté, tests automatisés |
| Hors-ligne | Consultation des favoris et des dernières annonces sans connexion |

## 5. Cas d'utilisation principaux

| Cas | Acteur | Scénario nominal |
|---|---|---|
| S'inscrire | Visiteur | Saisit email et mot de passe, valide, le compte est créé et le profil initialisé |
| Rechercher un bien | Visiteur / Utilisateur | Choisit des filtres, consulte la liste ou la carte, ouvre une annonce |
| Publier une annonce | Annonceur | Remplit le formulaire, ajoute des photos, place le bien sur la carte, publie |
| Contacter un annonceur | Utilisateur | Ouvre la conversation depuis l'annonce, envoie un message, l'annonceur reçoit une notification |
| Gérer les favoris | Utilisateur | Ajoute ou retire une annonce, consulte la liste dans l'onglet Favoris |
| Modérer | Administrateur | Consulte les signalements, masque ou supprime une annonce |

## 6. Choix technologiques

Outils communs : Git et GitHub (branches par fonctionnalité, pull requests), Figma (maquettes), Firebase Console, Postman, GitHub Actions (intégration continue : analyse statique et tests à chaque pull request).

Identifiant de package : `tn.iset.immotn` (identique sur Android et iOS, non modifiable après publication).

| Domaine | Flutter | React Native |
|---|---|---|
| Langage | Dart | TypeScript |
| Navigation | go_router | React Navigation (`@react-navigation/native`, `native-stack`, `bottom-tabs`, `react-native-screens`, `react-native-safe-area-context`) |
| État | flutter_riverpod | zustand |
| Carte | google_maps_flutter | react-native-maps |
| Géolocalisation | geolocator | @react-native-community/geolocation |
| Backend (SDK) | firebase_core, firebase_auth, cloud_firestore, firebase_storage | @react-native-firebase/app, auth, firestore, storage |
| Notifications | firebase_messaging | @react-native-firebase/messaging |
| Images | image_picker, cached_network_image | react-native-image-picker |
| Tests | flutter_test, integration_test | Jest, React Native Testing Library, Detox |

Le tableau reprend les paquets installés par les commandes du `README.md`. Pour les tests, il reprend le PDF, le `README.md` ne citant que `flutter test` et `npm test`.

## 7. Structure du dépôt (monorepo)

```
immotn/
├── docs/                  # Dossier de conception, diagrammes C4, maquettes (exports Figma)
├── backend/               # Règles Firestore/Storage, Cloud Functions
│   ├── firestore.rules
│   ├── storage.rules
│   └── functions/
├── app-flutter/
├── app-react-native/
├── admin-web/             # (optionnel) panneau d'administration
└── README.md
```

Organisation interne conseillée pour les deux apps (`lib/` ou `src/`) : `core/` (thème, constantes, utilitaires), `data/` (services Firebase, modèles), `features/` (`auth`, `listings`, `map`, `chat`, `favorites`, `profile`), `main`.

## 8. Backend Firebase

Services prévus : Authentication (email/mot de passe et Google), Cloud Firestore, Storage et Cloud Messaging. Les règles locales Firestore et Storage sont dans `backend/firestore.rules` et `backend/storage.rules`, référencées par `firebase.json`. Elles doivent être vérifiées avec la configuration de la console avant déploiement. Le fichier `backend/functions/index.js` est encore un squelette : l'envoi d'une notification à chaque nouveau message reste à implémenter.

## 9. Sécurité et conformité

- Authentification par jeton ; mots de passe jamais stockés en clair.
- Seul le propriétaire modifie ou supprime son annonce ; seuls les participants lisent une conversation.
- Validation des données côté client et côté serveur ; limitation du nombre de requêtes.
- HTTPS uniquement ; clés d'API restreintes par application.
- Compression et vérification des images téléversées.
- Politique de confidentialité, conditions d'utilisation, suppression du compte et des données (obligatoire pour les stores).
- Numéros de téléphone affichés uniquement aux utilisateurs connectés.
- Ne jamais committer : `google-services.json` de production, clés d'API, fichiers `.jks`, mots de passe (voir `.gitignore`).

## 10. Interface utilisateur

Navigation : **Accueil** (barre de recherche, annonces récentes, catégories) ; **Recherche** (liste et carte, filtres) ; **Publier** (formulaire d'annonce) ; **Messages** (conversations) ; **Profil** (mes annonces, favoris, paramètres).

Écrans à maquetter sur Figma avant le développement (semaine 2) : 1. démarrage et onboarding ; 2. connexion et inscription ; 3. accueil ; 4. résultats de recherche (liste et carte) et panneau de filtres ; 5. détail d'une annonce ; 6. publication en 4 étapes (informations, photos, localisation, confirmation) ; 7. liste des conversations et chat ; 8. favoris ; 9. profil et paramètres.

## 11. Opérations de l'API

Le PDF les décrit en REST « si un backend REST est utilisé (équivalents en SDK avec Firebase) ». Avec Firebase, ce sont les opérations logiques à couvrir par les SDK.

| Méthode | Route | Description |
|---|---|---|
| POST | /auth/register | Créer un compte |
| POST | /auth/login | Se connecter |
| GET | /users/me | Récupérer son profil |
| PUT | /users/me | Modifier son profil |
| GET | /listings | Rechercher avec filtres et pagination |
| GET | /listings/:id | Détail d'une annonce |
| POST | /listings | Publier une annonce |
| PUT | /listings/:id | Modifier une annonce |
| DELETE | /listings/:id | Supprimer une annonce |
| GET | /listings/nearby?lat=&lng=&radius= | Recherche autour d'une position |
| POST | /favorites/:listingId | Ajouter aux favoris |
| DELETE | /favorites/:listingId | Retirer des favoris |
| GET | /conversations | Lister ses conversations |
| POST | /conversations/:id/messages | Envoyer un message |
| POST | /reports | Signaler une annonce |

## 12. Tests et qualité

| Type | Outil | Objectif |
|---|---|---|
| Unitaires | flutter_test / Jest | Logique métier, validations, formatage |
| Widgets / composants | flutter_test / Testing Library | Écrans et formulaires |
| Intégration | integration_test / Detox | Parcours complets (inscription, publication, message) |
| Manuels | Appareils réels Android et iOS | Ergonomie, géolocalisation, notifications |
| Charge légers | Outils Firebase | Vérification des quotas |

Couverture visée : au moins 60 % de la logique métier. Commandes : `flutter analyze`, `flutter test` ; `npm run lint`, `npm test`.

## 13. Planning (10 semaines)

| Sem. | Objectifs | Livrables |
|---|---|---|
| 1 | Cadrage, rôles, configuration Git | Dépôt et tableau de suivi |
| 2 | Conception C4, modèle de données, maquettes Figma | Diagrammes C4, maquettes |
| 3 | Backend, authentification, structure des deux projets | Projets initialisés, connexion fonctionnelle |
| 4 | Profil, liste et détail des annonces | Consultation |
| 5 | Publication d'annonces avec photos | Formulaire complet |
| 6 | Filtres, carte, géolocalisation | Recherche et carte |
| 7 | Messagerie temps réel et favoris | Chat et favoris |
| 8 | Notifications, hors-ligne, modération | Version bêta |
| 9 | Tests, corrections, optimisation, traduction | Version candidate |
| 10 | Publication, documentation, soutenance | Application publiée, rapport final |

Méthode : Scrum simplifié, sprints de deux semaines, réunion hebdomadaire, tableau Kanban (GitHub Projects ou Trello). Chaque fonctionnalité est développée d'abord dans une version puis portée dans l'autre.

## 14. Risques

| Risque | Mesure |
|---|---|
| Retard dû au développement en double | Conception commune, backend partagé, priorisation |
| Dépassement des quotas gratuits Firebase | Pagination, cache, compression des images |
| Refus de publication par le store | Respecter les règles dès le début, soumettre tôt |
| Difficultés de requêtes géographiques | Geohash, rayons de recherche limités |
| Contenu inapproprié ou fausses annonces | Signalement, modération, vérification du compte |
| Désaccords dans l'équipe | Réunions hebdomadaires, rôles clairs, suivi sur Git |

## 15. Points ouverts (non tranchés par les 3 sources)

1. `backend/storage.rules` contient des règles de départ pour les photos de profil et d'annonces ; vérifier que Storage est activé dans la console et tester ces règles avant déploiement.
2. Base locale mobile : SQLite, Hive ou AsyncStorage (PDF) ; le `README.md` ne choisit pas.
3. Les règles Firestore locales couvrent les profils et les annonces du MVP. Les collections favoris, conversations, messages, recherches sauvegardées et signalements ne sont pas encore implémentées et sont refusées par défaut.
4. Panneau d'administration : « optionnel » (`README.md`), alors que le PDF le prévoit en semaine 8 (modération).
5. Notification « nouvelle annonce correspondant à une recherche sauvegardée » (F9) : le `README.md` (étape 10) ne décrit que la notification de nouveau message ; la sauvegarde de recherches y est « optionnelle ».
6. Bibliothèque de cache d'images React Native : le PDF cite `react-native-fast-image`, le `README.md` ne l'installe pas.
7. Structure du champ `filtres` de `RechercheSauvegardée` et valeurs de `statut` d'un `Signalement` : non précisées.
