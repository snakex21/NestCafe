import { create } from 'zustand';
import {
  type Task,
  type TaskConfig,
  type TaskStatus,
  type TaskUpdateEvent,
  type PermissionRequest,
  type PermissionResponse,
  type TaskMessage,
  type TodoItem,
} from '@nestcafe_ai/agent-core/common';
import type { StoredFavorite } from '@nestcafe_ai/agent-core';
import { createTaskExecutionActions } from './task-execution-actions';
import { createTaskHistoryActions } from './task-history-actions';
import { createTaskSetupActions } from './task-setup-actions';
import { registerTaskSubscriptions } from './task-subscriptions';

interface TaskUpdateBatchEvent {
  taskId: string;
  messages: TaskMessage[];
}

interface StartupStageInfo {
  stage: string;
  message: string;
  modelName?: string;
  isFirstTask: boolean;
  startTime: number;
}

const AUTO_APPROVE_STORAGE_KEY = 'nestcafe:autoApprovePermissions';
const TASK_TOKENS_STORAGE_KEY = 'nestcafe:taskTokens';

function loadAutoApprovePermissions(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(AUTO_APPROVE_STORAGE_KEY) === 'true';
}

function saveAutoApprovePermissions(enabled: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(AUTO_APPROVE_STORAGE_KEY, enabled ? 'true' : 'false');
}

function loadTaskTokens(): Record<string, number> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(TASK_TOKENS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveTaskTokens(tokens: Record<string, number>): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(TASK_TOKENS_STORAGE_KEY, JSON.stringify(tokens));
}

export interface TaskState {
  _taskStateToken: number;
  currentTask: Task | null;
  isLoading: boolean;
  error: string | null;
  tasks: Task[];
  favorites: StoredFavorite[];
  favoritesLoaded: boolean;
  loadFavorites: () => Promise<void>;
  addFavorite: (taskId: string) => Promise<void>;
  removeFavorite: (taskId: string) => Promise<void>;
  permissionRequests: Record<string, PermissionRequest>;
  setupProgress: string | null;
  setupProgressTaskId: string | null;
  setupDownloadStep: number;
  startupStage: StartupStageInfo | null;
  startupStageTaskId: string | null;
  todos: TodoItem[];
  todosTaskId: string | null;
  authError: { providerId: string; message: string } | null;
  autoApprovePermissions: boolean;
  isLauncherOpen: boolean;
  launcherInitialPrompt: string | null;
  /** Cumulative input tokens used per task — updated on each step-finish, persisted to localStorage. */
  taskTokens: Record<string, number>;
  setAutoApprovePermissions: (enabled: boolean) => void;
  openLauncher: () => void;
  openLauncherWithPrompt: (prompt: string) => void;
  closeLauncher: () => void;
  startTask: (config: TaskConfig) => Promise<Task | null>;
  setSetupProgress: (taskId: string | null, message: string | null) => void;
  setStartupStage: (
    taskId: string | null,
    stage: string | null,
    message?: string,
    modelName?: string,
    isFirstTask?: boolean,
  ) => void;
  clearStartupStage: (taskId: string) => void;
  sendFollowUp: (
    message: string,
    attachments?: import('@nestcafe_ai/agent-core/common').FileAttachmentInfo[],
  ) => Promise<boolean>;
  rerunFromMessage: (messageId: string, content: string) => Promise<boolean>;
  cancelTask: () => Promise<void>;
  interruptTask: () => Promise<void>;
  setPermissionRequest: (request: PermissionRequest) => void;
  clearPermissionRequest: (taskId: string) => void;
  respondToPermission: (response: PermissionResponse) => Promise<void>;
  addTaskUpdate: (event: TaskUpdateEvent) => void;
  addTaskUpdateBatch: (event: TaskUpdateBatchEvent) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  setTaskSummary: (taskId: string, summary: string) => void;
  /** Update cumulative token count for a task (called on step-finish events). */
  setTaskTokens: (taskId: string, totalTokens: number) => void;
  /** Reset token count (called on message edit/delete before task restart). */
  resetTaskTokens: (taskId: string) => void;
  loadTasks: () => Promise<void>;
  loadTaskById: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  reset: () => void;
  setTodos: (taskId: string, todos: TodoItem[]) => void;
  clearTodos: () => void;
  setAuthError: (error: { providerId: string; message: string }) => void;
  clearAuthError: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  _taskStateToken: 0,
  currentTask: null,
  isLoading: false,
  error: null,
  tasks: [],
  favorites: [],
  favoritesLoaded: false,
  permissionRequests: {},
  setupProgress: null,
  setupProgressTaskId: null,
  setupDownloadStep: 1,
  startupStage: null,
  startupStageTaskId: null,
  todos: [],
  todosTaskId: null,
  authError: null,
  autoApprovePermissions: loadAutoApprovePermissions(),
  isLauncherOpen: false,
  launcherInitialPrompt: null,
  taskTokens: loadTaskTokens(),
  setAutoApprovePermissions: (enabled) => {
    saveAutoApprovePermissions(enabled);
    set({ autoApprovePermissions: enabled });
  },

  setTaskTokens: (taskId, totalTokens) => {
    set((state) => {
      const taskTokens = { ...state.taskTokens, [taskId]: totalTokens };
      saveTaskTokens(taskTokens);
      return { taskTokens };
    });
  },

  resetTaskTokens: (taskId) => {
    set((state) => {
      const { [taskId]: _, ...rest } = state.taskTokens;
      saveTaskTokens(rest);
      return { taskTokens: rest };
    });
  },

  ...createTaskExecutionActions(set, get),
  ...createTaskHistoryActions(set, get),
  ...createTaskSetupActions(set, get),
}));

registerTaskSubscriptions(() => useTaskStore.getState());
