// ============================================================
// Settings domain types — application settings, provider
// configurations, connected providers, and theme/language.
// ============================================================

import type { ProviderType } from './provider.types.js';
import type {
  OllamaConfig,
  LiteLLMConfig,
  LMStudioConfig,
  HuggingFaceLocalConfig,
  AzureFoundryConfig,
  NimConfig,
} from './provider.types.js';
import type { SandboxConfig } from './sandbox.types.js';
import type { CloudBrowserConfig } from './cloud-browser.types.js';
import type { FolderIndexingConfig } from './folder-indexing.types.js';
import type { MessagingIntegrationConfig } from './messaging.types.js';

// ---- Provider identity for settings ----

export type ProviderId = ProviderType | (string & {});

export type ProviderCategory = 'cloud' | 'local' | 'enterprise' | 'free';

// ---- Provider metadata registry ----

export interface ProviderMeta {
  id: ProviderId;
  category: ProviderCategory;
  label: string;
  description: string;
  requiresApiKey: boolean;
  hasFreeTier: boolean;
  icon?: string;
}

export const PROVIDER_META: Record<string, ProviderMeta> = {
  anthropic: {
    id: 'anthropic',
    category: 'cloud',
    label: 'Anthropic',
    description: 'Claude models via Anthropic API',
    requiresApiKey: true,
    hasFreeTier: false,
  },
  openai: {
    id: 'openai',
    category: 'cloud',
    label: 'OpenAI',
    description: 'GPT models via OpenAI API',
    requiresApiKey: true,
    hasFreeTier: false,
  },
  openrouter: {
    id: 'openrouter',
    category: 'cloud',
    label: 'OpenRouter',
    description: 'Multi-provider routing via OpenRouter',
    requiresApiKey: true,
    hasFreeTier: true,
  },
  google: {
    id: 'google',
    category: 'cloud',
    label: 'Google AI',
    description: 'Gemini models via Google AI',
    requiresApiKey: true,
    hasFreeTier: true,
  },
  deepseek: {
    id: 'deepseek',
    category: 'cloud',
    label: 'DeepSeek',
    description: 'DeepSeek models',
    requiresApiKey: true,
    hasFreeTier: false,
  },
  xai: {
    id: 'xai',
    category: 'cloud',
    label: 'xAI',
    description: 'Grok models via xAI API',
    requiresApiKey: true,
    hasFreeTier: false,
  },
  ollama: {
    id: 'ollama',
    category: 'local',
    label: 'Ollama',
    description: 'Local models via Ollama',
    requiresApiKey: false,
    hasFreeTier: true,
  },
  bedrock: {
    id: 'bedrock',
    category: 'enterprise',
    label: 'Amazon Bedrock',
    description: 'AWS-managed foundation models',
    requiresApiKey: false,
    hasFreeTier: false,
  },
  vertex: {
    id: 'vertex',
    category: 'enterprise',
    label: 'Google Vertex AI',
    description: 'GCP-managed foundation models',
    requiresApiKey: false,
    hasFreeTier: false,
  },
  litellm: {
    id: 'litellm',
    category: 'local',
    label: 'LiteLLM',
    description: 'Local proxy for multiple providers',
    requiresApiKey: false,
    hasFreeTier: true,
  },
  lmstudio: {
    id: 'lmstudio',
    category: 'local',
    label: 'LM Studio',
    description: 'Local LLM runtime',
    requiresApiKey: false,
    hasFreeTier: true,
  },
  huggingface_local: {
    id: 'huggingface-local',
    category: 'local',
    label: 'HuggingFace Local',
    description: 'Local inference via ONNX',
    requiresApiKey: false,
    hasFreeTier: true,
  },
  azure_foundry: {
    id: 'azure-foundry',
    category: 'enterprise',
    label: 'Azure Foundry',
    description: 'Azure AI Foundry models',
    requiresApiKey: false,
    hasFreeTier: false,
  },
  nim: {
    id: 'nim',
    category: 'local',
    label: 'NVIDIA NIM',
    description: 'NVIDIA NIM microservices',
    requiresApiKey: true,
    hasFreeTier: false,
  },
  copilot: {
    id: 'copilot',
    category: 'free',
    label: 'GitHub Copilot',
    description: 'Free via GitHub Copilot subscription',
    requiresApiKey: false,
    hasFreeTier: true,
  },
  'nestcafe-ai': {
    id: 'nestcafe-ai',
    category: 'free',
    label: 'Accomplish AI',
    description: 'Free AI tier from Accomplish',
    requiresApiKey: false,
    hasFreeTier: true,
  },
  moonshot: {
    id: 'moonshot',
    category: 'cloud',
    label: 'Moonshot AI',
    description: 'Kimi models via Moonshot API',
    requiresApiKey: true,
    hasFreeTier: false,
  },
  zai: {
    id: 'zai',
    category: 'cloud',
    label: 'Z.AI',
    description: 'GLM models from Zhipu AI',
    requiresApiKey: true,
    hasFreeTier: false,
  },
  minimax: {
    id: 'minimax',
    category: 'cloud',
    label: 'MiniMax',
    description: 'MiniMax models',
    requiresApiKey: true,
    hasFreeTier: false,
  },
  nebius: {
    id: 'nebius',
    category: 'cloud',
    label: 'Nebius AI',
    description: 'Open-weight models via Nebius',
    requiresApiKey: true,
    hasFreeTier: false,
  },
  together: {
    id: 'together',
    category: 'cloud',
    label: 'Together AI',
    description: 'Open-weight models via Together',
    requiresApiKey: true,
    hasFreeTier: false,
  },
  fireworks: {
    id: 'fireworks',
    category: 'cloud',
    label: 'Fireworks AI',
    description: 'Fast inference via Fireworks',
    requiresApiKey: true,
    hasFreeTier: false,
  },
  groq: {
    id: 'groq',
    category: 'cloud',
    label: 'Groq',
    description: 'Fast inference via Groq LPUs',
    requiresApiKey: true,
    hasFreeTier: true,
  },
  venice: {
    id: 'venice',
    category: 'cloud',
    label: 'Venice AI',
    description: 'Uncensored models via Venice',
    requiresApiKey: true,
    hasFreeTier: false,
  },
  perplexity: {
    id: 'perplexity',
    category: 'cloud',
    label: 'Perplexity',
    description: 'Search-augmented models',
    requiresApiKey: true,
    hasFreeTier: false,
  },
  'qwen-china': {
    id: 'qwen-china',
    category: 'cloud',
    label: 'Qwen (China)',
    description: 'Qwen models via DashScope China',
    requiresApiKey: true,
    hasFreeTier: false,
  },
  'qwen-international': {
    id: 'qwen-international',
    category: 'cloud',
    label: 'Qwen (Intl)',
    description: 'Qwen models via DashScope Intl',
    requiresApiKey: true,
    hasFreeTier: false,
  },
  xiaomi: {
    id: 'xiaomi',
    category: 'cloud',
    label: 'Xiaomi',
    description: 'Xiaomi MiMo models',
    requiresApiKey: true,
    hasFreeTier: false,
  },
  'xiaomi-token': {
    id: 'xiaomi-token',
    category: 'cloud',
    label: 'Xiaomi Token',
    description: 'Xiaomi MiMo token plan',
    requiresApiKey: true,
    hasFreeTier: false,
  },
};

