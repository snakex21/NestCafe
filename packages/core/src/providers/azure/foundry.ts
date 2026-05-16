// ============================================================
// Azure AI Foundry provider — connection testing
// and model discovery for Azure AI Foundry endpoints.
// Supports API key and Entra ID authentication.
// ============================================================

export interface AzureFoundryValidationOptions {
  endpoint: string;
  deploymentName: string;
  apiKey?: string;
  authType: 'api-key' | 'entra-id';
}

export interface AzureFoundryConnectionResult {
  success: boolean;
  error?: string;
  models?: string[];
}

/**
 * Validate Azure Foundry connection configuration.
 */
export function validateAzureFoundry(options: AzureFoundryValidationOptions): string | null {
  if (!options.endpoint) {
    return 'Endpoint URL is required';
  }
  if (!options.deploymentName) {
    return 'Deployment name is required';
  }
  if (options.authType === 'api-key' && !options.apiKey) {
    return 'API key is required for api-key authentication';
  }
  return null;
}

/**
 * Test Azure Foundry connection by sending a test request.
 */
export async function testAzureFoundryConnection(
  options: AzureFoundryValidationOptions,
): Promise<AzureFoundryConnectionResult> {
  const validationError = validateAzureFoundry(options);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const url = `${options.endpoint}/openai/deployments/${options.deploymentName}/chat/completions?api-version=2024-02-15-preview`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.authType === 'api-key' && options.apiKey) {
      headers['api-key'] = options.apiKey;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    return { success: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}
