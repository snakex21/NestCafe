import { validate } from '@nestcafe_ai/agent-core';
import { z } from 'zod';
import { safeHandler, providerIdSchema } from './index.js';
import type { DaemonRpcServer } from '@nestcafe_ai/agent-core';
import type { SettingsService, SettingsChangePayload } from '../storage/index.js';

export function registerSettingsRoutes(services: {
  rpc: DaemonRpcServer;
  settingsService: SettingsService;
}): void {
  const { rpc, settingsService } = services;

  // ── Settings — app-level ─────────────────────────────────────────────────
  rpc.registerMethod(
    'settings.getAll',
    safeHandler(() => Promise.resolve(settingsService.getAll())),
  );
  rpc.registerMethod(
    'settings.setTheme',
    safeHandler((params) => {
      const v = validate(z.object({ theme: z.enum(['system', 'light', 'dark']) }), params);
      settingsService.setTheme(v.theme);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'settings.setLanguage',
    safeHandler((params) => {
      const v = validate(
        z.object({ language: z.enum(['auto', 'en', 'zh-CN', 'ru', 'fr', 'pl']) }),
        params,
      );
      settingsService.setLanguage(v.language);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'settings.setDebugMode',
    safeHandler((params) => {
      const v = validate(z.object({ enabled: z.boolean() }), params);
      settingsService.setDebugMode(v.enabled);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'settings.setNotificationsEnabled',
    safeHandler((params) => {
      const v = validate(z.object({ enabled: z.boolean() }), params);
      settingsService.setNotificationsEnabled(v.enabled);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'settings.getNotificationsEnabled',
    safeHandler(() => Promise.resolve(settingsService.getNotificationsEnabled())),
  );
  rpc.registerMethod(
    'settings.setCloseBehavior',
    safeHandler((params) => {
      const v = validate(z.object({ behavior: z.enum(['keep-daemon', 'stop-daemon']) }), params);
      settingsService.setCloseBehavior(v.behavior);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'settings.getCloseBehavior',
    safeHandler(() => Promise.resolve(settingsService.getCloseBehavior())),
  );
  // Sandbox / cloud-browser / messaging configs are typed objects; their
  // Zod schemas would duplicate the TypeScript types. Pass-through `.unknown()`
  // for the config payload and trust the type at the call site — misuse
  // surfaces as a StorageAPI-level error, not a silent no-op.
  rpc.registerMethod(
    'settings.setSandboxConfig',
    safeHandler((params) => {
      const v = validate(z.object({ config: z.unknown() }), params);
      settingsService.setSandboxConfig(
        v.config as Parameters<typeof settingsService.setSandboxConfig>[0],
      );
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'settings.getSandboxConfig',
    safeHandler(() => Promise.resolve(settingsService.getSandboxConfig())),
  );
  rpc.registerMethod(
    'settings.setCloudBrowserConfig',
    safeHandler((params) => {
      const v = validate(z.object({ config: z.unknown().nullable() }), params);
      settingsService.setCloudBrowserConfig(
        v.config as Parameters<typeof settingsService.setCloudBrowserConfig>[0],
      );
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'settings.getCloudBrowserConfig',
    safeHandler(() => Promise.resolve(settingsService.getCloudBrowserConfig())),
  );
  rpc.registerMethod(
    'settings.setMessagingConfig',
    safeHandler((params) => {
      const v = validate(z.object({ config: z.unknown().nullable() }), params);
      settingsService.setMessagingConfig(
        v.config as Parameters<typeof settingsService.setMessagingConfig>[0],
      );
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'settings.getMessagingConfig',
    safeHandler(() => Promise.resolve(settingsService.getMessagingConfig())),
  );
  rpc.registerMethod(
    'settings.setOnboardingComplete',
    safeHandler((params) => {
      const v = validate(z.object({ complete: z.boolean() }), params);
      settingsService.setOnboardingComplete(v.complete);
      return Promise.resolve();
    }),
  );

  // ── Selected model + provider configs (app-settings writers) ────────────
  // Typed config objects pass through as `z.unknown()` — the TS contract at
  // the `DaemonMethodMap` level is the source of truth for their shapes.
  rpc.registerMethod(
    'settings.getSelectedModel',
    safeHandler(() => Promise.resolve(settingsService.getSelectedModel())),
  );
  rpc.registerMethod(
    'settings.setSelectedModel',
    safeHandler((params) => {
      const v = validate(z.object({ model: z.unknown() }), params);
      settingsService.setSelectedModel(
        v.model as Parameters<typeof settingsService.setSelectedModel>[0],
      );
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'settings.getOpenAiBaseUrl',
    safeHandler(() => Promise.resolve(settingsService.getOpenAiBaseUrl())),
  );
  rpc.registerMethod(
    'settings.setOpenAiBaseUrl',
    safeHandler((params) => {
      const v = validate(z.object({ baseUrl: z.string() }), params);
      settingsService.setOpenAiBaseUrl(v.baseUrl);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'settings.getOllamaConfig',
    safeHandler(() => Promise.resolve(settingsService.getOllamaConfig())),
  );
  rpc.registerMethod(
    'settings.setOllamaConfig',
    safeHandler((params) => {
      const v = validate(z.object({ config: z.unknown().nullable() }), params);
      settingsService.setOllamaConfig(
        v.config as Parameters<typeof settingsService.setOllamaConfig>[0],
      );
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'settings.getLiteLLMConfig',
    safeHandler(() => Promise.resolve(settingsService.getLiteLLMConfig())),
  );
  rpc.registerMethod(
    'settings.setLiteLLMConfig',
    safeHandler((params) => {
      const v = validate(z.object({ config: z.unknown().nullable() }), params);
      settingsService.setLiteLLMConfig(
        v.config as Parameters<typeof settingsService.setLiteLLMConfig>[0],
      );
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'settings.getAzureFoundryConfig',
    safeHandler(() => Promise.resolve(settingsService.getAzureFoundryConfig())),
  );
  rpc.registerMethod(
    'settings.setAzureFoundryConfig',
    safeHandler((params) => {
      const v = validate(z.object({ config: z.unknown().nullable() }), params);
      settingsService.setAzureFoundryConfig(
        v.config as Parameters<typeof settingsService.setAzureFoundryConfig>[0],
      );
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'settings.getLMStudioConfig',
    safeHandler(() => Promise.resolve(settingsService.getLMStudioConfig())),
  );
  rpc.registerMethod(
    'settings.setLMStudioConfig',
    safeHandler((params) => {
      const v = validate(z.object({ config: z.unknown().nullable() }), params);
      settingsService.setLMStudioConfig(
        v.config as Parameters<typeof settingsService.setLMStudioConfig>[0],
      );
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'settings.getNimConfig',
    safeHandler(() => Promise.resolve(settingsService.getNimConfig())),
  );
  rpc.registerMethod(
    'settings.setNimConfig',
    safeHandler((params) => {
      const v = validate(z.object({ config: z.unknown().nullable() }), params);
      settingsService.setNimConfig(v.config as Parameters<typeof settingsService.setNimConfig>[0]);
      return Promise.resolve();
    }),
  );

  // ── Settings — update preferences ──────────────────────────────────────
  rpc.registerMethod(
    'settings.getUpdateAutoCheck',
    safeHandler(() => Promise.resolve(settingsService.getUpdateAutoCheck())),
  );
  rpc.registerMethod(
    'settings.setUpdateAutoCheck',
    safeHandler((params) => {
      const v = validate(z.object({ enabled: z.boolean() }), params);
      settingsService.setUpdateAutoCheck(v.enabled);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'settings.getUpdateAutoDownload',
    safeHandler(() => Promise.resolve(settingsService.getUpdateAutoDownload())),
  );
  rpc.registerMethod(
    'settings.setUpdateAutoDownload',
    safeHandler((params) => {
      const v = validate(z.object({ enabled: z.boolean() }), params);
      settingsService.setUpdateAutoDownload(v.enabled);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'settings.getUpdateAutoInstall',
    safeHandler(() => Promise.resolve(settingsService.getUpdateAutoInstall())),
  );
  rpc.registerMethod(
    'settings.setUpdateAutoInstall',
    safeHandler((params) => {
      const v = validate(z.object({ enabled: z.boolean() }), params);
      settingsService.setUpdateAutoInstall(v.enabled);
      return Promise.resolve();
    }),
  );

  // ── Folder indexing ─────────────────────────────────────────────────────
  rpc.registerMethod(
    'folderIndexing.getConfig',
    safeHandler(() => Promise.resolve(settingsService.getFolderIndexingConfig())),
  );
  rpc.registerMethod(
    'folderIndexing.setConfig',
    safeHandler((params) => {
      const v = validate(z.object({ config: z.unknown() }), params);
      settingsService.setFolderIndexingConfig(
        v.config as Parameters<typeof settingsService.setFolderIndexingConfig>[0],
      );
      return Promise.resolve();
    }),
  );

  // ── Settings — provider ──────────────────────────────────────────────────
  rpc.registerMethod(
    'provider.getSettings',
    safeHandler(() => Promise.resolve(settingsService.getProviderSettings())),
  );
  rpc.registerMethod(
    'provider.setActive',
    safeHandler((params) => {
      const v = validate(z.object({ providerId: providerIdSchema.nullable() }), params);
      settingsService.setActiveProvider(
        v.providerId as Parameters<typeof settingsService.setActiveProvider>[0],
      );
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'provider.setConnected',
    safeHandler((params) => {
      const v = validate(z.object({ providerId: providerIdSchema, provider: z.unknown() }), params);
      settingsService.setConnectedProvider(
        v.providerId as Parameters<typeof settingsService.setConnectedProvider>[0],
        v.provider as Parameters<typeof settingsService.setConnectedProvider>[1],
      );
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'provider.removeConnected',
    safeHandler((params) => {
      const v = validate(z.object({ providerId: providerIdSchema }), params);
      settingsService.removeConnectedProvider(
        v.providerId as Parameters<typeof settingsService.removeConnectedProvider>[0],
      );
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'provider.updateModel',
    safeHandler((params) => {
      const v = validate(
        z.object({ providerId: providerIdSchema, modelId: z.string().nullable() }),
        params,
      );
      settingsService.updateProviderModel(
        v.providerId as Parameters<typeof settingsService.updateProviderModel>[0],
        v.modelId,
      );
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'provider.setDebugMode',
    safeHandler((params) => {
      const v = validate(z.object({ enabled: z.boolean() }), params);
      settingsService.setProviderDebugMode(v.enabled);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'provider.getDebugMode',
    safeHandler(() => Promise.resolve(settingsService.getProviderDebugMode())),
  );
  rpc.registerMethod(
    'provider.getNestCafeAiCredits',
    safeHandler(() => Promise.resolve(settingsService.getNestCafeAiCredits())),
  );
  rpc.registerMethod(
    'provider.saveNestcafeAiCredits',
    safeHandler((params) => {
      const v = validate(z.object({ usage: z.unknown() }), params);
      settingsService.saveNestcafeAiCredits(
        v.usage as Parameters<typeof settingsService.saveNestcafeAiCredits>[0],
      );
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'provider.getHuggingFaceLocalConfig',
    safeHandler(() => Promise.resolve(settingsService.getHuggingFaceLocalConfig())),
  );
  rpc.registerMethod(
    'provider.setHuggingFaceLocalConfig',
    safeHandler((params) => {
      const v = validate(z.object({ config: z.unknown().nullable() }), params);
      settingsService.setHuggingFaceLocalConfig(
        v.config as Parameters<typeof settingsService.setHuggingFaceLocalConfig>[0],
      );
      return Promise.resolve();
    }),
  );

  // Forward settings.changed events to all connected clients.
  settingsService.on('settings.changed', (payload: SettingsChangePayload) => {
    rpc.notify('settings.changed', payload);
  });
}
