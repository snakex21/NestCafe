/** OpenAI-compatible and special provider config builders: NIM, Custom, OOAI-compatible cloud, GitHub Copilot. */
import { DEFAULT_PROVIDERS } from '../common/index.js';
import { createConsoleLogger } from '../utils/logging.js';
import { OPENAI_COMPATIBLE_PROVIDER_IDS } from './config-auth-sync.js';
import type { ProviderModelConfig } from './config-generator.js';
import type { ProviderBuildContext, ProviderBuildResult } from './config-provider-context.js';

const log = createConsoleLogger({ prefix: 'OpenCodeConfigBuilder' });

function buildCustomModelConfig(name: string, supportsTools: boolean): ProviderModelConfig {
  return {
    name,
    attachment: true,
    modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
    tool_call: supportsTools,
    tools: supportsTools,
  };
}

export function buildNimConfig(ctx: ProviderBuildContext): ProviderBuildResult {
  const { providerSettings, getApiKey } = ctx;
  const nimProvider = providerSettings.connectedProviders.nim;
  if (
    nimProvider?.connectionStatus !== 'connected' ||
    nimProvider.credentials.type !== 'nim' ||
    !nimProvider.selectedModelId
  ) {
    return { configs: [], enableToAdd: [] };
  }
  const nimApiKey = getApiKey('nim');
  const serverUrl = nimProvider.credentials.serverUrl;
  const modelId = nimProvider.selectedModelId.replace(/^nim\//, '');
  log.info(`[OpenCode Config Builder] NVIDIA NIM configured: ${modelId} baseURL: ${serverUrl}`);
  return {
    configs: [
      {
        id: 'nim',
        npm: '@ai-sdk/openai-compatible',
        name: 'NVIDIA NIM',
        options: {
          baseURL: serverUrl,
          ...(nimApiKey ? { apiKey: nimApiKey } : {}),
        },
        models: { [modelId]: { name: modelId, tools: true } },
      },
    ],
    enableToAdd: ['nim'],
  };
}

export function buildCustomConfig(ctx: ProviderBuildContext): ProviderBuildResult {
  const { providerSettings, getApiKey, activeModel } = ctx;
  const configs = [];
  const enableToAdd = [];
  let modelOverride: { model: string; smallModel: string } | undefined;

  for (const [providerId, customProvider] of Object.entries(providerSettings.connectedProviders)) {
    if (
      !(providerId === 'custom' || providerId.startsWith('custom:')) ||
      customProvider?.connectionStatus !== 'connected' ||
      customProvider.credentials.type !== 'custom' ||
      !customProvider.selectedModelId
    ) {
      continue;
    }

    const customApiKey = getApiKey(providerId as never);
    const creds = customProvider.credentials;
    const baseURL = creds.baseUrl.replace(/\/+$/, '');
    const modelId = customProvider.selectedModelId.replace(/^custom\//, '');
    const modelInfo = customProvider.availableModels?.find(
      (model) =>
        model.enabled !== false &&
        (model.id === customProvider.selectedModelId || model.id === modelId),
    );
    const supportsTools = modelInfo?.toolSupport !== 'unsupported';
    const configId =
      providerId === 'custom' ? 'custom' : providerId.replace(/[^a-zA-Z0-9_-]/g, '-');
    log.info(
      `[OpenCode Config Builder] Custom endpoint configured: ${modelId} baseURL: ${baseURL} tools: ${supportsTools}`,
    );
    configs.push({
      id: configId,
      npm: '@ai-sdk/openai-compatible',
      name: creds.displayName || 'Custom Endpoint',
      options: {
        baseURL,
        ...(customApiKey
          ? {
              apiKey: customApiKey,
              headers: { Authorization: `Bearer ${customApiKey}` },
            }
          : {}),
      },
      models: { [modelId]: buildCustomModelConfig(modelId, supportsTools) },
    });
    enableToAdd.push(configId);

    if (activeModel?.provider === providerId) {
      modelOverride = {
        model: `${configId}/${modelId}`,
        smallModel: `${configId}/${modelId}`,
      };
    }
  }

  return { configs, enableToAdd, modelOverride };
}

export function buildOpenAICompatibleConfigs(ctx: ProviderBuildContext): ProviderBuildResult {
  const { providerSettings, getApiKey } = ctx;
  const configs = [];
  for (const providerId of OPENAI_COMPATIBLE_PROVIDER_IDS) {
    const apiKey = getApiKey(providerId);
    if (!apiKey) {
      continue;
    }
    const providerDef = DEFAULT_PROVIDERS.find((p) => p.id === providerId);
    if (!providerDef?.modelsEndpoint) {
      log.warn(
        `[config-builder] Skipping provider "${providerId}": missing provider definition or modelsEndpoint`,
      );
      continue;
    }
    const baseURL = providerDef.baseUrl
      ? providerDef.baseUrl.replace(/\/$/, '')
      : providerDef.modelsEndpoint.url.replace(/\/models$/, '');
    const connectedProvider = providerSettings.connectedProviders[providerId];
    const models: Record<string, ProviderModelConfig> = {};
    if (connectedProvider?.availableModels && connectedProvider.availableModels.length > 0) {
      for (const model of connectedProvider.availableModels.filter(
        (item) => item.enabled !== false,
      )) {
        const prefix = `${providerId}/`;
        const modelId = model.id.startsWith(prefix) ? model.id.slice(prefix.length) : model.id;
        models[modelId] = { name: model.name, tools: true };
      }
    } else if (providerDef.models.length > 0) {
      for (const model of providerDef.models) {
        const prefix = `${providerId}/`;
        const modelId = model.id.startsWith(prefix) ? model.id.slice(prefix.length) : model.id;
        models[modelId] = { name: model.displayName, tools: true };
      }
    }
    if (Object.keys(models).length === 0 && providerDef.defaultModelId) {
      const prefix = `${providerId}/`;
      const modelId = providerDef.defaultModelId.startsWith(prefix)
        ? providerDef.defaultModelId.slice(prefix.length)
        : providerDef.defaultModelId;
      models[modelId] = { name: modelId, tools: true };
    }
    log.info(`[OpenCode Config Builder] ${providerDef.name} configured`);
    configs.push({
      id: providerId,
      npm: '@ai-sdk/openai-compatible',
      name: providerDef.name,
      options: { baseURL, apiKey },
      ...(Object.keys(models).length > 0 ? { models } : {}),
    });
  }
  return { configs, enableToAdd: [] };
}

export function buildCopilotConfig(ctx: ProviderBuildContext): ProviderBuildResult {
  const { providerSettings } = ctx;
  const copilotProvider = providerSettings.connectedProviders.copilot;
  if (
    copilotProvider?.connectionStatus !== 'connected' ||
    copilotProvider.credentials.type !== 'copilot-oauth'
  ) {
    return { configs: [], enableToAdd: [] };
  }
  const copilotModels: Record<string, ProviderModelConfig> = {};
  if (copilotProvider.availableModels && copilotProvider.availableModels.length > 0) {
    for (const model of copilotProvider.availableModels) {
      const modelId = model.id.replace(/^copilot\//, '');
      copilotModels[modelId] = { name: model.name, tools: true };
    }
  } else if (copilotProvider.selectedModelId) {
    const modelId = copilotProvider.selectedModelId.replace(/^copilot\//, '');
    copilotModels[modelId] = { name: modelId, tools: true };
  }
  log.info('[OpenCode Config Builder] GitHub Copilot configured');
  return {
    configs: [
      {
        id: 'github-copilot',
        npm: '@opencode/github-copilot',
        name: 'GitHub Copilot',
        options: {},
        ...(Object.keys(copilotModels).length > 0 ? { models: copilotModels } : {}),
      },
    ],
    enableToAdd: ['github-copilot'],
  };
}
