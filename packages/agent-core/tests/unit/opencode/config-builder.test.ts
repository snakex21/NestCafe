import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildProviderConfigs } from '../../../src/opencode/config-builder.js';

// Mock storage repositories so the test doesn't hit the DB
vi.mock('../../../src/storage/repositories/index.js', () => ({
  getOllamaConfig: () => null,
  getLMStudioConfig: () => null,
  getProviderSettings: () => ({
    connectedProviders: {},
  }),
  getActiveProviderModel: () => null,
  getConnectedProviderIds: () => [],
  getActiveProviderId: () => null,
  getConnectedProvider: () => null,
  getSelectedModel: () => null,
  getAzureFoundryConfig: () => null,
}));

// Mock proxy helpers
vi.mock('../../../src/opencode/proxies/index.js', () => ({
  ensureAzureFoundryProxy: vi.fn().mockResolvedValue({ baseURL: 'http://proxy' }),
  ensureMoonshotProxy: vi.fn().mockResolvedValue({ baseURL: 'http://proxy' }),
}));

describe('buildProviderConfigs', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Google AI provider', () => {
    it('does not enable OpenAI when another provider is selected', async () => {
      const result = await buildProviderConfigs({
        getApiKey: (p) => (p === 'google' ? 'test-google-api-key' : undefined),
        providerSettings: {
          activeProviderId: 'google',
          connectedProviders: {
            google: {
              providerId: 'google',
              connectionStatus: 'connected',
              selectedModelId: 'google/gemini-3-pro-preview',
              credentials: { type: 'google' },
              availableModels: [],
            },
          },
        } as never,
      });

      expect(result.enabledProviders).not.toContain('openai');
      expect(result.modelOverride).toEqual({
        model: 'google/gemini-3-pro-preview',
        smallModel: 'google/gemini-3-pro-preview',
      });
    });

    it('enables OpenAI only when OpenAI is connected or keyed', async () => {
      const result = await buildProviderConfigs({
        getApiKey: (p) => (p === 'openai' ? 'sk-openai' : undefined),
        providerSettings: {
          connectedProviders: {},
        } as never,
      });

      expect(result.enabledProviders).toContain('openai');
    });

    it('uses a non-OpenAI ready provider when no active provider is set', async () => {
      const result = await buildProviderConfigs({
        getApiKey: (p) => {
          if (p === 'google') {
            return 'test-google-api-key';
          }
          if (p === 'openai') {
            return 'sk-openai';
          }
          return undefined;
        },
        providerSettings: {
          activeProviderId: null,
          connectedProviders: {
            openai: {
              providerId: 'openai',
              connectionStatus: 'connected',
              selectedModelId: 'openai/gpt-5.2',
              credentials: { type: 'api-key' },
              availableModels: [],
            },
            google: {
              providerId: 'google',
              connectionStatus: 'connected',
              selectedModelId: 'google/gemini-3-pro-preview',
              credentials: { type: 'google' },
              availableModels: [],
            },
          },
        } as never,
      });

      expect(result.modelOverride).toEqual({
        model: 'google/gemini-3-pro-preview',
        smallModel: 'google/gemini-3-pro-preview',
      });
    });

    it('registers the selected Google model so OpenCode can resolve it', async () => {
      const result = await buildProviderConfigs({
        getApiKey: (p) => (p === 'google' ? 'test-google-api-key' : undefined),
        providerSettings: {
          connectedProviders: {
            google: {
              providerId: 'google',
              connectionStatus: 'connected',
              selectedModelId: 'google/gemini-3.1-flash-lite-preview',
              credentials: { type: 'google' },
              availableModels: [
                {
                  id: 'google/gemini-3.1-flash-lite-preview',
                  name: 'Gemini 3.1 Flash Lite Preview',
                },
                { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro' },
              ],
            },
          },
        } as never,
      });

      const googleConfig = result.providerConfigs.find((p) => p.id === 'google');
      expect(googleConfig).toBeDefined();
      expect(googleConfig?.models).toBeDefined();
      expect(googleConfig?.models?.['gemini-3.1-flash-lite-preview']).toBeDefined();
      expect(googleConfig?.models?.['gemini-3-pro-preview']).toBeDefined();
      expect(result.modelOverride).toEqual({
        model: 'google/gemini-3.1-flash-lite-preview',
        smallModel: 'google/gemini-3.1-flash-lite-preview',
      });
    });

    it('falls back to registering only the selected model when availableModels is empty', async () => {
      const result = await buildProviderConfigs({
        getApiKey: (p) => (p === 'google' ? 'test-google-api-key' : undefined),
        providerSettings: {
          connectedProviders: {
            google: {
              providerId: 'google',
              connectionStatus: 'connected',
              selectedModelId: 'google/gemini-3.1-flash-lite-preview',
              credentials: { type: 'google' },
              availableModels: [],
            },
          },
        } as never,
      });

      const googleConfig = result.providerConfigs.find((p) => p.id === 'google');
      expect(googleConfig).toBeDefined();
      expect(googleConfig?.models?.['gemini-3.1-flash-lite-preview']).toBeDefined();
    });

    it('falls back to registering only the selected model when availableModels is undefined', async () => {
      const result = await buildProviderConfigs({
        getApiKey: (p) => (p === 'google' ? 'test-google-api-key' : undefined),
        providerSettings: {
          connectedProviders: {
            google: {
              providerId: 'google',
              connectionStatus: 'connected',
              selectedModelId: 'google/gemini-3.1-flash-lite-preview',
              credentials: { type: 'google' },
            },
          },
        } as never,
      });

      const googleConfig = result.providerConfigs.find((p) => p.id === 'google');
      expect(googleConfig).toBeDefined();
      expect(googleConfig?.models?.['gemini-3.1-flash-lite-preview']).toBeDefined();
    });

    it('does not push google providerConfig when no API key is set', async () => {
      const result = await buildProviderConfigs({
        getApiKey: () => undefined,
        providerSettings: {
          connectedProviders: {
            google: {
              providerId: 'google',
              connectionStatus: 'connected',
              selectedModelId: 'google/gemini-3-pro-preview',
              credentials: { type: 'google' },
              availableModels: [],
            },
          },
        } as never,
      });

      const googleConfig = result.providerConfigs.find((p) => p.id === 'google');
      expect(googleConfig).toBeUndefined();
    });
  });

  describe('custom providers', () => {
    it('marks custom models as attachment-capable so OpenCode forwards image parts', async () => {
      const result = await buildProviderConfigs({
        getApiKey: (p) => (p === 'custom:morlrwc6' ? 'sk-custom' : undefined),
        providerSettings: {
          connectedProviders: {
            'custom:morlrwc6': {
              providerId: 'custom:morlrwc6',
              connectionStatus: 'connected',
              selectedModelId: 'custom/MiniMax-M2.7-highspeed',
              credentials: {
                type: 'custom',
                baseUrl: 'https://www.minimaxi.com/v1/',
                displayName: 'MiniMax',
              },
              availableModels: [
                {
                  id: 'custom/MiniMax-M2.7-highspeed',
                  name: 'MiniMax-M2.7-highspeed',
                  toolSupport: 'supported',
                },
              ],
            },
          },
        } as never,
      });

      const customConfig = result.providerConfigs.find((p) => p.id === 'custom-morlrwc6');
      const modelConfig = customConfig?.models?.['MiniMax-M2.7-highspeed'];
      expect(modelConfig).toMatchObject({
        name: 'MiniMax-M2.7-highspeed',
        attachment: true,
        tool_call: true,
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
      });
    });
  });

  describe('LM Studio provider', () => {
    it('marks LM Studio models as attachment-capable so local vision models receive images', async () => {
      const result = await buildProviderConfigs({
        getApiKey: () => undefined,
        providerSettings: {
          connectedProviders: {
            lmstudio: {
              providerId: 'lmstudio',
              connectionStatus: 'connected',
              selectedModelId: 'lmstudio/qwen3.6-35b-a3b',
              credentials: { type: 'lmstudio', serverUrl: 'http://localhost:1234' },
              availableModels: [
                {
                  id: 'lmstudio/qwen3.6-35b-a3b',
                  name: 'qwen3.6-35b-a3b',
                  toolSupport: 'supported',
                },
              ],
            },
          },
        } as never,
      });

      const lmStudioConfig = result.providerConfigs.find((p) => p.id === 'lmstudio');
      const modelConfig = lmStudioConfig?.models?.['qwen3.6-35b-a3b'];
      expect(modelConfig).toMatchObject({
        name: 'qwen3.6-35b-a3b',
        attachment: true,
        tool_call: true,
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
      });
      expect(result.modelOverride).toEqual({
        model: 'lmstudio/qwen3.6-35b-a3b',
        smallModel: 'lmstudio/qwen3.6-35b-a3b',
      });
    });
  });
});
