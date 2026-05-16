// ============================================================
// Task domain types — the core entity of the application.
// Every task represents a user request processed by the AI.
// ============================================================

import type { OAuthProviderId } from './connector.types.js';

// ---- Lifecycle ----

export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'waiting_permission'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

/**
 * Originating surface for a task. Determines the permission-prompt policy:
 *   - `'ui'` (default): prompt the UI if connected; auto-deny otherwise.
 *   - `'whatsapp'`: route through WhatsApp bridge; auto-denies all prompts.
 *   - `'scheduler'`: scheduled task; prompt UI when connected, otherwise auto-deny.
 */
export type TaskSource = 'ui' | 'whatsapp' | 'scheduler';

// ---- Input configuration ----

export interface TaskConfig {
  prompt: string;
  taskId?: string;
  workingDirectory?: string;
  allowedTools?: string[];
  systemPromptAppend?: string;
  outputSchema?: object;
  sessionId?: string;
  modelId?: string;
  provider?: string;
  /** Auto-approve OpenCode tool/file permission prompts for this task. */
  autoApprovePermissions?: boolean;
  /** User-attached files (drag-and-drop or file picker). Not persisted. */
  files?: FileAttachmentInfo[];
  source?: TaskSource;
  workspaceId?: string;
}

// ---- Attachments ----

export interface FileAttachmentInfo {
  id: string;
  name: string;
  path: string;
  type: 'image' | 'text' | 'code' | 'pdf' | 'other';
  size: number;
  content?: string;
}

export interface TaskAttachment {
  type: 'screenshot' | 'json';
  data: string;
  label?: string;
}

// ---- Core task entity ----

export interface Task {
  id: string;
  prompt: string;
  summary?: string;
  status: TaskStatus;
  sessionId?: string;
  messages: TaskMessage[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: TaskResult;
  workspaceId?: string;
}

// ---- Messages ----

export interface TaskMessage {
  id: string;
  type: 'assistant' | 'user' | 'tool' | 'system';
  content: string;
  toolName?: string;
  toolStatus?: 'running' | 'completed' | 'error';
  toolInput?: unknown;
  timestamp: string;
  attachments?: TaskAttachment[];
  modelId?: string;
  providerId?: string;
}

// ---- Pause & Resume ----

export type TaskPauseAction =
  | {
      type: 'oauth-connect';
      providerId: OAuthProviderId;
      label: string;
      pendingLabel?: string;
      successText?: string;
    }
  | {
      type: 'google-file-picker';
      label: string;
      pendingLabel?: string;
      query?: string;
      accountLabel?: string;
      accountEmail?: string;
    };

// ---- Result ----

export type TaskResult =
  | {
      status: 'success' | 'error' | 'interrupted';
      sessionId?: string;
      durationMs?: number;
      error?: string;
      pauseReason: 'oauth';
      pauseAction: Extract<TaskPauseAction, { type: 'oauth-connect' }>;
    }
  | {
      status: 'success' | 'error' | 'interrupted';
      sessionId?: string;
      durationMs?: number;
      error?: string;
      pauseReason: 'file-picker';
      pauseAction: Extract<TaskPauseAction, { type: 'google-file-picker' }>;
    }
  | {
      status: 'success' | 'error' | 'interrupted';
      sessionId?: string;
      durationMs?: number;
      error?: string;
    };

// ---- Events & Progress ----

export interface TaskProgress {
  taskId: string;
  stage: 'init' | 'thinking' | 'tool-use' | 'waiting' | 'complete' | 'setup' | StartupStage;
  toolName?: string;
  toolInput?: unknown;
  percentage?: number;
  message?: string;
  modelName?: string;
  isFirstTask?: boolean;
}

export interface TaskUpdateEvent {
  taskId: string;
  type: 'message' | 'progress' | 'complete' | 'error';
  message?: TaskMessage;
  progress?: TaskProgress;
  result?: TaskResult;
  error?: string;
}

// ---- Startup ----

export type StartupStage =
  | 'starting'
  | 'browser'
  | 'environment'
  | 'loading'
  | 'connecting'
  | 'waiting';

export const STARTUP_STAGES: readonly string[] = [
  'starting',
  'browser',
  'environment',
  'loading',
  'connecting',
  'waiting',
] as const satisfies readonly StartupStage[];
