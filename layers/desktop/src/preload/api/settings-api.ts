import { ipcRenderer } from 'electron';
import type { ProviderType } from '@nestcafe_ai/agent-core/desktop-main';
import type { CloudBrowserConfig } from '@nestcafe_ai/agent-core/common';

export const settingsApi = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  getPlatform: (): Promise<string> => ipcRenderer.invoke('app:platform'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-external', url),

  getApiKeys: (): Promise<unknown[]> => ipcRenderer.invoke('settings:api-keys'),
  addApiKey: (provider: ProviderType, key: string, label?: string): Promise<unknown> =>
    ipcRenderer.invoke('settings:add-api-key', provider, key, label),
  getStoredApiKey: (provider: string): Promise<string | null> =>
    ipcRenderer.invoke('settings:get-api-key', provider),
  removeApiKey: (id: string): Promise<void> => ipcRenderer.invoke('settings:remove-api-key', id),
  getNotificationsEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke('settings:notifications-enabled'),
  setNotificationsEnabled: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:set-notifications-enabled', enabled),
  getDebugMode: (): Promise<boolean> => ipcRenderer.invoke('settings:debug-mode'),
  setDebugMode: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:set-debug-mode', enabled),
  getTheme: (): Promise<string> => ipcRenderer.invoke('settings:theme'),
  setTheme: (theme: string): Promise<void> => ipcRenderer.invoke('settings:set-theme', theme),
  getLanguage: (): Promise<string> => ipcRenderer.invoke('settings:language'),
  setLanguage: (language: string): Promise<void> =>
    ipcRenderer.invoke('settings:set-language', language),
  onThemeChange: (callback: (data: { theme: string; resolved: string }) => void) => {
    const listener = (_: unknown, data: { theme: string; resolved: string }) => callback(data);
    ipcRenderer.on('settings:theme-changed', listener);
    return () => ipcRenderer.removeListener('settings:theme-changed', listener);
  },
  getAppSettings: (): Promise<{
    debugMode: boolean;
    onboardingComplete: boolean;
    theme: string;
    language: string;
  }> => ipcRenderer.invoke('settings:app-settings'),
  getCloudBrowserConfig: (): Promise<CloudBrowserConfig | null> =>
    ipcRenderer.invoke('settings:cloud-browser-config:get'),
  setCloudBrowserConfig: (config: CloudBrowserConfig | null): Promise<void> =>
    ipcRenderer.invoke('settings:cloud-browser-config:set', config ? JSON.stringify(config) : null),
  getOpenAiBaseUrl: (): Promise<string> => ipcRenderer.invoke('settings:openai-base-url:get'),
  setOpenAiBaseUrl: (baseUrl: string): Promise<void> =>
    ipcRenderer.invoke('settings:openai-base-url:set', baseUrl),
  getOpenAiOauthStatus: (): Promise<{ connected: boolean; expires?: number }> =>
    ipcRenderer.invoke('opencode:auth:openai:status'),
  loginOpenAiWithChatGpt: (): Promise<{ ok: boolean; openedUrl?: string }> =>
    ipcRenderer.invoke('opencode:auth:openai:login'),
  getSlackMcpOauthStatus: (): Promise<{ connected: boolean; pendingAuthorization: boolean }> =>
    ipcRenderer.invoke('opencode:auth:slack:status'),
  loginSlackMcp: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('opencode:auth:slack:login'),
  logoutSlackMcp: (): Promise<void> => ipcRenderer.invoke('opencode:auth:slack:logout'),
  getCopilotOAuthStatus: (): Promise<{
    connected: boolean;
    username?: string;
    expiresAt?: number;
  }> => ipcRenderer.invoke('opencode:auth:copilot:status'),
  loginGithubCopilot: (): Promise<{
    ok: boolean;
    userCode?: string;
    verificationUri?: string;
    expiresIn?: number;
  }> => ipcRenderer.invoke('opencode:auth:copilot:login'),
  logoutGithubCopilot: (): Promise<void> => ipcRenderer.invoke('opencode:auth:copilot:logout'),
  getOnboardingComplete: (): Promise<boolean> => ipcRenderer.invoke('onboarding:complete'),
  setOnboardingComplete: (complete: boolean): Promise<void> =>
    ipcRenderer.invoke('onboarding:set-complete', complete),
  checkOpenCodeCli: (): Promise<{
    installed: boolean;
    version: string | null;
    installCommand: string;
  }> => ipcRenderer.invoke('opencode:check'),
  getOpenCodeVersion: (): Promise<string | null> => ipcRenderer.invoke('opencode:version'),
  getSandboxConfig: (): Promise<{
    mode: 'disabled' | 'native' | 'docker';
    allowedPaths: string[];
    networkRestricted: boolean;
    allowedHosts: string[];
    dockerImage?: string;
    networkPolicy?: { allowOutbound: boolean; allowedHosts?: string[] };
  }> => ipcRenderer.invoke('sandbox:get-config'),
  setSandboxConfig: (config: {
    mode: 'disabled' | 'native' | 'docker';
    allowedPaths: string[];
    networkRestricted: boolean;
    allowedHosts: string[];
    dockerImage?: string;
    networkPolicy?: { allowOutbound: boolean; allowedHosts?: string[] };
  }): Promise<void> => ipcRenderer.invoke('sandbox:set-config', config),
  isE2EMode: (): Promise<boolean> => ipcRenderer.invoke('app:is-e2e-mode'),
  getBuildCapabilities: (): Promise<{ hasFreeMode: boolean; hasAnalytics: boolean }> =>
    ipcRenderer.invoke('app:get-build-capabilities'),
};

export const settingsEvents = {
  onDebugModeChange: (callback: (data: { enabled: boolean }) => void) => {
    const listener = (_: unknown, data: { enabled: boolean }) => callback(data);
    ipcRenderer.on('settings:debug-mode-changed', listener);
    return () => ipcRenderer.removeListener('settings:debug-mode-changed', listener);
  },
  onDebugLog: (callback: (log: unknown) => void) => {
    const listener = (_: unknown, log: unknown) => callback(log);
    ipcRenderer.on('debug:log', listener);
    return () => ipcRenderer.removeListener('debug:log', listener);
  },
};
