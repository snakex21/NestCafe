import http from 'node:http';
import https from 'node:https';
import { validateHttpUrl } from '../utils/url.js';
import { sanitizeString } from '../utils/sanitize.js';
import { createConsoleLogger } from '../utils/logging.js';

const log = createConsoleLogger({ prefix: 'CustomProvider' });

const DEFAULT_TIMEOUT_MS = 10000;

interface ModelRequestResult {
  status: number;
  body: string;
}

function requestModels(url: string, headers: Record<string, string>): Promise<ModelRequestResult> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    const request = client.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers,
        ...(isHttps ? { rejectUnauthorized: false } : {}),
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );

    request.on('error', reject);
    request.setTimeout(DEFAULT_TIMEOUT_MS, () => {
      request.destroy(new Error('Request timed out'));
    });
    request.end();
  });
}

function parseJsonBody(body: string): unknown {
  try {
    return JSON.parse(body || '{}') || {};
  } catch {
    return {};
  }
}
export interface CustomConnectionResult {
  success: boolean;
  error?: string;
  models?: Array<{ id: string; name: string }>;
}

function parseCustomModels(data: unknown): Array<{ id: string; name: string }> {
  const seen = new Set<string>();
  const models: Array<{ id: string; name: string }> = [];

  const addModel = (model: unknown) => {
    if (typeof model === 'string') {
      const id = model.trim();
      if (id && !seen.has(id)) {
        seen.add(id);
        models.push({ id, name: id });
      }
      return;
    }

    if (!model || typeof model !== 'object') {
      return;
    }

    const item = model as {
      id?: unknown;
      name?: unknown;
      model?: unknown;
      slug?: unknown;
      display_name?: unknown;
      displayName?: unknown;
    };
    const id = item.slug || item.id || item.model || item.name;
    if (typeof id !== 'string' || !id.trim()) {
      return;
    }

    const trimmedId = id.trim();
    if (seen.has(trimmedId)) {
      return;
    }

    const name =
      typeof item.display_name === 'string'
        ? item.display_name
        : typeof item.displayName === 'string'
          ? item.displayName
          : typeof item.name === 'string'
            ? item.name
            : id;
    seen.add(trimmedId);
    models.push({ id: trimmedId, name: name.trim() || trimmedId });
  };

  const walk = (value: unknown) => {
    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        addModel(item);
      }
      return;
    }

    if (typeof value !== 'object') {
      return;
    }

    const record = value as Record<string, unknown>;
    const preferredKeys = new Set(['data', 'models', 'model']);
    for (const key of preferredKeys) {
      walk(record[key]);
    }
    for (const [key, child] of Object.entries(record)) {
      if (!preferredKeys.has(key)) {
        walk(child);
      }
    }
  };

  walk(data);
  return models;
}

function buildModelUrls(normalizedUrl: string): string[] {
  const parsedUrl = new URL(normalizedUrl);
  const origin = parsedUrl.origin;
  const path = parsedUrl.pathname.replace(/\/+$/, '');
  const baseWithoutTrailingSlash = `${origin}${path}`;
  const urls = [
    `${baseWithoutTrailingSlash}/models`,
    `${baseWithoutTrailingSlash}/model`,
    `${origin}/v1/models`,
    `${origin}/models`,
  ];

  return [...new Set(urls)];
}

function buildHeaderVariants(apiKey?: string): Array<Record<string, string>> {
  const baseHeaders = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Accomplish/1.0',
  };

  if (!apiKey) {
    return [baseHeaders];
  }

  return [
    { ...baseHeaders, Authorization: `Bearer ${apiKey}` },
    { ...baseHeaders, 'x-api-key': apiKey },
    baseHeaders,
  ];
}

/**
 * Tests connection to a custom OpenAI-compatible endpoint.
 *
 * Attempts to reach the /models endpoint to verify connectivity.
 * The connection is considered successful if we can reach the server,
 * even if /models returns an error (many endpoints don't implement it).
 *
 * @param baseUrl - The base URL of the OpenAI-compatible endpoint (e.g., https://api.example.com/v1)
 * @param apiKey - Optional API key for authentication
 * @returns Connection result indicating success or failure
 */
export async function testCustomConnection(
  baseUrl: string,
  apiKey?: string,
): Promise<CustomConnectionResult> {
  const sanitizedUrl = sanitizeString(baseUrl, 'customUrl', 256);
  const sanitizedApiKey = apiKey ? sanitizeString(apiKey, 'apiKey', 256) : undefined;

  try {
    validateHttpUrl(sanitizedUrl, 'Custom endpoint URL');
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Invalid URL format' };
  }

  // Normalize URL - remove trailing slash
  const normalizedUrl = sanitizedUrl.replace(/\/+$/, '');

  try {
    let authenticationError: string | null = null;
    let reachable = false;
    const foundModels = new Map<string, { id: string; name: string }>();
    const urls = buildModelUrls(normalizedUrl);
    const headerVariants = buildHeaderVariants(sanitizedApiKey);

    for (const modelsUrl of urls) {
      for (const headers of headerVariants) {
        let response: ModelRequestResult;
        try {
          response = await requestModels(modelsUrl, headers);
        } catch (requestError) {
          log.warn(
            `[Custom] Model scan request failed for ${modelsUrl}: ${
              requestError instanceof Error ? requestError.message : String(requestError)
            }`,
          );
          continue;
        }

        if (response.status >= 200 && response.status < 300) {
          reachable = true;
          const data = parseJsonBody(response.body);
          const models = parseCustomModels(data);
          if (models.length > 0) {
            log.info(`[Custom] Fetched ${models.length} models from ${modelsUrl}`);
            for (const model of models) {
              foundModels.set(model.id, model);
            }
          }
        }

        if (response.status === 401 || response.status === 403) {
          const errorData = parseJsonBody(response.body) as {
            error?: { message?: string };
            message?: string;
          };
          authenticationError =
            errorData?.error?.message ||
            errorData?.message ||
            'Authentication failed. Check the API key and endpoint URL.';
          continue;
        }

        if (response.status !== 404) {
          reachable = true;
        }
      }
    }

    if (foundModels.size > 0) {
      return { success: true, models: [...foundModels.values()] };
    }

    if (authenticationError && !reachable) {
      return { success: false, error: authenticationError };
    }

    return { success: true, models: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    log.warn(`[Custom] Connection failed: ${message}`);

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: 'Connection timed out. Make sure the endpoint is accessible.',
      };
    }

    return { success: false, error: `Cannot connect to endpoint: ${message}` };
  }
}
