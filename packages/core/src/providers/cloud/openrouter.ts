// ============================================================
// OpenRouter provider — multi-provider model routing.
// Fetches available models from the OpenRouter API.
// ============================================================

export interface OpenRouterModel {
  id: string;
  name: string;
  pricing?: {
    prompt: string;
    completion: string;
  };
  contextLength?: number;
}

export interface FetchModelsResult {
  models: OpenRouterModel[];
  error?: string;
}

/**
 * Fetch available models from OpenRouter's API.
 * Requires an API key for authenticated access.
 */
export async function fetchOpenRouterModels(_apiKey?: string): Promise<FetchModelsResult> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return { models: [], error: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as { data?: OpenRouterModel[] };
    return { models: data.data ?? [] };
  } catch (err) {
    return {
      models: [],
      error: err instanceof Error ? err.message : 'Failed to fetch models',
    };
  }
}
