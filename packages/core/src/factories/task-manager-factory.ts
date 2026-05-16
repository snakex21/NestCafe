// ============================================================
// Task manager factory — creates a TaskManagerAPI instance.
// Manages task lifecycle (create, cancel, interrupt, resume).
// Actual execution is delegated to the daemon layer via callbacks.
// ============================================================

import type { TaskManagerAPI } from '../api/index.js';
import type { TaskManagerOptions } from './index.js';
import type { Task, TaskConfig, TaskStatus, TaskUpdateEvent } from '../types/task.types.js';
import { generateTypedId } from '../utils/id.js';

export function createTaskManager(options: TaskManagerOptions): TaskManagerAPI {
  const { onTaskUpdate } = options;

  // In-memory task store. In production, this would be backed by StorageAPI
  // and synced with the opencode process output.
  const tasks = new Map<string, Task>();

  function emit(event: TaskUpdateEvent): void {
    try {
      onTaskUpdate?.(event);
    } catch {
      // Callback errors should not crash the task manager
    }
  }

  function createTaskRecord(config: TaskConfig): Task {
    const id = config.taskId ?? generateTypedId('task');
    const now = new Date().toISOString();

    const task: Task = {
      id,
      prompt: config.prompt,
      status: 'pending',
      messages: [],
      createdAt: now,
      workspaceId: config.workspaceId,
    };

    tasks.set(id, task);
    return task;
  }

  const api: TaskManagerAPI = {
    async startTask(config: TaskConfig): Promise<Task> {
      const task = createTaskRecord(config);

      task.status = 'queued';
      task.startedAt = new Date().toISOString();
      emit({ taskId: task.id, type: 'progress', progress: { taskId: task.id, stage: 'init' } });

      task.status = 'running';
      emit({ taskId: task.id, type: 'progress', progress: { taskId: task.id, stage: 'thinking' } });

      return task;
    },

    async cancelTask(taskId: string): Promise<void> {
      const task = tasks.get(taskId);
      if (!task) {
        return;
      }

      task.status = 'cancelled';
      task.completedAt = new Date().toISOString();
      emit({
        taskId,
        type: 'complete',
        result: { status: 'interrupted', error: 'Task cancelled by user' },
      });
    },

    async interruptTask(taskId: string): Promise<void> {
      const task = tasks.get(taskId);
      if (!task) {
        return;
      }

      task.status = 'interrupted';
      task.completedAt = new Date().toISOString();
      emit({
        taskId,
        type: 'complete',
        result: { status: 'interrupted', error: 'Task interrupted by user' },
      });
    },

    async getTask(taskId: string): Promise<Task | null> {
      return tasks.get(taskId) ?? null;
    },

    async listTasks(filter?: {
      limit?: number;
      offset?: number;
      status?: TaskStatus;
    }): Promise<Task[]> {
      let results = [...tasks.values()];

      if (filter?.status) {
        results = results.filter((t) => t.status === filter.status);
      }

      const skip = filter?.offset ?? 0;
      const limit = filter?.limit ?? results.length;
      return results.slice(skip, skip + limit);
    },

    async rerunFromMessage(taskId: string, messageId: string): Promise<Task> {
      const originalTask = tasks.get(taskId);
      if (!originalTask) {
        throw new Error(`Task ${taskId} not found`);
      }

      // Find the target message and create a new task with its content
      const targetMsg = originalTask.messages.find((m) => m.id === messageId);
      const prompt = targetMsg?.content ?? originalTask.prompt;

      const newConfig: TaskConfig = {
        prompt,
        workingDirectory: undefined,
        workspaceId: originalTask.workspaceId,
      };

      return api.startTask(newConfig);
    },

    async resumeTask(taskId: string): Promise<Task> {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      task.status = 'running';
      emit({ taskId, type: 'progress', progress: { taskId, stage: 'thinking' } });
      return task;
    },
  };

  return api;
}
