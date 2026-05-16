// ============================================================
// LM Studio provider — local LLM server connection testing
// and model discovery.
// ============================================================

export interface LMStudioModel {
  id: string;
  name: string;
  toolSupport: 'supported' | 'unsupported' | 'unknown';
}

export interface LMStudioConnectionResult {
  connected: boolean;
  error?: string;
  models?: LMStudioModel[];
}

export const LMSTUDIO_REQUEST_TIMEOUT_MS = 10_000;

const DEFAULT_LMSTUDIO_URL = 'http://127.0.0.1:1234';

/**
 * Test connection to LM Studio and fetch available models.
 */
export async function testLMStudioConnection(
  baseUrl: string = DEFAULT_LMSTUDIO_URL,
): Promise<LMStudioConnectionResult> {
  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      signal: AbortSignal.timeout(LMSTUDIO_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { connected: false, error: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as {
      data?: { id: string }[];
    };

    const models: LMStudioModel[] = (data.data ?? []).map((m) => ({
      id: m.id,
      name: m.id,
      toolSupport: 'unknown',
    }));

    return { connected: true, models };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

/**
 * Validate LM Studio configuration.
 */
export function validateLMStudioConfig(baseUrl: string): string | null {
  if (!baseUrl) {
    return 'Base URL is required';
  }
  try {
    new URL(baseUrl);
    return null;
  } catch {
    return 'Invalid base URL format';
  }
}
