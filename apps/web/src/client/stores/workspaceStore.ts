import { create } from 'zustand';
import { createLogger } from '../lib/logger';

const logger = createLogger('WorkspaceStore');
import type {
  Workspace,
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
} from '@nestcafe_ai/agent-core/common';
import { getNestCafe } from '../lib/nestcafe';

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isLoading: boolean;
  isSwitching: boolean;

  loadWorkspaces: () => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  createWorkspace: (input: WorkspaceCreateInput) => Promise<Workspace | null>;
  updateWorkspace: (id: string, input: WorkspaceUpdateInput) => Promise<Workspace | null>;
  deleteWorkspace: (id: string) => Promise<boolean>;
  setActiveWorkspaceId: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  isLoading: false,
  isSwitching: false,

  loadWorkspaces: async () => {
    set({ isLoading: true });
    try {
      const nestcafe = getNestCafe();
      const [workspaces, activeId] = await Promise.all([
        nestcafe.listWorkspaces(),
        nestcafe.getActiveWorkspaceId(),
      ]);
      set({ workspaces, activeWorkspaceId: activeId, isLoading: false });
    } catch (err) {
      logger.error('Failed to load workspaces:', err);
      set({ isLoading: false });
    }
  },

  switchWorkspace: async (id: string) => {
    if (id === get().activeWorkspaceId) {
      return;
    }
    set({ isSwitching: true });
    try {
      const nestcafe = getNestCafe();
      const result = await nestcafe.switchWorkspace(id);
      if (result.success) {
        set({ activeWorkspaceId: id, isSwitching: false });
      } else {
        logger.warn('Workspace switch rejected:', result.reason);
        set({ isSwitching: false });
      }
    } catch (err) {
      logger.error('Failed to switch workspace:', err);
      set({ isSwitching: false });
    }
  },

  createWorkspace: async (input: WorkspaceCreateInput) => {
    try {
      const nestcafe = getNestCafe();
      const workspace = await nestcafe.createWorkspace(input);
      set((state) => ({
        workspaces: [...state.workspaces, workspace],
      }));
      return workspace;
    } catch (err) {
      logger.error('Failed to create workspace:', err);
      return null;
    }
  },

  updateWorkspace: async (id: string, input: WorkspaceUpdateInput) => {
    try {
      const nestcafe = getNestCafe();
      const updated = await nestcafe.updateWorkspace(id, input);
      if (updated) {
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? updated : w)),
        }));
      }
      return updated;
    } catch (err) {
      logger.error('Failed to update workspace:', err);
      return null;
    }
  },

  deleteWorkspace: async (id: string) => {
    try {
      const nestcafe = getNestCafe();
      const deleted = await nestcafe.deleteWorkspace(id);
      if (deleted) {
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== id),
        }));
      }
      return deleted;
    } catch (err) {
      logger.error('Failed to delete workspace:', err);
      return false;
    }
  },

  setActiveWorkspaceId: (id: string) => {
    set({ activeWorkspaceId: id });
  },
}));

// Subscribe to workspace events
let unsubscribeWorkspaceChanged: (() => void) | undefined;

if (typeof window !== 'undefined' && window.nestcafe) {
  unsubscribeWorkspaceChanged?.();
  const unsub = window.nestcafe.onWorkspaceChanged?.((data: { workspaceId: string }) => {
    useWorkspaceStore.getState().setActiveWorkspaceId(data.workspaceId);
  });
  if (unsub) {
    unsubscribeWorkspaceChanged = unsub;
  }
}

import.meta.hot?.dispose(() => {
  unsubscribeWorkspaceChanged?.();
  unsubscribeWorkspaceChanged = undefined;
});
