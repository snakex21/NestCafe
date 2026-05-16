import { ipcRenderer } from 'electron';

export const providerApi = {
  hasApiKey: (): Promise<boolean> => ipcRenderer.invoke('api-key:exists'),
  setApiKey: (key: string): Promise<void> => ipcRenderer.invoke('api-key:set', key),
  getApiKey: (): Promise<string | null> => ipcRenderer.invoke('api-key:get'),
  validateApiKey: (key: string): Promise<{ valid: boolean; error?: string }> =>
    ipcRenderer.invoke('api-key:validate', key),
  validateApiKeyForProvider: (
    provider: string,
    key: string,
    options?: Record<string, unknown>,
  ): Promise<{ valid: boolean; error?: string }> =>
    ipcRenderer.invoke('api-key:validate-provider', provider, key, options),
  clearApiKey: (): Promise<void> => ipcRenderer.invoke('api-key:clear'),
  getAllApiKeys: (): Promise<Record<string, { exists: boolean; prefix?: string }>> =>
    ipcRenderer.invoke('api-keys:all'),
  hasAnyApiKey: (): Promise<boolean> => ipcRenderer.invoke('api-keys:has-any'),
  getSelectedModel: (): Promise<{
    provider: string;
    model: string;
    baseUrl?: string;
    deploymentName?: string;
  } | null> => ipcRenderer.invoke('model:get'),
  setSelectedModel: (model: {
    provider: string;
    model: string;
    baseUrl?: string;
    deploymentName?: string;
  }): Promise<void> => ipcRenderer.invoke('model:set', model),
  fetchProviderModels: (
    providerId: string,
    options?: { baseUrl?: string; zaiRegion?: string },
  ): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string }>;
    error?: string;
  }> => ipcRenderer.invoke('provider:fetch-models', providerId, options),
  fetchOpenRouterModels: (): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; provider: string; contextLength: number }>;
    error?: string;
  }> => ipcRenderer.invoke('openrouter:fetch-models'),
  testOllamaConnection: (
    url: string,
  ): Promise<{
    success: boolean;
    models?: Array<{
      id: string;
      displayName: string;
      size: number;
      toolSupport?: 'supported' | 'unsupported' | 'unknown';
    }>;
    error?: string;
  }> => ipcRenderer.invoke('ollama:test-connection', url),
  getOllamaConfig: (): Promise<{
    baseUrl: string;
    enabled: boolean;
    lastValidated?: number;
    models?: Array<{
      id: string;
      displayName: string;
      size: number;
      toolSupport?: 'supported' | 'unsupported' | 'unknown';
    }>;
  } | null> => ipcRenderer.invoke('ollama:get-config'),
  setOllamaConfig: (
    config: {
      baseUrl: string;
      enabled: boolean;
      lastValidated?: number;
      models?: Array<{
        id: string;
        displayName: string;
        size: number;
        toolSupport?: 'supported' | 'unsupported' | 'unknown';
      }>;
    } | null,
  ): Promise<void> => ipcRenderer.invoke('ollama:set-config', config),
  getAzureFoundryConfig: (): Promise<{
    baseUrl: string;
    deploymentName: string;
    authType: 'api-key' | 'entra-id';
    enabled: boolean;
    lastValidated?: number;
  } | null> => ipcRenderer.invoke('azure-foundry:get-config'),
  setAzureFoundryConfig: (
    config: {
      baseUrl: string;
      deploymentName: string;
      authType: 'api-key' | 'entra-id';
      enabled: boolean;
      lastValidated?: number;
    } | null,
  ): Promise<void> => ipcRenderer.invoke('azure-foundry:set-config', config),
  testAzureFoundryConnection: (config: {
    endpoint: string;
    deploymentName: string;
    authType: 'api-key' | 'entra-id';
    apiKey?: string;
  }): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('azure-foundry:test-connection', config),
  saveAzureFoundryConfig: (config: {
    endpoint: string;
    deploymentName: string;
    authType: 'api-key' | 'entra-id';
    apiKey?: string;
  }): Promise<void> => ipcRenderer.invoke('azure-foundry:save-config', config),
  testLiteLLMConnection: (
    url: string,
    apiKey?: string,
  ): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; provider: string; contextLength: number }>;
    error?: string;
  }> => ipcRenderer.invoke('litellm:test-connection', url, apiKey),
  fetchLiteLLMModels: (): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; provider: string; contextLength: number }>;
    error?: string;
  }> => ipcRenderer.invoke('litellm:fetch-models'),
  getLiteLLMConfig: (): Promise<{
    baseUrl: string;
    enabled: boolean;
    lastValidated?: number;
    models?: Array<{ id: string; name: string; provider: string; contextLength: number }>;
  } | null> => ipcRenderer.invoke('litellm:get-config'),
  setLiteLLMConfig: (
    config: {
      baseUrl: string;
      enabled: boolean;
      lastValidated?: number;
      models?: Array<{ id: string; name: string; provider: string; contextLength: number }>;
    } | null,
  ): Promise<void> => ipcRenderer.invoke('litellm:set-config', config),
  testLMStudioConnection: (
    url: string,
  ): Promise<{
    success: boolean;
    models?: Array<{
      id: string;
      name: string;
      toolSupport: 'supported' | 'unsupported' | 'unknown';
    }>;
    error?: string;
  }> => ipcRenderer.invoke('lmstudio:test-connection', url),
  fetchLMStudioModels: (): Promise<{
    success: boolean;
    models?: Array<{
      id: string;
      name: string;
      toolSupport: 'supported' | 'unsupported' | 'unknown';
    }>;
    error?: string;
  }> => ipcRenderer.invoke('lmstudio:fetch-models'),
  getLMStudioConfig: (): Promise<{
    baseUrl: string;
    enabled: boolean;
    lastValidated?: number;
    models?: Array<{
      id: string;
      name: string;
      toolSupport: 'supported' | 'unsupported' | 'unknown';
    }>;
  } | null> => ipcRenderer.invoke('lmstudio:get-config'),
  setLMStudioConfig: (
    config: {
      baseUrl: string;
      enabled: boolean;
      lastValidated?: number;
      models?: Array<{
        id: string;
        name: string;
        toolSupport: 'supported' | 'unsupported' | 'unknown';
      }>;
    } | null,
  ): Promise<void> => ipcRenderer.invoke('lmstudio:set-config', config),
  testNimConnection: (
    url: string,
    apiKey: string,
  ): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; provider: string; contextLength: number }>;
    error?: string;
  }> => ipcRenderer.invoke('nim:test-connection', url, apiKey),
  fetchNimModels: (): Promise<{
    success: boolean;
    models?: Array<{ id: string; name: string; provider: string; contextLength: number }>;
    error?: string;
  }> => ipcRenderer.invoke('nim:fetch-models'),
  testCustomConnection: (
    baseUrl: string,
    apiKey?: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('custom:test-connection', baseUrl, apiKey),
  validateBedrockCredentials: (credentials: string) =>
    ipcRenderer.invoke('bedrock:validate', credentials),
  saveBedrockCredentials: (credentials: string) => ipcRenderer.invoke('bedrock:save', credentials),
  getBedrockCredentials: () => ipcRenderer.invoke('bedrock:get-credentials'),
  fetchBedrockModels: (
    credentials: string,
  ): Promise<{
    success: boolean;
    models: Array<{ id: string; name: string; provider: string }>;
    error?: string;
  }> => ipcRenderer.invoke('bedrock:fetch-models', credentials),
  validateVertexCredentials: (credentials: string) =>
    ipcRenderer.invoke('vertex:validate', credentials),
  saveVertexCredentials: (credentials: string) => ipcRenderer.invoke('vertex:save', credentials),
  getVertexCredentials: () => ipcRenderer.invoke('vertex:get-credentials'),
  fetchVertexModels: (
    credentials: string,
  ): Promise<{
    success: boolean;
    models: Array<{ id: string; name: string; provider: string }>;
    error?: string;
  }> => ipcRenderer.invoke('vertex:fetch-models', credentials),
  detectVertexProject: (): Promise<{ success: boolean; projectId: string | null }> =>
    ipcRenderer.invoke('vertex:detect-project'),
  listVertexProjects: (): Promise<{
    success: boolean;
    projects: Array<{ projectId: string; name: string }>;
    error?: string;
  }> => ipcRenderer.invoke('vertex:list-projects'),
  getProviderSettings: (): Promise<unknown> => ipcRenderer.invoke('provider-settings:get'),
  setActiveProvider: (providerId: string | null): Promise<void> =>
    ipcRenderer.invoke('provider-settings:set-active', providerId),
  getConnectedProvider: (providerId: string): Promise<unknown> =>
    ipcRenderer.invoke('provider-settings:get-connected', providerId),
  setConnectedProvider: (providerId: string, provider: unknown): Promise<void> =>
    ipcRenderer.invoke('provider-settings:set-connected', providerId, provider),
  removeConnectedProvider: (providerId: string): Promise<void> =>
    ipcRenderer.invoke('provider-settings:remove-connected', providerId),
  updateProviderModel: (providerId: string, modelId: string | null): Promise<void> =>
    ipcRenderer.invoke('provider-settings:update-model', providerId, modelId),
  setProviderDebugMode: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('provider-settings:set-debug', enabled),
  getProviderDebugMode: (): Promise<boolean> => ipcRenderer.invoke('provider-settings:get-debug'),
};
