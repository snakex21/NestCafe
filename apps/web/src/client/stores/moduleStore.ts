import { create } from 'zustand';
import type { ModuleInstance } from '@nestcafe_ai/agent-core';
import { getNestCafe } from '../lib/nestcafe';

interface ModuleState {
  modules: ModuleInstance[];
  installedModules: ModuleInstance[];
  activeModuleId: string | null;
  isLoading: boolean;

  loadModules: () => Promise<void>;
  discoverModules: () => Promise<
    Array<{
      name: string;
      title: string;
      version: string;
      description: string;
      sourcePath: string;
      alreadyInstalled: boolean;
    }>
  >;
  installModule: (sourcePath: string) => Promise<ModuleInstance | null>;
  enableModule: (id: string, enabled: boolean) => Promise<void>;
  uninstallModule: (id: string) => Promise<void>;
  setActiveModule: (id: string | null) => void;
}

export const useModuleStore = create<ModuleState>((set, get) => ({
  modules: [],
  installedModules: [],
  activeModuleId: null,
  isLoading: false,

  loadModules: async () => {
    set({ isLoading: true });
    try {
      const nestcafe = getNestCafe();
      const list = (await nestcafe.listModules()) as ModuleInstance[];
      const enabled = list.filter((m) => m.enabled);
      set({ modules: list, installedModules: enabled, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  discoverModules: async () => {
    const nestcafe = getNestCafe();
    return (await nestcafe.discoverModules()) as Array<{
      name: string;
      title: string;
      version: string;
      description: string;
      sourcePath: string;
      alreadyInstalled: boolean;
    }>;
  },

  installModule: async (sourcePath: string) => {
    const nestcafe = getNestCafe();
    const mod = (await nestcafe.installModule(sourcePath)) as ModuleInstance;
    if (mod) {
      set((s) => ({
        modules: [...s.modules.filter((m) => m.name !== mod.name), mod],
        installedModules: [...s.installedModules.filter((m) => m.name !== mod.name), mod],
      }));
    }
    return mod;
  },

  enableModule: async (id: string, enabled: boolean) => {
    const nestcafe = getNestCafe();
    await nestcafe.enableModule(id, enabled);
    const { modules } = get();
    const updated = modules.map((m) => (m.id === id ? { ...m, enabled } : m));
    const enabledList = updated.filter((m) => m.enabled);
    set({ modules: updated, installedModules: enabledList });
  },

  uninstallModule: async (id: string) => {
    const nestcafe = getNestCafe();
    await nestcafe.uninstallModule(id);
    const { modules } = get();
    const updated = modules.filter((m) => m.id !== id);
    set({ modules: updated, installedModules: updated.filter((m) => m.enabled) });
  },

  setActiveModule: (id: string | null) => {
    set({ activeModuleId: id });
  },
}));
