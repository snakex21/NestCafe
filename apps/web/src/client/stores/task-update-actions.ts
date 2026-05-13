import type { TaskStatus, TaskUpdateEvent, TaskMessage } from '@nestcafe_ai/agent-core';
import { upsertTaskMessages } from '@nestcafe_ai/agent-core';
import { getNestCafe } from '../lib/nestcafe';
import {
  buildMemoryManagerPrompt,
  dispatchMemoryNotification,
  isAutoMemoryEnabled,
  parseMemoryReport,
} from '../lib/autoMemory';
import { isHiddenBackgroundTask } from '../lib/hiddenTasks';
import type { TaskState } from './taskStore';

type SetFn = (partial: Partial<TaskState> | ((state: TaskState) => Partial<TaskState>)) => void;
type GetFn = () => TaskState;

const memoryExtractionQueued = new Set<string>();

async function waitForMemoryTask(taskId: string): Promise<void> {
  const nestcafe = getNestCafe();
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const task = await nestcafe.getTask(taskId);
    if (!task) {
      return;
    }
    if (['completed', 'failed', 'cancelled', 'interrupted'].includes(task.status)) {
      const facts = parseMemoryReport(task);
      dispatchMemoryNotification({ sourceTaskId: taskId, facts });
      return;
    }
  }
}

async function queueMemoryExtraction(taskId: string): Promise<void> {
  if (memoryExtractionQueued.has(taskId) || !isAutoMemoryEnabled()) {
    return;
  }
  memoryExtractionQueued.add(taskId);

  try {
    const nestcafe = getNestCafe();
    const task = await nestcafe.getTask(taskId);
    if (!task || isHiddenBackgroundTask(task) || task.status !== 'completed') {
      return;
    }

    const memoryTask = await nestcafe.startTask({
      taskId: `memory_${Date.now()}_${taskId}`,
      prompt: buildMemoryManagerPrompt(task),
      autoApprovePermissions: true,
    });
    void waitForMemoryTask(memoryTask.id);
  } catch {
    // Silent by design — memory extraction must never block normal chat UX.
  }
}

