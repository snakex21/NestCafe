// ============================================================
// Bedrock model definitions — static model catalog for
// AWS Bedrock foundation models.
// ============================================================

import type { ModelConfig } from '../../types/provider.types.js';

/**
 * Statically defined Bedrock models available without dynamic fetching.
 */
export const BEDROCK_MODELS: ModelConfig[] = [
  {
    id: 'claude-opus-4-5',
    displayName: 'Claude Opus 4.5',
    provider: 'bedrock',
    fullId: 'bedrock/anthropic.claude-opus-4-5',
    contextWindow: 200_000,
    supportsVision: true,
  },
  {
    id: 'claude-sonnet-4-5',
    displayName: 'Claude Sonnet 4.5',
    provider: 'bedrock',
    fullId: 'bedrock/anthropic.claude-sonnet-4-5',
    contextWindow: 200_000,
    supportsVision: true,
  },
  {
    id: 'llama-3-70b',
    displayName: 'Llama 3 70B',
    provider: 'bedrock',
    fullId: 'bedrock/meta.llama3-70b-instruct-v1:0',
    contextWindow: 8000,
    supportsVision: false,
  },
];
