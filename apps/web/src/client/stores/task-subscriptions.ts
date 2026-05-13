import {
  STARTUP_STAGES,
  type TaskUpdateEvent,
  type TodoItem,
} from '@nestcafe_ai/agent-core/common';
import { createLogger } from '../lib/logger';
import { hasTrackedTask } from './task-state-helpers';

const logger = createLogger('TaskStore');

interface ProviderSettingsSnapshot {
  activeProviderId?: string | null;
}

interface SetupProgressEvent {
  taskId: string;
  stage: string;
  message?: string;
  isFirstTask?: boolean;
  modelName?: string;
}

/** Registers all global IPC subscriptions for the task store. Called once on module load. */
export function registerTaskSubscriptions(getStore: () => import('./taskStore').TaskState) {
  if (typeof window === 'undefined' || !window.nestcafe) {
    return;
  }

  window.nestcafe.onTaskProgress((progress: unknown) => {
    const event = progress as SetupProgressEvent;
    const state = getStore();

    if (!hasTrackedTask(state, event.taskId)) {
      return;
    }

    if (STARTUP_STAGES.includes(event.stage)) {
      state.setStartupStage(
        event.taskId,
        event.stage,
        event.message,
        event.modelName,
        event.isFirstTask,
      );
      return;
    }
    if (event.stage === 'tool-use') {
      state.clearStartupStage(event.taskId);
      return;
    }
    if (event.stage === 'setup' && event.message) {
      if (event.message.toLowerCase().includes('installed successfully')) {
        state.setSetupProgress(null, null);
      } else {
        state.setSetupProgress(event.taskId, event.message);
      }
      return;
    }
    if (event.message) {
      if (event.message.toLowerCase().includes('installed successfully')) {
        state.setSetupProgress(null, null);
      } else if (event.message.toLowerCase().includes('download')) {
        state.setSetupProgress(event.taskId, event.message);
      }
    }
  });

  window.nestcafe.onTaskUpdate((event: unknown) => {
    const updateEvent = event as TaskUpdateEvent;
    if (updateEvent.type === 'complete' || updateEvent.type === 'error') {
      const state = getStore();
      if (state.setupProgressTaskId === updateEvent.taskId) {
        state.setSetupProgress(null, null);
      }
      state.clearStartupStage(updateEvent.taskId);

      // Refresh sidebar task list when ANY task completes — catches scheduled
      // tasks and other daemon-initiated tasks the UI didn't start.
      void state.loadTasks();
    }
  });

  window.nestcafe.onTaskSummary?.((data: { taskId: string; summary: string }) => {
    const state = getStore();
    state.setTaskSummary(data.taskId, data.summary);
    // Refresh sidebar to show new task with its summary title
    void state.loadTasks();
  });

  window.nestcafe.onTodoUpdate?.((data: { taskId: string; todos: TodoItem[] }) => {
    const state = getStore();
    if (state.currentTask?.id === data.taskId) {
      state.setTodos(data.taskId, data.todos);
    }
  });

  window.nestcafe.onAuthError?.((data: { providerId: string; message: string }) => {
    void (async () => {
      if (data.providerId === 'openai') {
        try {
          const settings = (await window.nestcafe?.getProviderSettings()) as
            | ProviderSettingsSnapshot
            | undefined;
          const activeProviderId = settings?.activeProviderId;
          if (activeProviderId && activeProviderId !== 'openai') {
            const state = getStore();
            if (state.authError?.providerId === 'openai') {
              state.clearAuthError();
            }
            logger.warn('Ignoring OpenAI auth error while a different provider is active', {
              activeProviderId,
              message: data.message,
            });
            return;
          }
        } catch (error) {
          logger.warn('Failed to verify active provider before auth error toast', error);
        }
      }

      getStore().setAuthError(data);
    })();
  });

  window.nestcafe.onDaemonReconnected(() => {
    const state = getStore();
    void state.loadTasks();
    if (state.currentTask?.id) {
      void state.loadTaskById(state.currentTask.id);
    }
  });

  window.nestcafe.onWorkspaceChanged?.(async () => {
    const state = getStore();
    state.reset();
    try {
      await state.loadTasks();
    } catch (err) {
      logger.error('Failed to load tasks after workspace change:', err);
      return;
    }
    const tasks = getStore().tasks;
    if (tasks.length > 0) {
      window.location.hash = `#/execution/${tasks[0].id}`;
    } else {
      window.location.hash = '#/';
    }
  });
}
