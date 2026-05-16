import type { StoredFavorite } from '@nestcafe_ai/agent-core';
import { getNestCafe } from '../lib/nestcafe';
import { createLogger } from '../lib/logger';
import { filterVisibleTasks } from '../lib/hiddenTasks';
import type { TaskState } from './taskStore';
import {
  hasTrackedTask,
  hasTaskStateToken,
  clearScopedTaskState,
  clearAllTaskScopedState,
} from './task-state-helpers';

const logger = createLogger('TaskStore');

// Request-token counter to guard against stale loadFavorites responses
let _loadFavoritesToken = 0;

type SetFn = (partial: Partial<TaskState> | ((state: TaskState) => Partial<TaskState>)) => void;
type GetFn = () => TaskState;

/** Task history and favorites slice: loadTasks, loadTaskById, deleteTask, clearHistory, favorites management. */
export function createTaskHistoryActions(set: SetFn, get: GetFn) {
  return {
    loadTasks: async () => {
      const nestcafe = getNestCafe();
      const taskStateToken = get()._taskStateToken;
      let tasks;
      try {
        tasks = await nestcafe.listTasks();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Daemon not bootstrapped') || msg.includes('daemon')) {
          logger.error('Failed to load tasks (daemon unavailable):', err);
          return;
        }
        throw err;
      }
      if (!hasTaskStateToken(get(), taskStateToken)) {
        return;
      }
      set({ tasks: filterVisibleTasks(tasks) });
    },

    loadTaskById: async (taskId: string) => {
      const nestcafe = getNestCafe();
      const currentState = get();
      const taskStateToken = currentState._taskStateToken;
      const requestTrackedTask = hasTrackedTask(currentState, taskId);
      const task = await nestcafe.getTask(taskId);
      const latestState = get();
      if (!hasTaskStateToken(latestState, taskStateToken)) {
        return;
      }
      if (requestTrackedTask && !hasTrackedTask(latestState, taskId)) {
        return;
      }
      set({ currentTask: task, error: task ? null : 'Task not found' });
    },

    deleteTask: async (taskId: string) => {
      const nestcafe = getNestCafe();
      await nestcafe.deleteTask(taskId);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== taskId),
        ...clearScopedTaskState(state, taskId),
      }));
    },

    clearHistory: async () => {
      const nestcafe = getNestCafe();
      await nestcafe.clearTaskHistory();
      set((state) => ({ tasks: [], ...clearAllTaskScopedState(state) }));
    },

    loadFavorites: async () => {
      if (get().favoritesLoaded) {
        return;
      }
      const nestcafe = getNestCafe();
      const token = ++_loadFavoritesToken;
      try {
        const favorites = await nestcafe.listFavorites();
        if (token === _loadFavoritesToken) {
          set({ favorites, favoritesLoaded: true });
        }
      } catch (err) {
        logger.error('Failed to load favorites:', err);
      }
    },

    addFavorite: async (taskId: string) => {
      const nestcafe = getNestCafe();
      ++_loadFavoritesToken;
      const { tasks, currentTask, favorites } = get();
      if (favorites.some((f) => f.taskId === taskId)) {
        return;
      }
      const task = currentTask?.id === taskId ? currentTask : tasks.find((t) => t.id === taskId);
      const entry: StoredFavorite =
        task != null
          ? {
              taskId,
              prompt: task.prompt,
              summary: task.summary,
              favoritedAt: new Date().toISOString(),
            }
          : { taskId, prompt: '', favoritedAt: new Date().toISOString() };
      set({ favorites: [entry, ...favorites] });
      try {
        await nestcafe.addFavorite(taskId);
      } catch {
        set((state) => ({ favorites: state.favorites.filter((f) => f.taskId !== taskId) }));
      }
    },

    removeFavorite: async (taskId: string) => {
      ++_loadFavoritesToken;
      const { favorites } = get();
      const removed = favorites.find((f) => f.taskId === taskId);
      set({ favorites: favorites.filter((f) => f.taskId !== taskId) });
      try {
        const nestcafe = getNestCafe();
        await nestcafe.removeFavorite(taskId);
      } catch {
        if (removed) {
          set((state) => ({
            favorites: [...state.favorites, removed].sort(
              (a, b) => new Date(b.favoritedAt).getTime() - new Date(a.favoritedAt).getTime(),
            ),
          }));
        }
      }
    },
  };
}
