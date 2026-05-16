// ============================================================
// NVIDIA NIM provider — NVIDIA inference microservices.
// Connection testing and model discovery.
// ============================================================

import { NIM_DEFAULT_BASE_URL } from '../../types/provider.types.js';

export { NIM_DEFAULT_BASE_URL };

export interface NimConnectionResult {
  connected: boolean;
  error?: string;
}

/**
 * Test connection to a NVIDIA NIM endpoint.
 */
export async function testNimConnection(
  baseUrl: string = NIM_DEFAULT_BASE_URL,
  apiKey?: string,
): Promise<NimConnectionResult> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/v1/models`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    const connected = response.ok;
    return {
      connected,
      error: connected ? undefined : `HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}
