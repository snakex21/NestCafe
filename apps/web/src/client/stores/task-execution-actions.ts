import {
  createMessageId,
  type TaskConfig,
  type Task,
  type TaskStatus,
  type FileAttachmentInfo,
} from '@nestcafe_ai/agent-core/common';
import { getNestCafe } from '../lib/nestcafe';
import type { TaskState } from './taskStore';
import { hasTaskStateToken } from './task-state-helpers';
import { createTaskPermissionActions } from './task-permission-actions';
import { createTaskUpdateActions } from './task-update-actions';
import { createTaskLifecycleActions } from './task-lifecycle-actions';

type SetFn = (partial: Partial<TaskState> | ((state: TaskState) => Partial<TaskState>)) => void;
type GetFn = () => TaskState;

function buildHistoricalFollowUpPrompt(task: Task, message: string): string {
  const history = task.messages
    .slice(-12)
    .map((item) => `${item.type.toUpperCase()}: ${item.content}`)
    .join('\n\n');

  return [
    'Continue this historical conversation. The original runtime session is not available, so use the transcript below as context.',
    '',
    `Original task: ${task.prompt}`,
    '',
    'Conversation transcript:',
    history || '(no saved messages)',
    '',
    `User follow-up: ${message}`,
  ].join('\n');
}

/** Task execution slice: startTask, sendFollowUp, permission handling. */
export function createTaskExecutionActions(set: SetFn, get: GetFn) {
  return {
    startTask: async (config: TaskConfig): Promise<Task | null> => {
      const nestcafe = getNestCafe();
      const taskStateToken = get()._taskStateToken;
      set({ isLoading: true, error: null });
      try {
        void nestcafe.logEvent({
          level: 'info',
          message: 'UI start task',
          context: { prompt: config.prompt, taskId: config.taskId, files: config.files?.length },
        });
        // Analytics: track task submission from UI
        const task = await nestcafe.startTask(config);
        const currentState = get();
        if (!hasTaskStateToken(currentState, taskStateToken)) {
          return null;
        }
        const currentTasks = currentState.tasks;
        set({
          currentTask: task,
          tasks: [task, ...currentTasks.filter((t) => t.id !== task.id)],
          isLoading: task.status === 'queued',
        });
        void nestcafe.logEvent({
          level: 'info',
          message: task.status === 'queued' ? 'UI task queued' : 'UI task started',
          context: { taskId: task.id, status: task.status },
        });
        return task;
      } catch (err) {
        if (!hasTaskStateToken(get(), taskStateToken)) {
          return null;
        }
        set({
          error: err instanceof Error ? err.message : 'Failed to start task',
          isLoading: false,
        });
        void nestcafe.logEvent({
          level: 'error',
          message: 'UI task start failed',
          context: { error: err instanceof Error ? err.message : String(err) },
        });
        return null;
      }
    },

    sendFollowUp: async (message: string, attachments?: FileAttachmentInfo[]): Promise<boolean> => {
      const nestcafe = getNestCafe();
      const { currentTask, startTask, autoApprovePermissions } = get();
      const taskStateToken = get()._taskStateToken;
      if (!currentTask) {
        set({ error: 'No active task to continue' });
        void nestcafe.logEvent({ level: 'warn', message: 'UI follow-up failed: no active task' });
        return false;
      }
      const sessionId = currentTask.result?.sessionId || currentTask.sessionId;
      if (!sessionId) {
        void nestcafe.logEvent({
          level: 'info',
          message: 'UI follow-up: starting fresh task (no resumable session)',
          context: { taskId: currentTask.id },
        });
        const prompt =
          currentTask.status === 'interrupted'
            ? message
            : buildHistoricalFollowUpPrompt(currentTask, message);
        const newTask = await startTask({ prompt, files: attachments });
        return newTask !== null;
      }
      const userMessage = {
        id: createMessageId(),
        type: 'user' as const,
        content: message,
        timestamp: new Date().toISOString(),
        attachments: attachments
          ? attachments.map((a) => ({ type: 'json' as const, data: 'placeholder', label: a.name }))
          : undefined,
      };
      const taskId = currentTask.id;
      set((state) => ({
        isLoading: true,
        error: null,
        currentTask: state.currentTask
          ? {
              ...state.currentTask,
              status: 'running',
              result: undefined,
              messages: [...state.currentTask.messages, userMessage],
            }
          : null,
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, status: 'running' as TaskStatus } : t,
        ),
      }));
      try {
        void nestcafe.logEvent({
          level: 'info',
          message: 'UI follow-up sent',
          context: { taskId: currentTask.id, message, attachments: attachments?.length },
        });
        const task = await nestcafe.resumeSession(
          sessionId,
          message,
          currentTask.id,
          attachments,
          autoApprovePermissions,
        );
        if (!hasTaskStateToken(get(), taskStateToken)) {
          return false;
        }
        set((state) => ({
          currentTask: state.currentTask ? { ...state.currentTask, status: task.status } : null,
          isLoading: task.status === 'queued',
          tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status: task.status } : t)),
        }));
        return true;
      } catch (err) {
        if (!hasTaskStateToken(get(), taskStateToken)) {
          return false;
        }
        set((state) => ({
          error: err instanceof Error ? err.message : 'Failed to send message',
          isLoading: false,
          currentTask: state.currentTask ? { ...state.currentTask, status: 'failed' } : null,
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, status: 'failed' as TaskStatus } : t,
          ),
        }));
        void nestcafe.logEvent({
          level: 'error',
          message: 'UI follow-up failed',
          context: {
            taskId: currentTask.id,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        return false;
      }
    },

    rerunFromMessage: async (messageId: string, content: string): Promise<boolean> => {
      const nestcafe = getNestCafe();
      const { currentTask, autoApprovePermissions } = get();
      const taskStateToken = get()._taskStateToken;
      if (!currentTask) {
        set({ error: 'No active task to rerun' });
        return false;
      }

      const messageIndex = currentTask.messages.findIndex((message) => message.id === messageId);
      if (messageIndex === -1) {
        set({ error: 'Message not found' });
        return false;
      }

      const editedMessage = {
        ...currentTask.messages[messageIndex],
        content,
        timestamp: new Date().toISOString(),
      };
      const originalContent = currentTask.messages[messageIndex].content;
      const messages = [...currentTask.messages.slice(0, messageIndex), editedMessage];
      set((state) => ({
        isLoading: true,
        error: null,
        currentTask: state.currentTask
          ? { ...state.currentTask, status: 'running' as TaskStatus, messages }
          : null,
        tasks: state.tasks.map((task) =>
          task.id === currentTask.id
            ? { ...task, status: 'running' as TaskStatus, messages }
            : task,
        ),
      }));

      try {
        const task = await nestcafe.rerunTaskFromMessage(
          currentTask.id,
          messageId,
          content,
          originalContent,
          autoApprovePermissions,
        );
        if (!hasTaskStateToken(get(), taskStateToken)) {
          return false;
        }
        set((state) => ({
          currentTask: { ...task, messages: task.messages },
          tasks: state.tasks.map((existing) => (existing.id === task.id ? task : existing)),
          isLoading: task.status === 'queued',
        }));
        return true;
      } catch (err) {
        if (!hasTaskStateToken(get(), taskStateToken)) {
          return false;
        }
        set({
          error: err instanceof Error ? err.message : 'Failed to rerun message',
          isLoading: false,
        });
        return false;
      }
    },

    ...createTaskLifecycleActions(set, get),
    ...createTaskPermissionActions(set, get),
    ...createTaskUpdateActions(set, get),
  };
}
