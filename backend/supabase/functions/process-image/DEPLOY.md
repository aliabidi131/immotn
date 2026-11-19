# Edge Function `process-image` — Guide de déploiement

## Localisation du code

```
backend/functions/process-image/index.ts
```

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Supabase CLI | 1.200+ |
| Deno | bundlé avec Supabase CLI |

Installer la CLI si ce n'est pas fait :

```bash
# macOS / Linux
brew install supabase/tap/supabase

# Windows (PowerShell)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

---

## 1. Lier le projet Supabase

```bash
cd backend
supabase login
supabase link --project-ref sjtsymnbacouhpwyhcre
```

---

## 2. Variables secrètes à configurer

Ces valeurs ne doivent **jamais** être commises dans le dépôt Git.

```bash
# URL du projet Supabase (la même que dans Flutter, non secrète)
supabase secrets set SUPABASE_URL=https://sjtsymnbacouhpwyhcre.supabase.co

# Service role key (SECRÈTE — ne jamais mettre dans Flutter)
# Récupérer dans : Supabase Dashboard > Settings > API > service_role key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<votre_service_role_key>

# ID du projet Firebase
# Récupérer dans : Firebase Console > Paramètres du projet > ID du projet
supabase secrets set FIREBASE_PROJECT_ID=<votre_firebase_project_id>
```

Vérification :

```bash
supabase secrets list
```

---

## 3. Déployer la fonction

```bash
supabase functions deploy process-image \
  --project-ref sjtsymnbacouhpwyhcre \
  --no-verify-jwt
```

> `--no-verify-jwt` : la vérification JWT Supabase est désactivée car la
> fonction vérifie elle-même le **Firebase** ID Token. Ne pas activer la
> vérification JWT Supabase ici.

---

## 4. Tester le déploiement (curl)

Remplacer `<FIREBASE_ID_TOKEN>` et `<LISTING_ID>` par des valeurs réelles.

```bash
curl -X POST \
  https://sjtsymnbacouhpwyhcre.supabase.co/functions/v1/process-image \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "listingId": "<LISTING_ID>",
    "fileBase64": "/9j/4AAQ...",
    "fileName": "test.jpg",
    "contentType": "image/jpeg"
  }'
```

Réponse attendue (HTTP 200) :

```json
{
  "url": "https://sjtsymnbacouhpwyhcre.supabase.co/storage/v1/object/public/property-images/uuid-test.jpg",
  "path": "uuid-test.jpg",
  "listingId": "<LISTING_ID>",
  "ownerId": "<UID_FIREBASE>"
}
```

---

## 5. Politique du bucket `property-images`

Le bucket est **Public** (lecture publique sans authentification).

Politiques RLS **à appliquer dans Supabase Dashboard > Storage > Policies** :

| Opération | Policy |
|-----------|--------|
| SELECT | Autorisé pour tous (`true`) — lecture publique |
| INSERT | **Bloqué** pour les rôles `anon` et `authenticated` via la clé anon — uniquement via `service_role` (Edge Function) |
| DELETE | **Bloqué** pour les rôles `anon` et `authenticated` — uniquement via `service_role` (Edge Function) |

> **Important** : ne jamais créer une policy `INSERT` ou `DELETE` avec
> `true` pour `anon`. Toujours passer par l'Edge Function.

---

## 6. Vérification des logs

```bash
supabase functions logs process-image --project-ref sjtsymnbacouhpwyhcre
```

---

## 7. État de l'intégration

| Composant | État |
|-----------|------|
| `supabase_client.dart` | ✅ Initialisé dans `main.dart` |
| `image_service.dart` | ✅ Créé |
| `listing_repository.dart` | ✅ Mis à jour (Supabase upload + suppression) |
| `publish_listing_screen.dart` | ✅ Gestion `ImageServiceException` |
| Edge Function code (`index.ts`) | ✅ Prêt |
| Edge Function déployée | ⚠️ **À faire manuellement** (voir étapes ci-dessus) |
| Secrets Supabase configurés | ⚠️ **À faire manuellement** |
| Tests Flutter | ✅ `image_service_test.dart` ajouté |

---

## 8. Problèmes bloquants restants

1. **L'Edge Function n'est pas déployée.** Tant qu'elle n'est pas déployée
   et que les secrets ne sont pas configurés, **aucun upload d'image
   d'annonce ne fonctionnera**. L'application affichera une erreur réseau
   ou HTTP 404 sur l'URL de la fonction.

2. **Le document Firestore est créé en statut `pending` avant l'upload.**
   Si l'utilisateur quitte l'application pendant l'upload, le document
   reste en statut `pending` et n'apparaît pas dans les annonces actives.
   Un nettoyage automatique (Cloud Function Firebase) est recommandé pour
   les supprimer après 24 h.

3. **La suppression via l'Edge Function n'est pas encore implémentée côté
   serveur.** L'`image_service.dart` envoie une requête DELETE à la
   fonction, mais la fonction actuelle ne gère que POST. Un endpoint DELETE
   doit être ajouté à `index.ts` pour la suppression sécurisée des images.
