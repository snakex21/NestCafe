// ============================================================
// Vertex AI authentication — resolves service account
// and ADC (Application Default Credentials) for Vertex AI.
// ============================================================

import type {
  VertexServiceAccountCredentials,
  VertexAdcCredentials,
  VertexCredentials,
} from '../../types/auth.types.js';

/**
 * Resolve Vertex AI credentials into a canonical form.
 */
export function resolveVertexCredentials(
  credentials: VertexCredentials,
): { projectId: string; location: string; credentials?: object } | null {
  if (credentials.type === 'service-account') {
    const c = credentials as VertexServiceAccountCredentials;
    return {
      projectId: c.projectId,
      location: c.location ?? 'us-central1',
      credentials: {
        client_email: c.clientEmail,
        private_key: c.privateKey,
      },
    };
  }
  if (credentials.type === 'adc') {
    const c = credentials as VertexAdcCredentials;
    return {
      projectId: c.projectId,
      location: c.location ?? 'us-central1',
    };
  }
  return null;
}
