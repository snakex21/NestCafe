import { ipcRenderer } from 'electron';
import type {
  MessagingConnectionStatus,
  GoogleAccount,
  OAuthProviderId,
  ConnectorAuthStatus,
} from '@nestcafe_ai/agent-core/common';
import type { McpConnector } from '@nestcafe_ai/agent-core/desktop-main';

export const integrationApi = {
  getConnectors: (): Promise<McpConnector[]> => ipcRenderer.invoke('connectors:list'),
  addConnector: (name: string, url: string): Promise<McpConnector> =>
    ipcRenderer.invoke('connectors:add', name, url),
  deleteConnector: (id: string): Promise<void> => ipcRenderer.invoke('connectors:delete', id),
  setConnectorEnabled: (id: string, enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('connectors:set-enabled', id, enabled),
  startConnectorOAuth: (connectorId: string): Promise<{ state: string; authUrl: string }> =>
    ipcRenderer.invoke('connectors:start-oauth', connectorId),
  completeConnectorOAuth: (state: string, code: string): Promise<McpConnector> =>
    ipcRenderer.invoke('connectors:complete-oauth', state, code),
  disconnectConnector: (connectorId: string): Promise<void> =>
    ipcRenderer.invoke('connectors:disconnect', connectorId),
  onMcpAuthCallback: (callback: (url: string) => void) => {
    const listener = (_: unknown, url: string) => callback(url);
    ipcRenderer.on('auth:mcp-callback', listener);
    return () => {
      ipcRenderer.removeListener('auth:mcp-callback', listener);
    };
  },
  getBuiltInConnectorAuthStatus: (): Promise<ConnectorAuthStatus[]> =>
    ipcRenderer.invoke('connectors:get-built-in-auth-status'),
  loginBuiltInConnector: (providerId: OAuthProviderId): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('connectors:built-in-login', providerId),
  logoutBuiltInConnector: (providerId: OAuthProviderId): Promise<void> =>
    ipcRenderer.invoke('connectors:built-in-logout', providerId),
  lightdashGetServerUrl: (): Promise<string | null> =>
    ipcRenderer.invoke('lightdash:get-server-url'),
  lightdashSetServerUrl: (url: string): Promise<void> =>
    ipcRenderer.invoke('lightdash:set-server-url', url),
  datadogGetServerUrl: (): Promise<string | null> => ipcRenderer.invoke('datadog:get-server-url'),
  datadogSetServerUrl: (url: string): Promise<void> =>
    ipcRenderer.invoke('datadog:set-server-url', url),
  addFavorite: (taskId: string): Promise<void> => ipcRenderer.invoke('favorites:add', taskId),
  removeFavorite: (taskId: string): Promise<void> => ipcRenderer.invoke('favorites:remove', taskId),
  listFavorites: (): Promise<unknown[]> => ipcRenderer.invoke('favorites:list'),
  isFavorite: (taskId: string): Promise<boolean> => ipcRenderer.invoke('favorites:has', taskId),
  getWhatsAppConfig: (): Promise<{
    providerId: string;
    enabled: boolean;
    status: MessagingConnectionStatus;
    phoneNumber?: string;
    lastConnectedAt?: number;
    qrCode?: string;
    qrIssuedAt?: number;
  } | null> => ipcRenderer.invoke('integrations:whatsapp:get-config'),
  connectWhatsApp: (): Promise<void> => ipcRenderer.invoke('integrations:whatsapp:connect'),
  disconnectWhatsApp: (): Promise<void> => ipcRenderer.invoke('integrations:whatsapp:disconnect'),
  setWhatsAppEnabled: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('integrations:whatsapp:set-enabled', enabled),
  onWhatsAppQR: (callback: (qr: string) => void): (() => void) => {
    const listener = (_: unknown, qr: string) => callback(qr);
    ipcRenderer.on('integrations:whatsapp:qr', listener);
    return () => ipcRenderer.removeListener('integrations:whatsapp:qr', listener);
  },
  onWhatsAppStatus: (callback: (status: MessagingConnectionStatus) => void): (() => void) => {
    const listener = (_: unknown, status: MessagingConnectionStatus) => callback(status);
    ipcRenderer.on('integrations:whatsapp:status', listener);
    return () => ipcRenderer.removeListener('integrations:whatsapp:status', listener);
  },
  listSchedules: (workspaceId?: string): Promise<unknown[]> =>
    ipcRenderer.invoke('scheduler:list', workspaceId),
  createSchedule: (cron: string, prompt: string, workspaceId?: string): Promise<unknown> =>
    ipcRenderer.invoke('scheduler:create', cron, prompt, workspaceId),
  deleteSchedule: (scheduleId: string): Promise<void> =>
    ipcRenderer.invoke('scheduler:delete', scheduleId),
  setScheduleEnabled: (scheduleId: string, enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('scheduler:set-enabled', scheduleId, enabled),
  isAutoStartEnabled: (): Promise<boolean> => ipcRenderer.invoke('daemon:is-auto-start-enabled'),
  gws: {
    listAccounts: (): Promise<GoogleAccount[]> => ipcRenderer.invoke('gws:accounts:list'),
    startAuth: (label: string): Promise<{ state: string; authUrl: string }> =>
      ipcRenderer.invoke('gws:accounts:start-auth', label),
    completeAuth: (state: string, code: string): Promise<GoogleAccount> =>
      ipcRenderer.invoke('gws:accounts:complete-auth', state, code),
    removeAccount: (id: string): Promise<void> => ipcRenderer.invoke('gws:accounts:remove', id),
    updateLabel: (id: string, label: string): Promise<void> =>
      ipcRenderer.invoke('gws:accounts:update-label', id, label),
    cancelAuth: (state: string): Promise<void> =>
      ipcRenderer.invoke('gws:accounts:cancel-auth', state),
    onStatusChanged: (callback: (id: string, status: string) => void): (() => void) => {
      const listener = (_: unknown, id: string, status: string) => callback(id, status);
      ipcRenderer.on('gws:account:status-changed', listener);
      return () => ipcRenderer.removeListener('gws:account:status-changed', listener);
    },
    onAuthError: (callback: (payload: { message: string }) => void): (() => void) => {
      const listener = (_: unknown, payload: { message: string }) => callback(payload);
      ipcRenderer.on('gws:account:auth-error', listener);
      return () => ipcRenderer.removeListener('gws:account:auth-error', listener);
    },
  },
  memory: {
    listPages: (): Promise<
      Array<{
        name: string;
        size: number;
        lines: number;
        mtime: string;
      }>
    > => ipcRenderer.invoke('memory:list-pages'),
    readPage: (page: string): Promise<{ content: string }> =>
      ipcRenderer.invoke('memory:read-page', page),
    writePage: (page: string, content: string): Promise<void> =>
      ipcRenderer.invoke('memory:write-page', page, content),
    deletePage: (page: string): Promise<void> => ipcRenderer.invoke('memory:delete-page', page),
  },
};
