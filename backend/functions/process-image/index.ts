/**
 * Supabase Edge Function: process-image
 *
 * Point d'entrée sécurisé pour l'upload et la suppression d'images d'annonces.
 * - Vérifie le Firebase ID Token côté serveur (via JWKS Google public).
 * - POST  : vérifie la propriété de l'annonce, valide type/taille, upload.
 * - DELETE: vérifie l'authentification, supprime les chemins demandés.
 *
 * Variables d'environnement requises (Supabase Secrets) :
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   FIREBASE_PROJECT_ID
 */

// @ts-ignore Deno imports
import { createClient } from 'npm:@supabase/supabase-js@2';
// @ts-ignore Deno imports
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') ?? '';

const BUCKET = 'property-images';
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Firebase ID tokens sont des JWTs signés vérifiables contre les JWKS publics.
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface UploadPayload {
  listingId?: string;
  fileBase64?: string;
  fileName?: string;
  contentType?: string;
}

interface DeletePayload {
  paths?: string[];
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function verifyFirebaseToken(token: string): Promise<string> {
  if (!FIREBASE_PROJECT_ID) {
    throw new Error('FIREBASE_PROJECT_ID is not configured');
  }
  const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });
  const uid =
    typeof payload.user_id === 'string' ? payload.user_id : payload.sub;
  if (!uid || typeof uid !== 'string') {
    throw new Error('Invalid Firebase token payload');
  }
  return uid;
}

function extensionFor(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg': return 'jpg';
    case 'image/png':  return 'png';
    case 'image/webp': return 'webp';
    default:           return 'bin';
  }
}

async function extractToken(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  return authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;
}

// ============================================================ Deno.serve

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }

  // ---------------------------------------------------------------- DELETE
  if (req.method === 'DELETE') {
    const token = await extractToken(req);
    if (!token) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    let uid: string;
    try {
      uid = await verifyFirebaseToken(token);
    } catch (err) {
      return jsonResponse(
        { error: 'Invalid Firebase token', detail: String(err) },
        401,
      );
    }

    let body: DeletePayload;
    try {
      body = (await req.json()) as DeletePayload;
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const paths = body.paths;
    if (!Array.isArray(paths) || paths.length === 0) {
      return jsonResponse({ error: 'paths array is required' }, 400);
    }

    const { error: deleteError } = await supabase.storage
      .from(BUCKET)
      .remove(paths);

    if (deleteError) {
      return jsonResponse(
        { error: 'Delete failed', detail: deleteError.message },
        500,
      );
    }

    return jsonResponse({ deleted: paths.length, uid });
  }

  // ---------------------------------------------------------------- POST
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const token = await extractToken(req);
  if (!token) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch (err) {
    return jsonResponse(
      { error: 'Invalid Firebase token', detail: String(err) },
      401,
    );
  }

  let payload: UploadPayload;
  try {
    payload = (await req.json()) as UploadPayload;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { listingId, fileBase64, fileName, contentType } = payload;

  if (!listingId || !fileBase64 || !contentType) {
    return jsonResponse(
      { error: 'listingId, fileBase64 and contentType are required' },
      400,
    );
  }

  if (!ALLOWED_TYPES.has(contentType)) {
    return jsonResponse(
      { error: 'Unsupported content type. Use JPEG, PNG or WebP.' },
      400,
    );
  }

  let bytes: Uint8Array;
  try {
    const binary = atob(fileBase64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  } catch {
    return jsonResponse({ error: 'fileBase64 is not valid base64' }, 400);
  }

  if (bytes.byteLength === 0) {
    return jsonResponse({ error: 'Empty file' }, 400);
  }
  if (bytes.byteLength > MAX_SIZE_BYTES) {
    return jsonResponse({ error: 'File exceeds 5 MB limit' }, 413);
  }

  // Vérifie la propriété de l'annonce si le document existe déjà.
  // Si le document n'existe pas (404), il s'agit d'une nouvelle annonce dont
  // l'ID a été généré localement côté Flutter avant l'écriture Firestore.
  // Dans ce cas on fait confiance au Firebase ID Token déjà validé.
  const listingUrl =
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}` +
    `/databases/(default)/documents/listings/${listingId}`;

  const listingResponse = await fetch(listingUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (listingResponse.ok) {
    const listingDoc = await listingResponse.json();
    const ownerId =
      listingDoc?.fields?.proprietaireId?.stringValue ??
      listingDoc?.fields?.ownerId?.stringValue;
    if (ownerId && ownerId !== uid) {
      return jsonResponse({ error: 'You do not own this listing' }, 403);
    }
  }

  // Génère un chemin unique pour éviter les collisions.
  const uniqueId = crypto.randomUUID();
  const safeName = (fileName ?? `image.${extensionFor(contentType)}`)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-80);
  const path = `${uniqueId}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType,
      upsert: false,
      cacheControl: '3600',
    });

  if (uploadError) {
    return jsonResponse(
      { error: 'Upload failed', detail: uploadError.message },
      500,
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return jsonResponse({
    url: publicUrlData.publicUrl,
    path,
    listingId,
    ownerId: uid,
  });
});
