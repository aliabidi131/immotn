# C4 – Niveau 1 : diagramme de contexte

Système central : **ImmoTN** (nom provisoire), application permettant de rechercher, publier et discuter autour d'annonces immobilières.

```mermaid
C4Context
    title ImmoTN – Diagramme de contexte du système

    Person(visiteur, "Visiteur", "Parcourt les annonces sans compte")
    Person(utilisateur, "Utilisateur / Annonceur", "Recherche, publie, échange")
    Person(admin, "Administrateur", "Modère le contenu")

    System(immotn, "ImmoTN", "Rechercher, publier et discuter autour d'annonces immobilières")

    System_Ext(maps, "Service de cartographie", "Affichage des cartes, géocodage des adresses")
    System_Ext(notif, "Service de notifications", "Firebase Cloud Messaging / APNs : envoi de notifications push")
    System_Ext(idp, "Fournisseur d'identité", "Google Sign-In : connexion tierce")
    System_Ext(email, "Services email", "Vérification d'email, réinitialisation")

    Rel(visiteur, immotn, "Consulte les annonces")
    Rel(utilisateur, immotn, "Utilise l'application mobile")
    Rel(admin, immotn, "Utilise le panneau d'administration")

    Rel(immotn, maps, "Obtient les cartes et coordonnées")
    Rel(immotn, notif, "Demande l'envoi de notifications")
    Rel(notif, utilisateur, "Délivre les notifications aux appareils")
    Rel(immotn, idp, "Authentifie l'utilisateur via")
    Rel(immotn, email, "Envoie les emails transactionnels via")
```

## Éléments (source : dossier de conception, § 4.1)

| Élément | Type | Description | Relation avec le système |
|---|---|---|---|
| Visiteur | Personne | Parcourt les annonces sans compte | Consulte les annonces |
| Utilisateur / Annonceur | Personne | Recherche, publie, échange | Utilise l'application mobile |
| Administrateur | Personne | Modère le contenu | Utilise le panneau d'administration |
| Service de cartographie | Système externe | Affichage des cartes, géocodage des adresses | Fournit les cartes et coordonnées |
| Service de notifications (FCM / APNs) | Système externe | Envoi de notifications push | Délivre les notifications aux appareils |
| Fournisseur d'identité (Google Sign-In) | Système externe | Connexion tierce | Authentifie l'utilisateur |
| Services email | Système externe | Vérification d'email, réinitialisation | Envoie les emails transactionnels |

Le choix du service de cartographie (Google Maps ou OpenStreetMap dans le PDF) n'est pas fixé ici : le `README.md` installe `google_maps_flutter` (Flutter) et `react-native-maps` (React Native).
