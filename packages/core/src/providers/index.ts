// ============================================================
// Providers barrel — re-exports all AI provider integrations.
// Grouped by category: aws/, google/, azure/, local/, cloud/, copilot/.
// ============================================================

// Models (shared)
export {
  getModelsForProvider,
  getDefaultModelForProvider,
  isValidModel,
  findModelById,
  getProviderById,
  providerRequiresApiKey,
  getApiKeyEnvVar,
  DEFAULT_PROVIDERS,
  DEFAULT_MODEL,
} from './models.js';

// Validation
export { validateApiKey } from './validation.js';
export type { ValidationResult, ValidationOptions } from './validation.js';

// AWS / Bedrock
export {
  validateBedrockCredentials,
  fetchBedrockModels,
  BEDROCK_MODELS,
  resolveBedrockCredentials,
} from './aws/index.js';
export type { BedrockModel, FetchBedrockModelsResult } from './aws/index.js';

// Google / Vertex
export {
  validateVertexCredentials,
  fetchVertexModels,
  resolveVertexCredentials,
} from './google/index.js';
export type { VertexModel } from './google/index.js';

// Azure / Foundry
export {
  validateAzureFoundry,
  testAzureFoundryConnection,
  getEntraIdToken,
} from './azure/index.js';
export type { AzureFoundryValidationOptions, AzureFoundryConnectionResult } from './azure/index.js';

// Local
export {
  testOllamaConnection,
  testLMStudioConnection,
  validateLMStudioConfig,
  LMSTUDIO_REQUEST_TIMEOUT_MS,
  LMSTUDIO_KNOWN_MODELS,
  HF_LOCAL_DEFAULT_URL,
  HF_RECOMMENDED_MODELS,
  searchHuggingFaceHubModels,
  testHuggingFaceLocalConnection,
} from './local/index.js';
export type {
  OllamaModel,
  OllamaConnectionResult,
  LMStudioModel,
  LMStudioConnectionResult,
  HuggingFaceHubModel,
} from './local/index.js';

// Cloud
export {
  fetchOpenRouterModels,
  testLiteLLMConnection,
  testNimConnection,
  NIM_DEFAULT_BASE_URL,
} from './cloud/index.js';
export type {
  OpenRouterModel,
  FetchModelsResult,
  LiteLLMConnectionResult,
  NimConnectionResult,
} from './cloud/index.js';

// Copilot
export {
  GITHUB_COPILOT_OAUTH_CLIENT_ID,
  requestCopilotDeviceCode,
  pollCopilotDeviceToken,
  getCopilotOAuthStatus,
  setCopilotOAuthTokens,
  clearCopilotOAuth,
} from './copilot/index.js';
export type {
  CopilotDeviceCodeResponse,
  CopilotTokenResponse,
  CopilotOAuthStatus,
  CopilotAuthEntry,
} from './copilot/index.js';
