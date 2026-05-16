// ============================================================
// Permission handler factory — manages user consent for file
// operations, tool usage, and interactive questions during
// task execution.
// ============================================================

import type { PermissionHandlerAPI } from '../api/index.js';
import type { PermissionRequest, PermissionResponse } from '../types/permission.types.js';
import { generateTypedId } from '../utils/id.js';

export function createPermissionHandler(): PermissionHandlerAPI {
  // Map of request ID to pending request
  const pendingRequests = new Map<string, PermissionRequest>();

  // Map of request ID to resolve function for awaiting responses
  const waiters = new Map<string, (response: PermissionResponse) => void>();

  const api: PermissionHandlerAPI = {
    async requestPermission(request: PermissionRequest): Promise<void> {
      if (!request.id) {
        request.id = generateTypedId('perm');
      }
      if (!request.createdAt) {
        request.createdAt = new Date().toISOString();
      }
      pendingRequests.set(request.id, request);

      // Set up timeout if specified
      if (request.timeoutMs && request.timeoutMs > 0) {
        setTimeout(() => {
          if (pendingRequests.has(request.id)) {
            pendingRequests.delete(request.id);
            const waiter = waiters.get(request.id);
            if (waiter) {
              waiter({
                requestId: request.id,
                taskId: request.taskId,
                decision: 'deny',
                message: 'Permission request timed out',
              });
              waiters.delete(request.id);
            }
          }
        }, request.timeoutMs);
      }
    },

    async getPendingRequests(taskId: string): Promise<PermissionRequest[]> {
      const results: PermissionRequest[] = [];
      for (const req of pendingRequests.values()) {
        if (req.taskId === taskId) {
          results.push(req);
        }
      }
      return results;
    },

    async respond(requestId: string, response: PermissionResponse): Promise<void> {
      pendingRequests.delete(requestId);
      const waiter = waiters.get(requestId);
      if (waiter) {
        waiter(response);
        waiters.delete(requestId);
      }
    },

    async cancelAll(taskId: string): Promise<void> {
      for (const [id, req] of pendingRequests) {
        if (req.taskId === taskId) {
          pendingRequests.delete(id);
          const waiter = waiters.get(id);
          if (waiter) {
            waiter({
              requestId: id,
              taskId,
              decision: 'deny',
              message: 'Task cancelled',
            });
            waiters.delete(id);
          }
        }
      }
    },
  };

  return api;
}
