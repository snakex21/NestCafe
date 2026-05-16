// ============================================================
// Daemon domain types — JSON-RPC 2.0 protocol for
// communication between Electron main process and the
// background daemon process via Unix socket / named pipe.
// ============================================================

import type { TaskConfig, TaskStatus, Task, TaskMessage } from './task.types.js';
import type { SettingsSnapshot } from './settings.types.js';
import type { Workspace } from './workspace.types.js';
import type { Skill } from './skill.types.js';
import type { McpConnector } from './connector.types.js';
import type { GoogleAccount } from './google-account.types.js';
import type { ModuleInstance } from './module.types.js';
import type { PermissionRequest, PermissionResponse } from './permission.types.js';
import type { MessagingIntegrationConfig, MessagingQRCode } from './messaging.types.js';

// ---- JSON-RPC 2.0 core ----

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// ---- Method map: request → response ----

export interface TaskStartParams extends TaskConfig {
  // all fields from TaskConfig
}

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'error';
  uptime: number;
  version: string;
  activeTasks: number;
  storageOk: boolean;
}

export type SettingsChangePayload = Partial<SettingsSnapshot>;

export interface WorkspaceChangePayload {
  action: 'created' | 'updated' | 'deleted';
  workspace: Workspace;
}

/**
 * Maps every daemon RPC method name to its request params and response type.
 * Used by both server and client for type-safe communication.
 */
export interface DaemonMethodMap {
  // Task
  'task.start': { params: TaskStartParams; result: Task };
  'task.cancel': { params: { taskId: string }; result: void };
  'task.interrupt': { params: { taskId: string }; result: void };
  'task.get': { params: { taskId: string }; result: Task | null };
  'task.list': {
    params?: { limit?: number; offset?: number; status?: TaskStatus };
    result: Task[];
  };
  'task.rerunFromMessage': { params: { taskId: string; messageId: string }; result: Task };
  'task.resume': { params: { taskId: string }; result: Task };

  // Permission
  'permission.respond': { params: PermissionResponse; result: void };

  // Health
  'health.check': { params: void; result: HealthCheckResult };

  // Settings
  'settings.get': { params: void; result: SettingsSnapshot };
  'settings.set': { params: SettingsChangePayload; result: void };

  // Secrets
  'secrets.set': { params: { key: string; value: string }; result: void };
  'secrets.get': { params: { key: string }; result: string | null };
  'secrets.delete': { params: { key: string }; result: void };
  'secrets.getAll': { params: void; result: Record<string, string> };

  // Workspace
  'workspace.list': { params: void; result: Workspace[] };
  'workspace.get': { params: { id: string }; result: Workspace | null };
  'workspace.create': {
    params: { name: string; path: string; description?: string };
    result: Workspace;
  };
  'workspace.update': {
    params: { id: string } & Partial<{
      name: string;
      path: string;
      description: string;
      isActive: boolean;
    }>;
    result: Workspace;
  };
  'workspace.delete': { params: { id: string }; result: void };

  // Connectors
  'connector.list': { params: void; result: McpConnector[] };
  'connector.get': { params: { id: string }; result: McpConnector | null };
  'connector.enable': { params: { id: string }; result: void };
  'connector.disable': { params: { id: string }; result: void };

  // Skills
  'skills.list': { params: void; result: Skill[] };
  'skills.enable': { params: { id: string }; result: void };
  'skills.disable': { params: { id: string }; result: void };

  // Google Accounts
  'gws.accounts.list': { params: void; result: GoogleAccount[] };
  'gws.accounts.get': { params: { id: string }; result: GoogleAccount | null };
  'gws.accounts.add': { params: { email: string }; result: GoogleAccount };
  'gws.accounts.remove': { params: { id: string }; result: void };

  // Modules
  'module.list': { params: void; result: ModuleInstance[] };
  'module.enable': { params: { id: string }; result: void };
  'module.disable': { params: { id: string }; result: void };

  // Daemon lifecycle
  'daemon.shutdown': { params: void; result: void };
  'daemon.getCloseBehavior': { params: void; result: string };
  'daemon.setCloseBehavior': { params: { behavior: string }; result: void };

  // WhatsApp
  'whatsapp.getConfig': { params: void; result: MessagingIntegrationConfig | null };
  'whatsapp.connect': { params: void; result: void };
  'whatsapp.disconnect': { params: void; result: void };
}

/**
 * Push notifications sent from daemon to desktop main process.
 */
export interface DaemonNotificationMap {
  'task.update': { taskId: string; message?: TaskMessage; status?: TaskStatus; error?: string };
  'task.progress': { taskId: string; stage: string; percentage?: number; message?: string };
  'permission.request': PermissionRequest;
  'browser.frame': { taskId: string; data: string; format: string };
  'browser.navigate': { taskId: string; url: string };
  'browser.status': { taskId: string; status: string; url?: string; error?: string };
  'workspace.changed': WorkspaceChangePayload;
  'workspace.deleted': { workspaceId: string };
  'daemon.disconnected': void;
  'daemon.reconnected': void;
  'skills.changed': void;
  'gws.account.status-changed': { accountId: string; status: string };
}

// ---- Helper type for method dispatch ----

export type DaemonMethod = keyof DaemonMethodMap;
