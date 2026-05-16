import { ipcRenderer } from 'electron';

export const systemApi = {
  logEvent: (payload: { level?: string; message: string; context?: Record<string, unknown> }) =>
    ipcRenderer.invoke('log:event', payload),
  exportLogs: (): Promise<{ success: boolean; path?: string; error?: string; reason?: string }> =>
    ipcRenderer.invoke('logs:export'),
  exportBackup: (options: {
    settings: boolean;
    providers: boolean;
    apiKeys: boolean;
    workspaces: boolean;
    skills: boolean;
  }): Promise<{ success: boolean; path?: string; reason?: string }> =>
    ipcRenderer.invoke('backup:export', options),
  importBackup: (options: {
    settings: boolean;
    providers: boolean;
    apiKeys: boolean;
    workspaces: boolean;
    skills: boolean;
  }): Promise<{ success: boolean; path?: string; reason?: string; restored?: string[] }> =>
    ipcRenderer.invoke('backup:import', options),
  getDaemonSocketPath: (): Promise<string> => ipcRenderer.invoke('daemon:get-socket-path'),
  daemonPing: (): Promise<{ status: string; uptime: number }> => ipcRenderer.invoke('daemon:ping'),
  daemonRestart: (): Promise<{ success: boolean }> => ipcRenderer.invoke('daemon:restart'),
  daemonStop: (): Promise<{ success: boolean }> => ipcRenderer.invoke('daemon:stop'),
  daemonStart: (): Promise<{ success: boolean }> => ipcRenderer.invoke('daemon:start'),
  getCloseBehavior: (): Promise<string> => ipcRenderer.invoke('daemon:get-close-behavior'),
  setCloseBehavior: (behavior: string): Promise<void> =>
    ipcRenderer.invoke('daemon:set-close-behavior', behavior),
  captureScreenshot: (): Promise<{
    success: boolean;
    data?: string;
    width?: number;
    height?: number;
    error?: string;
  }> => ipcRenderer.invoke('debug:capture-screenshot'),
  captureAxtree: (): Promise<{ success: boolean; data?: string; error?: string }> =>
    ipcRenderer.invoke('debug:capture-axtree'),
  generateBugReport: (data: {
    taskId?: string;
    taskPrompt?: string;
    taskStatus?: string;
    taskCreatedAt?: string;
    taskCompletedAt?: string;
    messages?: unknown[];
    debugLogs?: unknown[];
    screenshot?: string;
    axtree?: string;
    appVersion?: string;
    platform?: string;
  }): Promise<{ success: boolean; path?: string; error?: string; reason?: string }> =>
    ipcRenderer.invoke('debug:generate-bug-report', data),
  getUpdateAutoCheck: (): Promise<boolean> => ipcRenderer.invoke('update:get-auto-check'),
  setUpdateAutoCheck: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('update:set-auto-check', enabled),
  getUpdateAutoDownload: (): Promise<boolean> => ipcRenderer.invoke('update:get-auto-download'),
  setUpdateAutoDownload: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('update:set-auto-download', enabled),
  getUpdateAutoInstall: (): Promise<boolean> => ipcRenderer.invoke('update:get-auto-install'),
  setUpdateAutoInstall: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('update:set-auto-install', enabled),
  getUpdateState: (): Promise<{
    enabled: boolean;
    updateAvailable: boolean;
    downloadedVersion: string | null;
    availableVersion: string | null;
  }> => ipcRenderer.invoke('update:get-state'),
  checkForUpdates: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('update:check'),
  quitAndInstall: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('update:quit-and-install'),
  onCloseRequested: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('app:close-requested', listener);
    return () => ipcRenderer.removeListener('app:close-requested', listener);
  },
  respondToClose: (decision: 'keep-daemon' | 'stop-daemon' | 'cancel'): void => {
    ipcRenderer.send('app:close-response', decision);
  },
};

export const systemEvents = {
  onDaemonDisconnected: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('daemon:disconnected', listener);
    return () => ipcRenderer.removeListener('daemon:disconnected', listener);
  },
  onDaemonReconnected: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('daemon:reconnected', listener);
    return () => ipcRenderer.removeListener('daemon:reconnected', listener);
  },
  onDaemonReconnectFailed: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('daemon:reconnect-failed', listener);
    return () => ipcRenderer.removeListener('daemon:reconnect-failed', listener);
  },
  onUpdateAvailable: (
    callback: (data: { version: string; autoDownload: boolean; userInitiated: boolean }) => void,
  ): (() => void) => {
    const listener = (
      _: unknown,
      data: { version: string; autoDownload: boolean; userInitiated: boolean },
    ) => callback(data);
    ipcRenderer.on('update:available', listener);
    return () => ipcRenderer.removeListener('update:available', listener);
  },
  onUpdateNotAvailable: (callback: (data: { currentVersion: string }) => void): (() => void) => {
    const listener = (_: unknown, data: { currentVersion: string }) => callback(data);
    ipcRenderer.on('update:not-available', listener);
    return () => ipcRenderer.removeListener('update:not-available', listener);
  },
  onUpdateDownloaded: (callback: (data: { version: string }) => void): (() => void) => {
    const listener = (_: unknown, data: { version: string }) => callback(data);
    ipcRenderer.on('update:downloaded', listener);
    return () => ipcRenderer.removeListener('update:downloaded', listener);
  },
  onUpdateError: (callback: (data: { message: string }) => void): (() => void) => {
    const listener = (_: unknown, data: { message: string }) => callback(data);
    ipcRenderer.on('update:error', listener);
    return () => ipcRenderer.removeListener('update:error', listener);
  },
  onUpdateDownloadProgress: (callback: (data: { percent: number }) => void): (() => void) => {
    const listener = (_: unknown, data: { percent: number }) => callback(data);
    ipcRenderer.on('update:download-progress', listener);
    return () => ipcRenderer.removeListener('update:download-progress', listener);
  },
};
