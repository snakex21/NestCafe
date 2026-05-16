import { validate } from '@nestcafe_ai/agent-core';
import { z } from 'zod';
import {
  safeHandler,
  toOpenAiCompatibleBaseUrl,
  getDefaultProviderBaseUrl,
  stripProviderPrefix,
  withNoThink,
  extractChatCompletionText,
} from './index.js';
import type { DaemonRpcServer, StorageAPI } from '@nestcafe_ai/agent-core';

export function registerVisionRoutes(services: {
  rpc: DaemonRpcServer;
  storage: StorageAPI;
}): void {
  const { rpc, storage } = services;

  rpc.registerMethod(
    'vision.transcribe',
    safeHandler(async (params) => {
      const v = validate(
        z.object({
          imageBase64: z.string(),
          mimeType: z.string().optional(),
          prompt: z.string().optional(),
          providerId: z.string().optional(),
          modelId: z.string().optional(),
        }),
        params,
      );

      // Allow text-only mode (no image) for chat/correction use cases
      if (!v.imageBase64 && !v.prompt) {
        throw new Error('Either imageBase64 or prompt must be provided');
      }

      // Use explicitly provided model, or fall back to active model
      let provider: string;
      let model: string;
      let baseUrl: string | undefined;
      let apiKeyOptional = false;

      if (v.providerId && v.modelId) {
        provider = v.providerId;
        model = v.modelId;
        const providerSettings = storage.getConnectedProvider(provider as never);
        const credentials = providerSettings?.credentials;
        if (credentials?.type === 'lmstudio') {
          baseUrl = toOpenAiCompatibleBaseUrl(credentials.serverUrl);
          apiKeyOptional = true;
        } else if (credentials?.type === 'litellm') {
          baseUrl = toOpenAiCompatibleBaseUrl(credentials.serverUrl);
          apiKeyOptional = !credentials.hasApiKey;
        } else if (credentials?.type === 'custom') {
          baseUrl = providerSettings?.customBaseUrl || credentials.baseUrl;
          apiKeyOptional = !credentials.hasApiKey;
        } else if (credentials?.type === 'nim') {
          baseUrl = toOpenAiCompatibleBaseUrl(credentials.serverUrl);
        } else {
          baseUrl = providerSettings?.customBaseUrl || getDefaultProviderBaseUrl(provider);
        }
      } else {
        const activeModel = storage.getActiveProviderModel();
        if (!activeModel) {
          throw new Error('No active AI provider configured');
        }
        provider = activeModel.provider;
        model = activeModel.model;
        baseUrl = activeModel.baseUrl;
        const providerSettings = storage.getConnectedProvider(provider as never);
        const credentials = providerSettings?.credentials;
        if (credentials?.type === 'lmstudio') {
          baseUrl = toOpenAiCompatibleBaseUrl(credentials.serverUrl);
          apiKeyOptional = true;
        } else if (credentials?.type === 'litellm') {
          baseUrl = toOpenAiCompatibleBaseUrl(credentials.serverUrl);
          apiKeyOptional = !credentials.hasApiKey;
        } else if (credentials?.type === 'custom') {
          baseUrl = providerSettings?.customBaseUrl || credentials.baseUrl;
          apiKeyOptional = !credentials.hasApiKey;
        } else if (credentials?.type === 'nim') {
          baseUrl = toOpenAiCompatibleBaseUrl(credentials.serverUrl);
        } else {
          baseUrl =
            baseUrl || providerSettings?.customBaseUrl || getDefaultProviderBaseUrl(provider);
        }
      }

      const apiKey = storage.getApiKey(provider);
      if (!apiKey && !apiKeyOptional) {
        throw new Error(`No API key configured for ${provider}`);
      }

      const resolvedBaseUrl = baseUrl || 'https://api.openai.com/v1';
      const mime = v.mimeType || 'image/png';
      const userPrompt =
        v.prompt ||
        'Transcribe all text from this document image. Return ONLY the transcribed text, preserving line breaks and paragraphs.';

      // Build messages based on whether we have an image
      const userContent: Array<Record<string, unknown>> = [
        { type: 'text', text: withNoThink(userPrompt) },
      ];
      if (v.imageBase64) {
        userContent.push({
          type: 'image_url',
          image_url: { url: `data:${mime};base64,${v.imageBase64}` },
        });
      }

      const response = await fetch(`${resolvedBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: userContent.length === 1 ? userContent[0].text : userContent,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Vision API error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const text = extractChatCompletionText(data);
      return { text };
    }),
  );

  // Text-only AI completion (no image needed)
  rpc.registerMethod(
    'ai.complete',
    safeHandler(async (params) => {
      const v = validate(z.object({ prompt: z.string().min(1) }), params);
      const activeModel = storage.getActiveProviderModel();
      if (!activeModel) throw new Error('No active AI provider configured');
      const providerSettings = storage.getConnectedProvider(activeModel.provider as never);
      const credentials = providerSettings?.credentials;
      const apiKeyOptional =
        credentials?.type === 'lmstudio' ||
        credentials?.type === 'ollama' ||
        (credentials?.type === 'custom' && !credentials.hasApiKey);
      const apiKey = storage.getApiKey(activeModel.provider);
      if (!apiKey && !apiKeyOptional) throw new Error(`No API key for ${activeModel.provider}`);

      // Use the active provider's endpoint. Some provider rows do not persist
      // a custom base URL, so fall back to DEFAULT_PROVIDERS before OpenAI.
      const baseUrl =
        activeModel.baseUrl ||
        providerSettings?.customBaseUrl ||
        getDefaultProviderBaseUrl(activeModel.provider) ||
        'https://api.openai.com/v1';

      const modelId = stripProviderPrefix(activeModel.provider, activeModel.model);

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: withNoThink(v.prompt) }],
        }),
      });
      if (!response.ok) {
        const err = await response.text().catch(() => '');
        throw new Error(`AI API error ${response.status}: ${err.slice(0, 300)}`);
      }
      const data = await response.json();
      return { text: extractChatCompletionText(data) };
    }),
  );
}
