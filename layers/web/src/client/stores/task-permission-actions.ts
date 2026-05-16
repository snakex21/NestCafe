import type { PermissionRequest, PermissionResponse } from '@nestcafe_ai/agent-core/common';
import { getNestCafe } from '../lib/nestcafe';
import type { TaskState } from './taskStore';
import { hasTaskStateToken } from './task-state-helpers';

type SetFn = (partial: Partial<TaskState> | ((state: TaskState) => Partial<TaskState>)) => void;
type GetFn = () => TaskState;

/** Permission request/response slice of the task store. */
export function createTaskPermissionActions(set: SetFn, get: GetFn) {
  return {
    setPermissionRequest: (request: PermissionRequest) => {
      if (get().autoApprovePermissions && request.type !== 'question') {
        const nestcafe = getNestCafe();
        void nestcafe
          .respondToPermission({
            requestId: request.id,
            taskId: request.taskId,
            decision: 'allow',
          })
          .catch((err: unknown) => {
            set((state) => ({
              permissionRequests: { ...state.permissionRequests, [request.taskId]: request },
              error: err instanceof Error ? err.message : 'Failed to auto-approve permission',
            }));
          });
        return;
      }
      set((state) => ({
        permissionRequests: { ...state.permissionRequests, [request.taskId]: request },
      }));
    },

    clearPermissionRequest: (taskId: string) => {
      set((state) => {
        const { [taskId]: _, ...rest } = state.permissionRequests;
        return { permissionRequests: rest };
      });
    },

    respondToPermission: async (response: PermissionResponse) => {
      const nestcafe = getNestCafe();
      const taskStateToken = get()._taskStateToken;
      // Save the requestId before the await to detect if a newer request arrived
      const requestId = response.requestId;
      void nestcafe.logEvent({
        level: 'info',
        message: 'UI permission response',
        context: { ...response },
      });
      await nestcafe.respondToPermission(response);
      if (!hasTaskStateToken(get(), taskStateToken)) {
        return;
      }
      set((state) => {
        const existingRequest = state.permissionRequests[response.taskId];
        // Only clear if the stored request still matches the one we responded to
        if (!existingRequest || existingRequest.id !== requestId) {
          return state;
        }
        const { [response.taskId]: _, ...rest } = state.permissionRequests;
        return { permissionRequests: rest };
      });
    },
  };
}
