# C4 – Niveau 2 : diagramme de conteneurs

Backend retenu : **Firebase**, commun aux deux applications (choix recommandé par le PDF, repris par le `README.md`).

```mermaid
C4Container
    title ImmoTN – Diagramme de conteneurs

    Person(utilisateur, "Utilisateur / Annonceur", "Recherche, publie, échange")
    Person(admin, "Administrateur", "Modère le contenu")

    System_Boundary(immotn, "ImmoTN") {
        Container(flutter, "Application mobile Flutter", "Flutter / Dart", "Interface utilisateur, logique de présentation, cache local")
        Container(rn, "Application mobile React Native", "React Native / TypeScript", "Mêmes fonctionnalités que la version Flutter")
        Container(adminweb, "Panneau d'administration", "Application web (React ou Flutter Web)", "Modération, statistiques")
        Container(backend, "Backend", "Firebase (Auth, Cloud Functions)", "Authentification, règles métier, validation, déclenchement des notifications")
        ContainerDb(db, "Base de données", "Cloud Firestore", "Utilisateurs, annonces, conversations, favoris")
        ContainerDb(files, "Stockage de fichiers", "Firebase Storage", "Photos des annonces et des profils")
        ContainerDb(local, "Base locale mobile", "À préciser", "Cache hors-ligne, favoris, brouillons")
    }

    System_Ext(maps, "Service de cartographie", "Cartes, géocodage")
    System_Ext(notif, "Service de notifications", "FCM / APNs")
    System_Ext(idp, "Fournisseur d'identité", "Google Sign-In")
    System_Ext(email, "Services email", "Vérification, réinitialisation")

    Rel(utilisateur, flutter, "Utilise")
    Rel(utilisateur, rn, "Utilise")
    Rel(admin, adminweb, "Utilise")

    Rel(flutter, backend, "HTTPS")
    Rel(rn, backend, "HTTPS")
    Rel(adminweb, backend, "HTTPS")

    Rel(backend, db, "Accès par le backend et les SDK sécurisés")
    Rel(backend, files, "URLs signées")
    Rel(flutter, local, "Interne à l'application")
    Rel(rn, local, "Interne à l'application")

    Rel(flutter, maps, "Cartes")
    Rel(rn, maps, "Cartes")
    Rel(flutter, idp, "Connexion Google")
    Rel(rn, idp, "Connexion Google")
    Rel(backend, notif, "Envoi de notifications push")
    Rel(backend, email, "Emails transactionnels")
```

## Conteneurs (source : dossier de conception, § 4.2)

| Conteneur | Technologie | Responsabilité | Communication |
|---|---|---|---|
| Application mobile Flutter | Flutter / Dart | Interface utilisateur, logique de présentation, cache local | HTTPS vers le backend |
| Application mobile React Native | React Native / TypeScript | Mêmes fonctionnalités que la version Flutter | HTTPS vers le backend |
| Backend (API) | Firebase (Auth, Cloud Functions) | Authentification, règles métier, validation, déclenchement des notifications | HTTPS/REST ou SDK |
| Base de données | Cloud Firestore | Utilisateurs, annonces, conversations, favoris | Accès par le backend et les SDK sécurisés |
| Stockage de fichiers | Firebase Storage | Photos des annonces et des profils | URLs signées |
| Panneau d'administration | Application web (React ou Flutter Web) | Modération, statistiques | HTTPS vers le backend |
| Base locale mobile | SQLite / Hive / AsyncStorage (non tranché) | Cache hors-ligne, favoris, brouillons | Interne à l'application |

Le panneau d'administration est marqué « optionnel » dans le `README.md` (`admin-web/`) alors que le PDF le liste comme conteneur : voir « Points ouverts ».
