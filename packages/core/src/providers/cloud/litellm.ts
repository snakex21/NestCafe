// ============================================================
// LiteLLM provider — local proxy for multiple AI providers.
// Connection testing and model discovery.
// ============================================================

export interface LiteLLMConnectionResult {
  connected: boolean;
  error?: string;
  models?: { id: string; name: string; provider: string; contextLength: number }[];
}

/**
 * Test connection to a LiteLLM proxy instance and fetch available models.
 */
export async function testLiteLLMConnection(
  baseUrl: string,
  apiKey?: string,
): Promise<LiteLLMConnectionResult> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/v1/models`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { connected: false, error: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as {
      data?: { id: string; owned_by: string; context_length?: number }[];
    };

    const models = (data.data ?? []).map((m) => ({
      id: m.id,
      name: m.id,
      provider: m.owned_by,
      contextLength: m.context_length ?? 4096,
    }));

    return { connected: true, models };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}
