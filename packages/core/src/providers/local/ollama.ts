// ============================================================
// Ollama provider — local LLM runtime connection testing
// and model discovery via the Ollama REST API.
// ============================================================

export interface OllamaModel {
  id: string;
  name: string;
  size: number;
  toolSupport: 'supported' | 'unsupported' | 'unknown';
}

export interface OllamaConnectionResult {
  connected: boolean;
  error?: string;
  models?: OllamaModel[];
}

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';

/**
 * Test connection to a local Ollama instance and list available models.
 */
export async function testOllamaConnection(
  baseUrl: string = DEFAULT_OLLAMA_URL,
): Promise<OllamaConnectionResult> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { connected: false, error: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as {
      models?: { name: string; size: number }[];
    };

    const models: OllamaModel[] = (data.models ?? []).map((m) => ({
      id: m.name,
      name: m.name,
      size: m.size,
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