// ---- Connection state ----

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type ToolSupportStatus = 'supported' | 'unsupported' | 'unknown';

// ---- Provider credentials (discriminated union) ----

export interface ApiKeyCredentials {
  type: 'api-key';
  providerId: ProviderId;
  key: string;
}

export interface BedrockProviderCredentials {
  type: 'bedrock';
  providerId: 'bedrock';
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

export interface OllamaCredentials {
  type: 'ollama';
  providerId: 'ollama';
  baseUrl: string;
}

export interface OpenRouterCredentials {
  type: 'openrouter';
  providerId: 'openrouter';
  key: string;
}

export interface LiteLLMCredentials {
  type: 'litellm';
  providerId: 'litellm';
  baseUrl: string;
  key?: string;
}

export interface LMStudioCredentials {
  type: 'lmstudio';
  providerId: 'lmstudio';
  baseUrl: string;
}

export interface VertexProviderCredentials {
  type: 'vertex';
  providerId: 'vertex';
  projectId: string;
  location?: string;
}

export interface AzureFoundryCredentials {
  type: 'azure-foundry';
  providerId: 'azure-foundry';
  endpoint: string;
  deploymentName: string;
  key?: string;
}

export interface OAuthCredentials {
  type: 'oauth';
  providerId: 'copilot';
  accessToken: string;
  refreshToken?: string;
}

export type ProviderCredentials =
  | ApiKeyCredentials
  | BedrockProviderCredentials
  | OllamaCredentials
  | OpenRouterCredentials
  | LiteLLMCredentials
  | LMStudioCredentials
  | VertexProviderCredentials
  | AzureFoundryCredentials
  | OAuthCredentials;

// ---- Connected provider ----

export interface ConnectedProvider {
  providerId: ProviderId;
  status: ConnectionStatus;
  connectedAt?: string;
  lastValidated?: number;
  selectedModel?: string;
  credentials?: ProviderCredentials;
}

// ---- Full settings snapshot ----

export interface SettingsSnapshot {
  theme: 'light' | 'dark' | 'system';
  language: string;
  debugMode: boolean;
  onboardingCompleted: boolean;
  selectedModel?: string;
  activeProvider?: ProviderId;
  connectedProviders: ConnectedProvider[];

  // Provider-specific sub-configs
  ollama?: OllamaConfig;
  litellm?: LiteLLMConfig;
  lmstudio?: LMStudioConfig;
  huggingfaceLocal?: HuggingFaceLocalConfig;
  azureFoundry?: AzureFoundryConfig;
  nim?: NimConfig;

  // Feature configs
  sandbox: SandboxConfig;
  cloudBrowser: CloudBrowserConfig;
  folderIndexing: FolderIndexingConfig;
  messaging: MessagingIntegrationConfig[];

  // UI preferences
  closeBehavior: 'keep-daemon' | 'stop-daemon' | 'ask';
  autoUpdate: boolean;
  notifications: boolean;
}

export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'anthropic/claude-opus-4-5',
  openai: 'openai/gpt-5.2',
  google: 'google/gemini-3-pro-preview',
};

export const PROVIDER_ID_TO_OPENCODE: Record<string, string> = {
  anthropic: 'anthropic',
  openai: 'openai',
  openrouter: 'openrouter',
  google: 'google',
  xai: 'xai',
  deepseek: 'deepseek',
  moonshot: 'moonshot',
  zai: 'zai',
  minimax: 'minimax',
  nebius: 'nebius',
  together: 'together',
  fireworks: 'fireworks',
  groq: 'groq',
  venice: 'venice',
  ollama: 'ollama',
  lmstudio: 'lmstudio',
  litellm: 'litellm',
  bedrock: 'bedrock',
  vertex: 'vertex',
  'azure-foundry': 'azure-foundry',
  nim: 'nim',
  copilot: 'copilot',
  'nestcafe-ai': 'nestcafe-ai',
  'qwen-china': 'qwen-china',
  'qwen-international': 'qwen-international',
  xiaomi: 'xiaomi',
  'xiaomi-token': 'xiaomi-token',
  perplexity: 'perplexity',
};
