/**
 * Daemon RPC method registration and task event forwarding.
 * Extracted from index.ts to keep the entry point under 200 lines.
 *
 * NO electron imports — this runs as plain Node.js.
 */
import { DEFAULT_PROVIDERS } from '@nestcafe_ai/agent-core';
import {
  type DaemonRpcServer,
  taskConfigSchema,
} from '@nestcafe_ai/agent-core';
import type { NestcafeRuntime, StorageAPI } from '@nestcafe_ai/agent-core';
import { discoverModules, getDefaultModuleDirs } from '@nestcafe_ai/agent-core/modules/loader';
import { z } from 'zod';
import { homedir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { TaskService } from '../tasks/index.js';
import type { HealthService } from '../health.js';
import type { StorageService, SecretsService, SettingsService, WorkspaceService, ConnectorService, LegacyImportService } from '../storage/index.js';
import type { SchedulerService } from '../scheduler-service.js';
import type { WhatsAppDaemonService } from '../whatsapp-service.js';
import type { OpenAiOauthManager } from '../opencode/auth-openai.js';
import type { GoogleAccountService } from '../google-account-service.js';
import type { SkillsService } from '../skills-service.js';

const taskIdSchema = z.object({ taskId: z.string().min(1) });
const taskRerunFromMessageSchema = z.object({
  taskId: z.string().min(1),
  messageId: z.string().min(1),
  content: z.string().min(1),
  originalContent: z.string().optional(),
  autoApprovePermissions: z.boolean().optional(),
});
const taskStartSchema = taskConfigSchema;

function sanitizeErrorMessage(err: unknown): string {
  if (err instanceof z.ZodError) {
    return `Invalid parameters: ${err.issues.map((i) => i.message).join('; ')}`;
  }
  const msg = err instanceof Error ? err.message : 'Internal error';
  if (process.env.NODE_ENV === 'development') {
    return msg;
  }
  const home = homedir();
  const escapedHome = home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return msg.replace(new RegExp(`${escapedHome}(?:[\\\\/][^\\s:]*)?`, 'g'), '~/...');
}

export function safeHandler(
  fn: (params: unknown) => Promise<unknown>,
): (params: unknown) => Promise<unknown> {
  return async (params) => {
    try {
      return await fn(params);
    } catch (err) {
      throw new Error(sanitizeErrorMessage(err));
    }
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, '');
}

function extractChatCompletionText(data: unknown): string {
  const choice = (data as { choices?: Array<{ message?: Record<string, unknown> }> }).choices?.[0];
  const message = choice?.message;
  const content = message?.content;
  if (typeof content === 'string' && content.trim()) {
    return content;
  }
  const reasoningContent = message?.reasoning_content;
  if (typeof reasoningContent !== 'string' || !reasoningContent.trim()) {
    return '';
  }
  const finalMarkers = [
    '```',
    'Final output:',
    'Final answer:',
    'Odpowiedź końcowa:',
    'I will output only the translated text with preserved line breaks as requested.',
  ];
  for (const marker of finalMarkers) {
    const index = reasoningContent.lastIndexOf(marker);
    if (index >= 0) {
      const candidate = reasoningContent.slice(index + marker.length).trim();
      if (candidate) {
        return candidate
          .replace(/^```[a-zA-Z]*\s*/u, '')
          .replace(/```$/u, '')
          .trim();
      }
    }
  }
  return reasoningContent.trim();
}

function withNoThink(prompt: string): string {
  return `/no_think\n${prompt}\n\nDo not write reasoning or analysis. Put the final answer in the message content.`;
}

function toOpenAiCompatibleBaseUrl(baseUrl: string): string {
  const clean = trimTrailingSlash(baseUrl);
  return /\/v\d+(?:beta)?$/u.test(clean) ? clean : `${clean}/v1`;
}

function getDefaultProviderBaseUrl(provider: string): string | undefined {
  const providerConfig = DEFAULT_PROVIDERS.find((item) => item.id === provider);
  if (providerConfig?.baseUrl) {
    return providerConfig.baseUrl;
  }
  if (providerConfig?.modelsEndpoint?.url.endsWith('/models')) {
    return providerConfig.modelsEndpoint.url.slice(0, -'/models'.length);
  }
  return undefined;
}

function stripProviderPrefix(provider: string, model: string): string {
  if (provider === 'bedrock') {
    return model;
  }
  const prefix = `${provider}/`;
  return model.startsWith(prefix) ? model.slice(prefix.length) : model;
}

export interface RouteServices {
  rpc: DaemonRpcServer;
  taskService: TaskService;
  healthService: HealthService;
  storageService: StorageService;
  schedulerService: SchedulerService;
  NestcafeRuntime: NestcafeRuntime;
  whatsappService: WhatsAppDaemonService;
  openAiOauthManager: OpenAiOauthManager;
  secretsService: SecretsService;
  settingsService: SettingsService;
  workspaceService: WorkspaceService;
  connectorService: ConnectorService;
  legacyImportService: LegacyImportService;
  googleAccountService: GoogleAccountService;
  skillsService: SkillsService;
  resourcesPath?: string;
}

export function getModuleSearchDirs(storage: StorageAPI, resourcesPath?: string): string[] {
  const userDataPath = path.dirname(storage.getDatabasePath() || '');
  return getDefaultModuleDirs(process.cwd(), userDataPath, resourcesPath);
}

export function installDiscoveredModule(storage: StorageAPI, sourcePath: string) {
  const manifestPath = path.join(sourcePath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No manifest.json found at ${sourcePath}`);
  }
  let manifest: {
    name: string;
    entry: string;
    title?: string;
    version?: string;
    description?: string;
    icon?: string;
    permissions?: string[];
    mcpTools?: string[];
  };
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    throw new Error(`Invalid manifest.json at ${sourcePath}`);
  }
  if (!manifest.name || !manifest.entry) {
    throw new Error('manifest.json missing required fields: name, entry');
  }
  const entryPath = path.join(sourcePath, manifest.entry);
  if (!fs.existsSync(entryPath)) {
    throw new Error(`Module entry file not found: ${manifest.entry}`);
  }
  return storage.installModule(
    {
      name: manifest.name,
      title: manifest.title || manifest.name,
      version: manifest.version || '0.0.0',
      description: manifest.description || '',
      icon: manifest.icon || 'box',
      entry: manifest.entry,
      permissions: manifest.permissions || [],
      mcpTools: manifest.mcpTools || [],
    },
    sourcePath,
    entryPath,
  );
}

export function ensureBundledModulesInstalled(storage: StorageAPI, resourcesPath?: string): void {
  const discovered = discoverModules(getModuleSearchDirs(storage, resourcesPath));
  for (const item of discovered) {
    if (!storage.getModuleByName(item.manifest.name)) {
      installDiscoveredModule(storage, item.sourcePath);
    }
  }
}

export const MAX_OCR_SETTINGS_RPC_BYTES = 2 * 1024 * 1024;
export const MAX_OCR_HISTORY_TEXT_CHARS = 250_000;

export function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

export function truncateOcrHistoryText(text: string): string {
  if (text.length <= MAX_OCR_HISTORY_TEXT_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_OCR_HISTORY_TEXT_CHARS)}\n\n[Historia OCR została skrócona do podglądu.]`;
}

export function sanitizeOcrSettingsForRpc(
  settings: Record<string, string>,
  storage: StorageAPI,
  moduleId: string,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (settings.model) {
    result.model = settings.model;
  }
  if (settings.lang) {
    result.lang = settings.lang;
  }
  let totalBytes = byteLength(JSON.stringify(result));
  const docs = Object.entries(settings)
    .filter(([key, value]) => key.startsWith('doc_') && value)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 20);
  for (const [key, value] of docs) {
    try {
      const parsed = JSON.parse(value) as {
        image?: string;
        name?: string;
        preview?: string;
        text?: string;
      };
      if (!parsed.name || !parsed.text) {
        continue;
      }
      if (parsed.image) {
        delete parsed.image;
        const sanitized = JSON.stringify(parsed);
        storage.setModuleSetting(moduleId, key, sanitized);
      }
      parsed.text = truncateOcrHistoryText(parsed.text);
      const rpcValue = JSON.stringify(parsed);
      const entryBytes = byteLength(key) + byteLength(rpcValue) + 8;
      if (totalBytes + entryBytes > MAX_OCR_SETTINGS_RPC_BYTES) {
        break;
      }
      result[key] = rpcValue;
      totalBytes += entryBytes;
    } catch {
      continue;
    }
  }
  return result;
}

export { taskIdSchema, taskRerunFromMessageSchema, taskStartSchema };
export { trimTrailingSlash, extractChatCompletionText, withNoThink, toOpenAiCompatibleBaseUrl, getDefaultProviderBaseUrl, stripProviderPrefix };

const providerIdSchema = z
  .string()
  .min(1)
  .describe('ProviderId — any value of the ProviderId type literal');
export { providerIdSchema };

import { registerTaskRoutes } from './task-routes.js';
import { registerSchedulerRoutes } from './scheduler-routes.js';
import { registerWhatsappDaemonRoutes } from './whatsapp-daemon-routes.js';
import { registerAuthRoutes } from './auth-routes.js';
import { registerSecretsRoutes } from './secrets-routes.js';
import { registerSettingsRoutes } from './settings-routes.js';
import { registerWorkspaceRoutes } from './workspace-routes.js';
import { registerFavoritesRoutes } from './favorites-routes.js';
import { registerConnectorRoutes } from './connector-routes.js';
import { registerSystemRoutes } from './system-routes.js';
import { registerGwsRoutes } from './gws-routes.js';
import { registerSkillsRoutes } from './skills-routes.js';
import { registerMemoryRoutes } from './memory-routes.js';
import { registerVisionRoutes } from './vision-routes.js';
import { registerModuleRoutes } from './module-routes.js';

export function registerRpcMethods(services: RouteServices): void {
  const {
    rpc,
    taskService,
    healthService,
    storageService,
    schedulerService,
    NestcafeRuntime,
    whatsappService,
    openAiOauthManager,
    secretsService,
    settingsService,
    workspaceService,
    connectorService,
    legacyImportService,
    googleAccountService,
    skillsService,
    resourcesPath,
  } = services;
  const storage = storageService.getStorage();

  registerTaskRoutes({ rpc, taskService, healthService, storage });
  registerSchedulerRoutes({ rpc, schedulerService });
  registerWhatsappDaemonRoutes({ rpc, whatsappService });
  registerAuthRoutes({ rpc, openAiOauthManager });
  registerSecretsRoutes({ rpc, secretsService });
  registerSettingsRoutes({ rpc, settingsService });
  registerWorkspaceRoutes({ rpc, workspaceService });
  registerFavoritesRoutes({ rpc, storage });
  registerConnectorRoutes({ rpc, connectorService });
  registerSystemRoutes({ rpc, storage, legacyImportService });
  registerGwsRoutes({ rpc, googleAccountService });
  registerSkillsRoutes({ rpc, skillsService });
  registerMemoryRoutes({ rpc });
  registerVisionRoutes({ rpc, storage });
  registerModuleRoutes({ rpc, storage, storageService, resourcesPath });
}

export function registerTaskEventForwarding(services: RouteServices): void {
  const { rpc, taskService, healthService, whatsappService } = services;

  taskService.on('progress', (data) => {
    rpc.notify('task.progress', data);
  });
  taskService.on('message', (data) => {
    rpc.notify('task.message', data);
  });
  taskService.on('complete', (data: { taskId: string; result: unknown }) => {
    rpc.notify('task.complete', data);
  });
  taskService.on('error', (data: { taskId: string }) => {
    rpc.notify('task.error', data);
  });
  taskService.on('permission', (data) => {
    rpc.notify('permission.request', data);
  });
  taskService.on('statusChange', (data: { taskId: string; status: string }) => {
    healthService.setActiveTaskCount(taskService.getActiveTaskCount());
    rpc.notify('task.statusChange', data);
  });
  taskService.on('summary', (data: { taskId: string; summary: string }) => {
    rpc.notify('task.summary', data);
  });
  taskService.on('todo:update', (data: { taskId: string; todos: unknown[] }) => {
    rpc.notify('todo.update', data);
  });
  taskService.on('auth:error', (data: { taskId: string; providerId: string; message: string }) => {
    rpc.notify('auth.error', data);
  });
  taskService.on('browser:frame', (data: { taskId: string; [key: string]: unknown }) => {
    rpc.notify('browser.frame', data);
  });
  taskService.on(
    'stepFinish',
    (data: { taskId: string; tokens?: { input: number; output: number; reasoning: number } }) => {
      rpc.notify('task.stepFinish', data);
    },
  );
  whatsappService.on('qr', (qr: string) => {
    rpc.notify('whatsapp.qr', { qr });
  });
  whatsappService.on('status', (status: string) => {
    rpc.notify('whatsapp.status', { status });
  });
}
