import { BrowserWindow, dialog } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import fs from 'fs/promises';
import { handle } from './utils';
import { getDaemonClient } from '../../daemon-bootstrap';
import type {
  CloudBrowserConfig,
  ConnectedProvider,
  FolderIndexingConfig,
  HuggingFaceLocalConfig,
  MessagingConfig,
  ProviderId,
} from '@nestcafe_ai/agent-core/common';
import type { NimConfig, SandboxConfig } from '@nestcafe_ai/agent-core';

interface BackupSectionOptions {
  settings: boolean;
  providers: boolean;
  apiKeys: boolean;
  workspaces: boolean;
  skills: boolean;
}

interface BackupFile {
  app: 'NestCafe';
  version: 1;
  exportedAt: string;
  sections: BackupSectionOptions;
  data: Record<string, unknown>;
}

const BACKUP_FILTERS = [{ name: 'NestCafe Backup', extensions: ['nestcafe-backup', 'json'] }];

function getWindow(event: IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getAllWindows()[0];
}

function showBackupSaveDialog(win: BrowserWindow | undefined) {
  const options = {
    title: 'Export NestCafe backup',
    defaultPath: `nestcafe-backup-${new Date().toISOString().slice(0, 10)}.nestcafe-backup`,
    filters: BACKUP_FILTERS,
  };
  return win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options);
}

function showBackupOpenDialog(win: BrowserWindow | undefined) {
  const options = {
    title: 'Import NestCafe backup',
    properties: ['openFile'] as Array<'openFile'>,
    filters: BACKUP_FILTERS,
  };
  return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options);
}

function normalizeOptions(input: unknown): BackupSectionOptions {
  const value = input && typeof input === 'object' ? (input as Partial<BackupSectionOptions>) : {};
  return {
    settings: value.settings !== false,
    providers: value.providers !== false,
    apiKeys: value.apiKeys !== false,
    workspaces: value.workspaces !== false,
    skills: value.skills !== false,
  };
}

function isBackupFile(value: unknown): value is BackupFile {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { app?: unknown }).app === 'NestCafe' &&
    (value as { version?: unknown }).version === 1 &&
    typeof (value as { data?: unknown }).data === 'object'
  );
}

