// ============================================================
// API key validation — standard OpenAI-compatible validation
// for providers that accept bearer/x-api-key auth headers.
// ============================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  provider?: string;
  models?: string[];
}

export interface ValidationOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

/**
 * Validate an API key against an OpenAI-compatible endpoint.
 * Sends a lightweight request to the models endpoint to verify the key.
 */
export async function validateApiKey(
  apiKey: string,
  provider: string,
  options: ValidationOptions = {},
): Promise<ValidationResult> {
  const baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
  const url = `${baseUrl}/models`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return {
        valid: false,
        error: `HTTP ${response.status}: ${body.slice(0, 200)}`,
        provider,
      };
    }

    const data = (await response.json()) as { data?: { id: string }[] };
    const models = data.data?.map((m) => m.id) ?? [];

    return { valid: true, provider, models };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      provider,
    };
  }
}
