// Configuration du stockage des images d'annonces.
// Mêmes valeurs publiques que app-flutter/lib/services/supabase_client.dart et
// image_service.dart : Supabase ne sert qu'au stockage des photos (bucket
// public `property-images`), via l'Edge Function `process-image` qui vérifie le
// jeton d'identification Firebase. Aucune clé secrète ne figure ici ; la clé
// service_role reste côté serveur.

export const SUPABASE_URL = 'https://sjtsymnbacouhpwyhcre.supabase.co';

export const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/process-image`;

export const STORAGE_PUBLIC_URL = `${SUPABASE_URL}/storage/v1/object/public/property-images`;