export function registerBackupHandlers(): void {
  handle('backup:export', async (event: IpcMainInvokeEvent, rawOptions: unknown) => {
    const options = normalizeOptions(rawOptions);
    const win = getWindow(event);
    const result = await showBackupSaveDialog(win);

    if (result.canceled || !result.filePath) {
      return { success: false, reason: 'cancelled' };
    }

    const client = getDaemonClient();
    const data: Record<string, unknown> = {};

    if (options.settings) {
      data.settings = await client.call('settings.getAll');
    }
    if (options.providers) {
      data.providers = await client.call('provider.getSettings');
    }
    if (options.apiKeys) {
      data.apiKeys = await client.call('secrets.getAllApiKeys');
      data.bedrockCredentials = await client.call('secrets.getBedrockCredentials');
    }
    if (options.workspaces) {
      const workspaces = await client.call('workspace.list');
      const activeWorkspace = await client.call('workspace.getActive');
      const knowledgeNotes: Record<string, unknown> = {};
      for (const workspace of workspaces) {
        knowledgeNotes[workspace.id] = await client.call('knowledgeNote.list', {
          workspaceId: workspace.id,
        });
      }
      data.workspaces = {
        workspaces,
        activeWorkspaceId: activeWorkspace?.id ?? null,
        knowledgeNotes,
      };
    }
    if (options.skills) {
      data.skills = await client.call('skills.list');
    }

    const backup: BackupFile = {
      app: 'NestCafe',
      version: 1,
      exportedAt: new Date().toISOString(),
      sections: options,
      data,
    };

    await fs.writeFile(result.filePath, `${JSON.stringify(backup, null, 2)}\n`, 'utf8');
    return { success: true, path: result.filePath };
  });

  handle('backup:import', async (event: IpcMainInvokeEvent, rawOptions: unknown) => {
    const options = normalizeOptions(rawOptions);
    const win = getWindow(event);
    const result = await showBackupOpenDialog(win);

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, reason: 'cancelled' };
    }

    const content = await fs.readFile(result.filePaths[0], 'utf8');
    const parsed: unknown = JSON.parse(content);
    if (!isBackupFile(parsed)) {
      throw new Error('Invalid NestCafe backup file');
    }

    const client = getDaemonClient();
    const restored: string[] = [];

    if (options.settings && parsed.data.settings && typeof parsed.data.settings === 'object') {
      const settings = parsed.data.settings as Record<string, unknown>;
      const app = settings.app as Record<string, unknown> | undefined;
      if (app?.theme === 'system' || app?.theme === 'light' || app?.theme === 'dark') {
        await client.call('settings.setTheme', { theme: app.theme });
      }
      if (
        app?.language === 'auto' ||
        app?.language === 'en' ||
        app?.language === 'zh-CN' ||
        app?.language === 'ru' ||
        app?.language === 'fr' ||
        app?.language === 'pl'
      ) {
        await client.call('settings.setLanguage', { language: app.language });
      }
      if (typeof app?.debugMode === 'boolean') {
        await client.call('settings.setDebugMode', { enabled: app.debugMode });
      }
      if (typeof app?.onboardingComplete === 'boolean') {
        await client.call('settings.setOnboardingComplete', { complete: app.onboardingComplete });
      }
      if (typeof settings.notificationsEnabled === 'boolean') {
        await client.call('settings.setNotificationsEnabled', {
          enabled: settings.notificationsEnabled,
        });
      }
      if (settings.closeBehavior === 'keep-daemon' || settings.closeBehavior === 'stop-daemon') {
        await client.call('settings.setCloseBehavior', { behavior: settings.closeBehavior });
      }
      if ('sandboxConfig' in settings) {
        await client.call('settings.setSandboxConfig', {
          config: settings.sandboxConfig as SandboxConfig,
        });
      }
      if ('cloudBrowserConfig' in settings) {
        await client.call('settings.setCloudBrowserConfig', {
          config: settings.cloudBrowserConfig as CloudBrowserConfig | null,
        });
      }
      if ('messagingConfig' in settings) {
        await client.call('settings.setMessagingConfig', {
          config: settings.messagingConfig as MessagingConfig | null,
        });
      }
      if ('huggingFaceLocalConfig' in settings) {
        await client.call('provider.setHuggingFaceLocalConfig', {
          config: settings.huggingFaceLocalConfig as HuggingFaceLocalConfig | null,
        });
      }
      if ('nimConfig' in settings) {
        await client.call('settings.setNimConfig', {
          config: settings.nimConfig as NimConfig | null,
        });
      }
      if ('folderIndexingConfig' in settings) {
        await client.call('folderIndexing.setConfig', {
          config: settings.folderIndexingConfig as FolderIndexingConfig,
        });
      }
      restored.push('settings');
    }

    if (options.providers && parsed.data.providers && typeof parsed.data.providers === 'object') {
      const providers = parsed.data.providers as {
        activeProviderId?: ProviderId | null;
        connectedProviders?: Record<string, ConnectedProvider>;
        debugMode?: boolean;
      };
      if (typeof providers.debugMode === 'boolean') {
        await client.call('provider.setDebugMode', { enabled: providers.debugMode });
      }
      for (const [providerId, provider] of Object.entries(providers.connectedProviders ?? {})) {
        await client.call('provider.setConnected', {
          providerId: providerId as ProviderId,
          provider,
        });
      }
      if (providers.activeProviderId !== undefined) {
        await client.call('provider.setActive', { providerId: providers.activeProviderId });
      }
      restored.push('providers');
    }

    if (options.apiKeys) {
      if (parsed.data.apiKeys && typeof parsed.data.apiKeys === 'object') {
        for (const [provider, apiKey] of Object.entries(parsed.data.apiKeys)) {
          if (typeof apiKey === 'string' && apiKey.trim() !== '') {
            await client.call('secrets.storeApiKey', { provider, apiKey });
          }
        }
      }
      if (parsed.data.bedrockCredentials && typeof parsed.data.bedrockCredentials === 'object') {
        await client.call('secrets.storeBedrockCredentials', {
          credentials: JSON.stringify(parsed.data.bedrockCredentials),
        });
      }
      restored.push('apiKeys');
    }

    if (
      options.workspaces &&
      parsed.data.workspaces &&
      typeof parsed.data.workspaces === 'object'
    ) {
      const backupWorkspaces = parsed.data.workspaces as {
        workspaces?: Array<{
          id: string;
          name: string;
          description?: string;
          color?: string;
          order?: number;
        }>;
        activeWorkspaceId?: string | null;
        knowledgeNotes?: Record<string, Array<{ id: string; type: string; content: string }>>;
      };
      for (const workspace of backupWorkspaces.workspaces ?? []) {
        const existing = await client.call('workspace.get', { workspaceId: workspace.id });
        if (existing) {
          await client.call('workspace.update', {
            workspaceId: workspace.id,
            input: {
              name: workspace.name,
              description: workspace.description,
              color: workspace.color,
              order: workspace.order,
            },
          });
        } else if (!workspace.id.startsWith('default')) {
          await client.call('workspace.create', {
            input: {
              name: workspace.name,
              description: workspace.description,
              color: workspace.color,
            },
          });
        }
      }
      if (backupWorkspaces.activeWorkspaceId) {
        await client
          .call('workspace.setActive', { workspaceId: backupWorkspaces.activeWorkspaceId })
          .catch(() => undefined);
      }
      restored.push('workspaces');
    }

    if (options.skills && Array.isArray(parsed.data.skills)) {
      const currentSkills = await client.call('skills.list');
      const existingIds = new Set(currentSkills.map((skill) => skill.id));
      for (const skill of parsed.data.skills) {
        if (
          skill &&
          typeof skill === 'object' &&
          typeof (skill as { id?: unknown }).id === 'string' &&
          typeof (skill as { enabled?: unknown }).enabled === 'boolean' &&
          existingIds.has((skill as { id: string }).id)
        ) {
          await client.call('skills.setEnabled', {
            skillId: (skill as { id: string }).id,
            enabled: (skill as { enabled: boolean }).enabled,
          });
        }
      }
      restored.push('skills');
    }

    return { success: true, path: result.filePaths[0], restored };
  });
}
