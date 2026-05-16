// ============================================================
// Bedrock credential resolver — resolves AWS Bedrock
// credentials from various sources (access key, profile, API key).
// ============================================================

import type {
  BedrockAccessKeyCredentials,
  BedrockProfileCredentials,
  BedrockCredentials,
} from '../../types/auth.types.js';

/**
 * Resolve Bedrock credentials into a canonical form for the AWS SDK.
 */
export function resolveBedrockCredentials(
  credentials: BedrockCredentials,
): { accessKeyId: string; secretAccessKey: string; region: string } | null {
  if (credentials.type === 'access-key') {
    const c = credentials as BedrockAccessKeyCredentials;
    return {
      accessKeyId: c.accessKeyId,
      secretAccessKey: c.secretAccessKey,
      region: c.region ?? 'us-east-1',
    };
  }
  // Profile and API key types require AWS SDK for resolution
  return null;
}
