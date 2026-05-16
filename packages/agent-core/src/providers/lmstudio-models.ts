/**
 * LM Studio model discovery helpers.
 * Fetches available models from the LM Studio server without loading them.
 */

import { fetchWithTimeout } from '../utils/fetch.js';
import { createConsoleLogger } from '../utils/logging.js';

const log = createConsoleLogger({ prefix: 'LMStudio' });

/** Default timeout for LM Studio API requests in milliseconds */
export const LMSTUDIO_REQUEST_TIMEOUT_MS = 15000;

/** Response type from LM Studio /v1/models endpoint */
interface LMStudioModelsResponse {
  data?: Array<{
    id: string;
    object: string;
    owned_by?: string;
  }>;
}

import type { ToolSupportStatus } from '../common/types/providerSettings.js';

/** LM Studio model with tool support information */
export interface LMStudioModel {
  id: string;
  name: string;
  toolSupport: ToolSupportStatus;
}

/** Result of testing connection to LM Studio */
export interface LMStudioConnectionResult {
  success: boolean;
  error?: string;
  models?: LMStudioModel[];
}

/** Options for fetching LM Studio models */
export interface LMStudioFetchModelsOptions {
  /** The LM Studio server base URL */
  baseUrl: string;
  /** Request timeout in milliseconds (default: 15000) */
  timeoutMs?: number;
}

/**
 * Converts a model ID to a human-readable display name.
 * Replaces hyphens with spaces and capitalizes words.
 */
export function formatModelDisplayName(modelId: string): string {
  return modelId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Fetch raw model list from LM Studio /v1/models endpoint.
 *
 * Important: do not call chat/completions here. LM Studio may load a model when
 * it receives an inference request, while settings only needs discovery.
 * Shared by both testLMStudioConnection and fetchLMStudioModels.
 */
export async function fetchAndEnrichModels(
  baseUrl: string,
  timeoutMs: number,
): Promise<LMStudioConnectionResult> {
  const response = await fetchWithTimeout(`${baseUrl}/v1/models`, { method: 'GET' }, timeoutMs);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage =
      (errorData as { error?: { message?: string } })?.error?.message ||
      `API returned status ${response.status}`;
    return { success: false, error: errorMessage };
  }

  const data = (await response.json()) as LMStudioModelsResponse;
  const rawModels = data.data || [];

  const models: LMStudioModel[] = [];

  for (const m of rawModels) {
    const displayName = formatModelDisplayName(m.id);

    models.push({
      id: m.id,
      name: displayName,
      toolSupport: 'unknown',
    });

    log.info(`[LM Studio] Discovered model ${m.id}`);
  }

  return { success: true, models };
}

/**
 * Fetches available models from an LM Studio server.
 *
 * Intended for refreshing the model list when LM Studio is already configured.
 *
 * @param options - Options including base URL and optional timeout
 * @returns Result with models if successful
 */
export async function fetchLMStudioModels(
  options: LMStudioFetchModelsOptions,
): Promise<LMStudioConnectionResult> {
  const { baseUrl, timeoutMs = LMSTUDIO_REQUEST_TIMEOUT_MS } = options;

  try {
    return await fetchAndEnrichModels(baseUrl, timeoutMs);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch models';
    log.warn(`[LM Studio] Fetch failed: ${message}`);

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timed out. Check your LM Studio server.',
      };
    }
    return { success: false, error: `Failed to fetch models: ${message}` };
  }
}