/** Task update event handling slice of the task store. */
export function createTaskUpdateActions(set: SetFn, _get: GetFn) {
  return {
    addTaskUpdate: (event: TaskUpdateEvent) => {
      const nestcafe = getNestCafe();
      void nestcafe.logEvent({
        level: 'debug',
        message: 'UI task update received',
        context: { ...event },
      });
      set((state) => {
        const isCurrentTask = state.currentTask?.id === event.taskId;
        let updatedCurrentTask = state.currentTask;
        let updatedTasks = state.tasks;
        let newStatus: TaskStatus | null = null;
        if (event.type === 'message' && event.message && isCurrentTask && state.currentTask) {
          // Phase 1c of the SDK cutover port — merge by stable ID so a tool
          // row's `{ toolStatus: 'running' }` followed by
          // `{ toolStatus: 'completed' }` (same id) collapses into ONE row,
          // not two. Before this, raw append produced duplicate bubbles on
          // every tool-state transition.
          updatedCurrentTask = {
            ...state.currentTask,
            messages: upsertTaskMessages(state.currentTask.messages, [event.message]),
          };
        }
        if (event.type === 'complete' && event.result) {
          if (event.result.status === 'success') {
            newStatus = 'completed';
            void queueMemoryExtraction(event.taskId);
          } else if (event.result.status === 'interrupted') {
            newStatus = 'interrupted';
          } else {
            newStatus = 'failed';
          }
          if (isCurrentTask && state.currentTask) {
            updatedCurrentTask = {
              ...state.currentTask,
              status: newStatus,
              result: event.result,
              completedAt: newStatus === 'interrupted' ? undefined : new Date().toISOString(),
              sessionId: event.result.sessionId || state.currentTask.sessionId,
            };
          }
        }
        if (event.type === 'error') {
          newStatus = 'failed';
          if (isCurrentTask && state.currentTask) {
            updatedCurrentTask = {
              ...state.currentTask,
              status: newStatus,
              result: { status: 'error', error: event.error },
            };
          }
        }
        if (newStatus) {
          const finalStatus = newStatus;
          updatedTasks = state.tasks.map((t) => {
            if (t.id !== event.taskId) return t;
            const taskUpdate: Partial<typeof t> = { status: finalStatus };
            if (isCurrentTask && updatedCurrentTask) {
              // Keep tasks array in sync with currentTask for terminal fields
              taskUpdate.messages = updatedCurrentTask.messages;
              if ('result' in updatedCurrentTask) taskUpdate.result = updatedCurrentTask.result;
              if ('sessionId' in updatedCurrentTask && updatedCurrentTask.sessionId != null) {
                taskUpdate.sessionId = updatedCurrentTask.sessionId;
              }
              if ('completedAt' in updatedCurrentTask && updatedCurrentTask.completedAt != null) {
                taskUpdate.completedAt = updatedCurrentTask.completedAt;
              }
            }
            return { ...t, ...taskUpdate };
          });
        }
        let shouldClearTodos = false;
        if (
          (event.type === 'complete' || event.type === 'error') &&
          state.todosTaskId === event.taskId
        ) {
          const isInterrupted = event.type === 'complete' && event.result?.status === 'interrupted';
          shouldClearTodos = !isInterrupted;
        }
        // Only clear isLoading when the event is for the currently active task
        // Also clear isLoading when the task transitions out of 'queued'
        const wasQueued =
          state.currentTask?.id === event.taskId && state.currentTask?.status === 'queued';
        const shouldClearLoading = isCurrentTask && (newStatus !== null || wasQueued);
        return {
          currentTask: updatedCurrentTask,
          tasks: updatedTasks,
          ...(shouldClearLoading ? { isLoading: false } : {}),
          ...(shouldClearTodos ? { todos: [], todosTaskId: null } : {}),
        };
      });
    },

    addTaskUpdateBatch: (event: { taskId: string; messages: TaskMessage[] }) => {
      const nestcafe = getNestCafe();
      void nestcafe.logEvent({
        level: 'debug',
        message: 'UI task batch update received',
        context: { taskId: event.taskId, messageCount: event.messages.length },
      });
      set((state) => {
        if (!state.currentTask || state.currentTask.id !== event.taskId) {
          return state;
        }
        // Merge-by-stable-id for the batch path, same reason as the
        // single-message branch above.
        const updatedMessages = upsertTaskMessages(state.currentTask.messages, event.messages);
        const updatedTask = {
          ...state.currentTask,
          messages: updatedMessages,
        };
        // Keep tasks array in sync with currentTask batch messages
        const updatedTasks = state.tasks.map((t) =>
          t.id === event.taskId ? { ...t, messages: updatedMessages } : t,
        );
        return { currentTask: updatedTask, tasks: updatedTasks, isLoading: false };
      });
    },

    updateTaskStatus: (taskId: string, status: TaskStatus) => {
      const isTerminal = ['completed', 'failed', 'cancelled', 'interrupted'].includes(status);
      set((state) => ({
        tasks: state.tasks.map((task) =>
          task.id === taskId ? { ...task, status, updatedAt: new Date().toISOString() } : task,
        ),
        currentTask:
          state.currentTask?.id === taskId
            ? { ...state.currentTask, status, updatedAt: new Date().toISOString() }
            : state.currentTask,
        ...(state.currentTask?.id === taskId && (isTerminal || status !== 'queued')
          ? { isLoading: false }
          : {}),
        ...(state.todosTaskId === taskId && status !== 'interrupted'
          ? { todos: [], todosTaskId: null }
          : {}),
      }));
    },

    setTaskSummary: (taskId: string, summary: string) => {
      set((state) => ({
        tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, summary } : task)),
        currentTask:
          state.currentTask?.id === taskId ? { ...state.currentTask, summary } : state.currentTask,
      }));
    },
  };
}
