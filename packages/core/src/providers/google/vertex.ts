// ============================================================
// Vertex AI provider — Google Cloud Vertex AI integration.
// Supports service account and ADC authentication.
// Uses native Node.js crypto for JWT signing — no Google SDK required.
// ============================================================

import crypto from 'node:crypto';
import type { VertexCredentials } from '../../types/auth.types.js';
import { resolveVertexCredentials } from './vertex-auth.js';

export interface VertexModel {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
}

const VERTEX_API_BASE = 'https://{location}-aiplatform.googleapis.com';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TOKEN_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const REQUEST_TIMEOUT_MS = 15000;

// Curated list of widely available Vertex AI models.
// Updated May 2026.
const KNOWN_VERTEX_MODELS: VertexModel[] = [
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', contextWindow: 1048576 },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', contextWindow: 1048576 },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', contextWindow: 1048576 },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'google',
    contextWindow: 1048576,
  },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', contextWindow: 2097152 },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', contextWindow: 1048576 },
  { id: 'gemma-3-27b', name: 'Gemma 3 27B', provider: 'google', contextWindow: 131072 },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'google', contextWindow: 200000 },
  { id: 'claude-opus-4', name: 'Claude Opus 4', provider: 'google', contextWindow: 200000 },
  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'google', contextWindow: 200000 },
  { id: 'llama-3.1-405b', name: 'Llama 3.1 405B', provider: 'google', contextWindow: 131072 },
  { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', provider: 'google', contextWindow: 131072 },
];

/**
 * Generate a JWT signed with RS256 for Google OAuth2 service account flow.
 */
function generateServiceAccountJwt(clientEmail: string, privateKey: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');

  const now = Math.floor(Date.now() / 1000);
  const claims = Buffer.from(
    JSON.stringify({
      iss: clientEmail,
      scope: TOKEN_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    }),
  ).toString('base64url');

  const signatureInput = `${header}.${claims}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  sign.end();
  const signature = sign.sign(privateKey).toString('base64url');

  return `${signatureInput}.${signature}`;
}

/**
 * Exchange a service account JWT for an OAuth2 access token.
 */
async function exchangeJwtForAccessToken(jwt: string): Promise<string | null> {
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Get an OAuth2 access token for Vertex AI API calls.
 * Returns null if authentication fails (e.g., for ADC without gcloud SDK).
 */
async function getVertexAccessToken(
  projectId: string,
  clientEmail?: string,
  privateKey?: string,
): Promise<string | null> {
  if (clientEmail && privateKey) {
    const jwt = generateServiceAccountJwt(clientEmail, privateKey);
    return exchangeJwtForAccessToken(jwt);
  }
  // ADC path: gcloud CLI must be installed and authenticated.
  // Without the Google Auth library, we cannot obtain a token.
  return null;
}

/**
 * Validate Vertex AI credentials by attempting to list models via the REST API.
 */
export async function validateVertexCredentials(
  credentials: VertexCredentials,
  location?: string,
): Promise<{ valid: boolean; error?: string }> {
  const resolved = resolveVertexCredentials(credentials);
  if (!resolved) {
    return { valid: false, error: 'Invalid or unsupported credential type' };
  }

  const loc = location ?? resolved.location;
  const accessToken = await getVertexAccessToken(
    resolved.projectId,
    'credentials' in resolved
      ? (resolved.credentials as { client_email?: string })?.client_email
      : undefined,
    'credentials' in resolved
      ? (resolved.credentials as { private_key?: string })?.private_key
      : undefined,
  );

  if (!accessToken) {
    if (credentials.type === 'adc') {
      return {
        valid: false,
        error:
          'ADC requires gcloud CLI with application-default login. Run: gcloud auth application-default login',
      };
    }
    return {
      valid: false,
      error: 'Failed to obtain access token. Check service account credentials.',
    };
  }

  try {
    const url = `${VERTEX_API_BASE.replace('{location}', loc)}/v1/projects/${resolved.projectId}/locations/${loc}/publishers/google/models`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.ok) {
      return { valid: true };
    }

    const errorText = await response.text().catch(() => 'Unknown error');
    return { valid: false, error: `API error (${response.status}): ${errorText.slice(0, 200)}` };
  } catch (err) {
    return {
      valid: false,
      error: `Connection failed: ${err instanceof Error ? err.message : 'Unknown'}`,
    };
  }
}

/**
 * Fetch available Vertex AI models for the given credentials and location.
 * Returns a curated list of known models. Falls back to API listing when
 * credentials are valid and an access token is available.
 */
export async function fetchVertexModels(
  credentials: VertexCredentials,
  location?: string,
): Promise<VertexModel[]> {
  const resolved = resolveVertexCredentials(credentials);
  if (!resolved) {
    return [];
  }

  const loc = location ?? resolved.location;

  // Try API listing for service accounts
  if (credentials.type === 'service-account') {
    const sa = credentials;
    const jwt = generateServiceAccountJwt(sa.clientEmail, sa.privateKey);
    const accessToken = await exchangeJwtForAccessToken(jwt);

    if (accessToken) {
      try {
        const url = `${VERTEX_API_BASE.replace('{location}', loc)}/v1/projects/${resolved.projectId}/locations/${loc}/publishers/google/models`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (response.ok) {
          const data = (await response.json()) as {
            models?: Array<{
              name: string;
              displayName?: string;
              supportedGenerationMethods?: string[];
              baseModelId?: string;
            }>;
          };
          const models = data.models ?? [];
          return models
            .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m) => {
              const id = m.name.split('/').pop() ?? m.name;
              return {
                id,
                name: m.displayName ?? id,
                provider: 'google',
                contextWindow: undefined,
              };
            });
        }
      } catch {
        // API listing failed, fall through to curated list
      }
    }
  }

  return KNOWN_VERTEX_MODELS;
}
