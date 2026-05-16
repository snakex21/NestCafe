// ============================================================
// Local providers barrel — Ollama, LM Studio, HuggingFace.
// ============================================================

export { testOllamaConnection } from './ollama.js';
export type { OllamaModel, OllamaConnectionResult } from './ollama.js';

export {
  testLMStudioConnection,
  validateLMStudioConfig,
  LMSTUDIO_REQUEST_TIMEOUT_MS,
} from './lmstudio.js';
export type { LMStudioModel, LMStudioConnectionResult } from './lmstudio.js';

export { LMSTUDIO_KNOWN_MODELS } from './lmstudio-models.js';

export {
  HF_LOCAL_DEFAULT_URL,
  HF_RECOMMENDED_MODELS,
  searchHuggingFaceHubModels,
  testHuggingFaceLocalConnection,
} from './huggingface-local.js';
export type { HuggingFaceHubModel } from './huggingface-local.js';
