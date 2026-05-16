// ============================================================
// Bedrock provider — AWS Bedrock credential validation
// and model fetching via native HTTPS + AWS Signature V4.
// No AWS SDK required — uses Node.js crypto for signing.
// ============================================================

import crypto from 'node:crypto';
import type { BedrockCredentials } from '../../types/auth.types.js';
import { resolveBedrockCredentials } from './bedrock-credentials.js';

export interface BedrockModel {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
}

export interface FetchBedrockModelsResult {
  models: BedrockModel[];
  error?: string;
}

const BEDROCK_SERVICE = 'bedrock';
const REQUEST_TIMEOUT_MS = 15000;

/**
 * SHA-256 hash, hex-encoded.
 */
function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * HMAC-SHA256, returns Buffer.
 */
function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

/**
 * Build AWS Signature V4 authorization headers for a request.
 */
function signAwsRequest(
  method: string,
  service: string,
  region: string,
  host: string,
  canonicalUri: string,
  canonicalQuerystring: string,
  payload: string,
  accessKeyId: string,
  secretAccessKey: string,
): { authorization: string; amzDate: string; contentSha256: string } {
  const now = new Date();
  const amzDate =
    now
      .toISOString()
      .replace(/[:-]|\.\d{3}/g, '')
      .slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const contentSha256 = sha256(payload);

  // Canonical request
  const canonicalHeaders =
    [`content-type:application/json`, `host:${host}`, `x-amz-date:${amzDate}`].join('\n') + '\n';
  const signedHeaders = 'content-type;host;x-amz-date';

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    contentSha256,
  ].join('\n');

  // String to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');

  // Signing key
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');

  const signature = hmacSha256(kSigning, stringToSign).toString('hex');

  const authorization = [
    'AWS4-HMAC-SHA256',
    `Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');

  return { authorization, amzDate, contentSha256 };
}

/**
 * Parse a Bedrock ListFoundationModels API response into BedrockModel array.
 */
function parseListModelsResponse(data: Record<string, unknown>): BedrockModel[] {
  const summaries = data.modelSummaries as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(summaries)) {
    return [];
  }

  return summaries
    .filter((m) => {
      const streams = m.inputModalities as string[] | undefined;
      const output = m.outputModalities as string[] | undefined;
      return streams?.includes('TEXT') && output?.includes('TEXT');
    })
    .map((m) => {
      const modelId = String(m.modelId ?? '');
      const modelName = String(m.modelName ?? modelId);
      return {
        id: modelId,
        name: modelName,
        provider: 'bedrock',
        contextWindow: undefined,
      };
    });
}

/**
 * Send a signed POST request to the Bedrock API.
 */
async function bedrockApiCall(
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  target: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data?: Record<string, unknown>; error?: string }> {
  const host = `${BEDROCK_SERVICE}.${region}.amazonaws.com`;
  const payload = JSON.stringify(body);
  const { authorization, amzDate } = signAwsRequest(
    'POST',
    BEDROCK_SERVICE,
    region,
    host,
    '/',
    '',
    payload,
    accessKeyId,
    secretAccessKey,
  );

  try {
    const response = await fetch(`https://${host}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: host,
        'X-Amz-Date': amzDate,
        'X-Amz-Target': target,
        Authorization: authorization,
        Accept: 'application/json',
      },
      body: payload,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const text = await response.text().catch(() => '');
    let data: Record<string, unknown> | undefined;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // non-JSON response
    }

    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Validate AWS Bedrock credentials by calling the ListFoundationModels API
 * using AWS Signature V4 signing — no AWS SDK required.
 */
export async function validateBedrockCredentials(
  credentials: BedrockCredentials,
  region?: string,
): Promise<{ valid: boolean; error?: string }> {
  const resolved = resolveBedrockCredentials(credentials);
  if (!resolved) {
    if (credentials.type === 'profile') {
      return {
        valid: false,
        error:
          'Profile credentials require AWS CLI with "aws configure". Use access-key credentials instead.',
      };
    }
    return {
      valid: false,
      error: 'API key credentials require the AWS SDK. Use access-key credentials instead.',
    };
  }

  const reg = region ?? resolved.region;

  // Use the Bedrock Runtime API (simpler endpoint for validation)
  // Try ListFoundationModels via the Bedrock control plane
  const result = await bedrockApiCall(
    reg,
    resolved.accessKeyId,
    resolved.secretAccessKey,
    'AmazonBedrockControlPlaneService.ListFoundationModels',
    { maxResults: 1 },
  );

  if (result.ok) {
    return { valid: true };
  }

  // Try a simpler endpoint if control plane requires extra permissions
  const result2 = await bedrockApiCall(
    reg,
    resolved.accessKeyId,
    resolved.secretAccessKey,
    'AmazonBedrockControlPlaneService.ListFoundationModels',
    {},
  );

  if (result2.ok) {
    return { valid: true };
  }

  const errorDetail = result.data
    ? JSON.stringify(result.data).slice(0, 300)
    : (result.error ?? `HTTP ${result.status}`);
  return { valid: false, error: `Bedrock API error: ${errorDetail}` };
}

/**
 * Fetch available Bedrock foundation models.
 * Returns models from the API when credentials are valid,
 * falls back to the static BEDROCK_MODELS catalog.
 */
export async function fetchBedrockModels(
  credentials: BedrockCredentials,
  region?: string,
): Promise<FetchBedrockModelsResult> {
  const resolved = resolveBedrockCredentials(credentials);
  if (!resolved) {
    return { models: [], error: 'Unsupported credential type for API fetching' };
  }

  const reg = region ?? resolved.region;

  const result = await bedrockApiCall(
    reg,
    resolved.accessKeyId,
    resolved.secretAccessKey,
    'AmazonBedrockControlPlaneService.ListFoundationModels',
    {},
  );

  if (result.ok && result.data) {
    const models = parseListModelsResponse(result.data);
    if (models.length > 0) {
      return { models };
    }
  }

  const errorMsg = result.error ?? `HTTP ${result.status}`;
  return { models: [], error: `Failed to fetch models: ${errorMsg}` };
}
