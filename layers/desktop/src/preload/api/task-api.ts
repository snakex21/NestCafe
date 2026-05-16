import { ipcRenderer } from 'electron';
import type { TodoItem } from '@nestcafe_ai/agent-core/desktop-main';

export const taskApi = {
  startTask: (config: { description: string }): Promise<unknown> =>
    ipcRenderer.invoke('task:start', config),
  cancelTask: (taskId: string): Promise<void> => ipcRenderer.invoke('task:cancel', taskId),
  interruptTask: (taskId: string): Promise<void> => ipcRenderer.invoke('task:interrupt', taskId),
  rerunTaskFromMessage: (
    taskId: string,
    messageId: string,
    content: string,
    originalContent?: string,
    autoApprovePermissions?: boolean,
  ): Promise<unknown> =>
    ipcRenderer.invoke(
      'task:rerun-from-message',
      taskId,
      messageId,
      content,
      originalContent,
      autoApprovePermissions,
    ),
  getTask: (taskId: string): Promise<unknown> => ipcRenderer.invoke('task:get', taskId),
  listTasks: (): Promise<unknown[]> => ipcRenderer.invoke('task:list'),
  deleteTask: (taskId: string): Promise<void> => ipcRenderer.invoke('task:delete', taskId),
  clearTaskHistory: (): Promise<void> => ipcRenderer.invoke('task:clear-history'),
  getTodosForTask: (taskId: string): Promise<TodoItem[]> =>
    ipcRenderer.invoke('task:get-todos', taskId),
  respondToPermission: (response: { taskId: string; allowed: boolean }): Promise<void> =>
    ipcRenderer.invoke('permission:respond', response),
  resumeSession: (
    sessionId: string,
    prompt: string,
    taskId?: string,
    attachments?: unknown[],
    autoApprovePermissions?: boolean,
  ): Promise<unknown> =>
    ipcRenderer.invoke(
      'session:resume',
      sessionId,
      prompt,
      taskId,
      attachments,
      autoApprovePermissions,
    ),
};

export const taskEvents = {
  onTaskUpdate: (callback: (event: unknown) => void) => {
    const listener = (_: unknown, event: unknown) => callback(event);
    ipcRenderer.on('task:update', listener);
    return () => ipcRenderer.removeListener('task:update', listener);
  },
  onTaskUpdateBatch: (callback: (event: { taskId: string; messages: unknown[] }) => void) => {
    const listener = (_: unknown, event: { taskId: string; messages: unknown[] }) =>
      callback(event);
    ipcRenderer.on('task:update:batch', listener);
    return () => ipcRenderer.removeListener('task:update:batch', listener);
  },
  onPermissionRequest: (callback: (request: unknown) => void) => {
    const listener = (_: unknown, request: unknown) => callback(request);
    ipcRenderer.on('permission:request', listener);
    return () => ipcRenderer.removeListener('permission:request', listener);
  },
  onTaskProgress: (callback: (progress: unknown) => void) => {
    const listener = (_: unknown, progress: unknown) => callback(progress);
    ipcRenderer.on('task:progress', listener);
    return () => ipcRenderer.removeListener('task:progress', listener);
  },
  onTaskStatusChange: (callback: (data: { taskId: string; status: string }) => void) => {
    const listener = (_: unknown, data: { taskId: string; status: string }) => callback(data);
    ipcRenderer.on('task:status-change', listener);
    return () => ipcRenderer.removeListener('task:status-change', listener);
  },
  onTaskSummary: (callback: (data: { taskId: string; summary: string }) => void) => {
    const listener = (_: unknown, data: { taskId: string; summary: string }) => callback(data);
    ipcRenderer.on('task:summary', listener);
    return () => ipcRenderer.removeListener('task:summary', listener);
  },
  onTodoUpdate: (
    callback: (data: {
      taskId: string;
      todos: Array<{ id: string; content: string; status: string; priority: string }>;
    }) => void,
  ) => {
    const listener = (
      _: unknown,
      data: {
        taskId: string;
        todos: Array<{ id: string; content: string; status: string; priority: string }>;
      },
    ) => callback(data);
    ipcRenderer.on('todo:update', listener);
    return () => ipcRenderer.removeListener('todo:update', listener);
  },
  onAuthError: (callback: (data: { providerId: string; message: string }) => void) => {
    const listener = (_: unknown, data: { providerId: string; message: string }) => callback(data);
    ipcRenderer.on('auth:error', listener);
    return () => ipcRenderer.removeListener('auth:error', listener);
  },
  onStepFinish: (
    callback: (data: {
      taskId: string;
      tokens?: { input: number; output: number; reasoning: number };
    }) => void,
  ) => {
    const listener = (
      _: unknown,
      data: { taskId: string; tokens?: { input: number; output: number; reasoning: number } },
    ) => callback(data);
    ipcRenderer.on('task:step-finish', listener);
    return () => ipcRenderer.removeListener('task:step-finish', listener);
  },
};
