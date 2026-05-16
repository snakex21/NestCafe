import {
  validate,
  permissionResponseSchema,
  resumeSessionSchema,
} from '@nestcafe_ai/agent-core';
import { safeHandler, taskIdSchema, taskRerunFromMessageSchema, taskStartSchema } from './index.js';
import type { DaemonRpcServer } from '@nestcafe_ai/agent-core';
import type { TaskService } from '../tasks/index.js';
import type { HealthService } from '../health.js';
import type { StorageAPI } from '@nestcafe_ai/agent-core';

export function registerTaskRoutes(services: {
  rpc: DaemonRpcServer;
  taskService: TaskService;
  healthService: HealthService;
  storage: StorageAPI;
}): void {
  const { rpc, taskService, healthService, storage } = services;

  rpc.registerMethod(
    'task.start',
    safeHandler((params) => {
      const validated = validate(taskStartSchema, params);
      return taskService.startTask(validated);
    }),
  );
  rpc.registerMethod(
    'task.stop',
    safeHandler((params) => {
      const validated = validate(taskIdSchema, params);
      return taskService.stopTask(validated);
    }),
  );
  rpc.registerMethod(
    'task.list',
    safeHandler((params) => {
      const raw =
        params && typeof params === 'object' && 'workspaceId' in params
          ? (params as { workspaceId?: unknown }).workspaceId
          : undefined;
      const workspaceId = typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined;
      const includeUnassigned =
        params && typeof params === 'object' && 'includeUnassigned' in params
          ? (params as { includeUnassigned?: unknown }).includeUnassigned === true
          : false;
      return Promise.resolve(taskService.listTasks(workspaceId, includeUnassigned));
    }),
  );
  rpc.registerMethod(
    'task.status',
    safeHandler((params) => {
      const validated = validate(taskIdSchema, params);
      return Promise.resolve(taskService.getTaskStatus(validated));
    }),
  );
  rpc.registerMethod(
    'task.rerunFromMessage',
    safeHandler((params) => {
      const validated = validate(taskRerunFromMessageSchema, params);
      return taskService.rerunFromMessage(validated);
    }),
  );
  rpc.registerMethod(
    'task.interrupt',
    safeHandler((params) => {
      const validated = validate(taskIdSchema, params);
      return taskService.interruptTask(validated);
    }),
  );
  rpc.registerMethod(
    'task.get',
    safeHandler((params) => {
      const validated = validate(taskIdSchema, params);
      return Promise.resolve(storage.getTask(validated.taskId) || null);
    }),
  );
  rpc.registerMethod(
    'task.delete',
    safeHandler(async (params) => {
      const validated = validate(taskIdSchema, params);
      if (taskService.hasActiveTask(validated.taskId)) {
        await taskService.stopTask({ taskId: validated.taskId });
      }
      storage.deleteTask(validated.taskId);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'task.clearHistory',
    safeHandler(() => {
      if (taskService.getActiveTaskCount() > 0) {
        throw new Error('Cannot clear history while tasks are active or queued');
      }
      storage.clearHistory();
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'task.getTodos',
    safeHandler((params) => {
      const validated = validate(taskIdSchema, params);
      return Promise.resolve(storage.getTodosForTask(validated.taskId));
    }),
  );
  rpc.registerMethod(
    'permission.respond',
    // Rewritten in Phase 2 of the SDK cutover port (commercial PR #720).
    //
    // Pre-port: resolved an in-memory promise map held by `PermissionService`;
    // the HTTP handler awaiting the promise returned the decision back to
    // the `opencode` CLI over its /permission or /question callback.
    //
    // Post-port: `PermissionService` is deleted. The daemon forwards the
    // structured response directly to `TaskService.sendResponse`, which
    // routes to `TaskManager.sendResponse` → `OpenCodeAdapter.sendResponse` →
    // `client.permission.reply` / `client.question.reply` on the SDK v2
    // client. The `taskId` field was added to `permissionResponseSchema`
    // specifically for this routing — without it the daemon cannot scope
    // the reply to a specific in-flight task.
    safeHandler(async (params) => {
      const validated = validate(permissionResponseSchema, params);
      const { taskId, requestId, decision, selectedOptions, customText } = validated;
      // Defensive taskId check. Without it, a bogus taskId (stale UI,
      // double-click, replay of a cancelled task) cascades an error from
      // deep inside `OpenCodeAdapter.sendResponse` (`pending` is null, or
      // the adapter doesn't exist), producing a confusing stack trace
      // rather than a clean "unknown task" RPC error.
      if (!taskService.hasActiveTask(taskId)) {
        throw new Error(
          `permission.respond: no active task with id=${taskId}. The task may have completed, been cancelled, or never existed.`,
        );
      }
      await taskService.sendResponse(taskId, {
        requestId,
        taskId,
        decision,
        ...(selectedOptions ? { selectedOptions } : {}),
        ...(customText ? { customText } : {}),
      });
    }),
  );
  rpc.registerMethod(
    'session.resume',
    safeHandler((params) => {
      const validated = validate(resumeSessionSchema, params);
      return taskService.resumeSession(validated);
    }),
  );
  rpc.registerMethod(
    'health.check',
    safeHandler(() => Promise.resolve(healthService.getStatus())),
  );

  // Alias: desktop IPC uses 'task.cancel', daemon-routes registers 'task.stop'
  rpc.registerMethod(
    'task.cancel',
    safeHandler((params) => {
      const validated = validate(taskIdSchema, params);
      return taskService.stopTask(validated);
    }),
  );

  rpc.registerMethod(
    'task.getActiveCount',
    safeHandler(() => Promise.resolve(taskService.getActiveTaskCount())),
  );
}
