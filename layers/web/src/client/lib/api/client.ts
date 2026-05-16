/**
 * NestCafe API — Runtime client that wraps the Electron preload bridge.
 *
 * Provides type-safe access to the nestcafe API exposed by the
 * preload script via contextBridge, plus convenience helpers.
 */
import type { ApiKeyConfig, BedrockCredentials, VertexCredentials } from '@nestcafe_ai/agent-core';
import type {
  GoogleAccount,
  GoogleAccountStatus,
} from '@nestcafe_ai/agent-core/common';
import type { NestCafeAPI } from './types';

export function getNestCafe() {
  if (!window.nestcafe) {
    throw new Error('NestCafe API not available - not running in Electron');
  }
  return {
    ...window.nestcafe,

    validateBedrockCredentials: async (
      credentials: BedrockCredentials,
    ): Promise<{ valid: boolean; error?: string }> => {
      return window.nestcafe!.validateBedrockCredentials(JSON.stringify(credentials));
    },

    saveBedrockCredentials: async (credentials: BedrockCredentials): Promise<ApiKeyConfig> => {
      return window.nestcafe!.saveBedrockCredentials(JSON.stringify(credentials));
    },

    getBedrockCredentials: async (): Promise<BedrockCredentials | null> => {
      return window.nestcafe!.getBedrockCredentials();
    },

    fetchBedrockModels: (credentials: string) => window.nestcafe!.fetchBedrockModels(credentials),

    validateVertexCredentials: async (
      credentials: VertexCredentials,
    ): Promise<{ valid: boolean; error?: string }> => {
      return window.nestcafe!.validateVertexCredentials(JSON.stringify(credentials));
    },

    saveVertexCredentials: async (credentials: VertexCredentials): Promise<ApiKeyConfig> => {
      return window.nestcafe!.saveVertexCredentials(JSON.stringify(credentials));
    },

    getVertexCredentials: async (): Promise<VertexCredentials | null> => {
      return window.nestcafe!.getVertexCredentials();
    },

    fetchVertexModels: (credentials: string) => window.nestcafe!.fetchVertexModels(credentials),

    detectVertexProject: () => window.nestcafe!.detectVertexProject(),

    listVertexProjects: () => window.nestcafe!.listVertexProjects(),

    listHuggingFaceModels: () => window.nestcafe!.listHuggingFaceModels(),

    downloadHuggingFaceModel: (modelId: string) =>
      window.nestcafe!.downloadHuggingFaceModel(modelId),

    startHuggingFaceServer: (modelId: string) => window.nestcafe!.startHuggingFaceServer(modelId),

    stopHuggingFaceServer: () => window.nestcafe!.stopHuggingFaceServer(),

    onHuggingFaceDownloadProgress: (
      callback: (progress: {
        modelId: string;
        status: 'downloading' | 'complete' | 'error';
        progress: number;
        error?: string;
      }) => void,
    ) => window.nestcafe!.onHuggingFaceDownloadProgress(callback),

    // Google Workspace flat helpers — delegate to the gws namespace
    gwsListAccounts: (): Promise<GoogleAccount[]> => {
      if (!window.nestcafe?.gws) {
        return Promise.reject(new Error('GWS API not available'));
      }
      return window.nestcafe.gws.listAccounts();
    },

    gwsStartAuth: (label: string): Promise<{ state: string; authUrl: string }> => {
      if (!window.nestcafe?.gws) {
        return Promise.reject(new Error('GWS API not available'));
      }
      return window.nestcafe.gws.startAuth(label);
    },

    gwsCompleteAuth: (state: string, code: string): Promise<GoogleAccount> => {
      if (!window.nestcafe?.gws) {
        return Promise.reject(new Error('GWS API not available'));
      }
      return window.nestcafe.gws.completeAuth(state, code);
    },

    gwsRemoveAccount: (id: string): Promise<void> => {
      if (!window.nestcafe?.gws) {
        return Promise.reject(new Error('GWS API not available'));
      }
      return window.nestcafe.gws.removeAccount(id);
    },

    gwsUpdateLabel: (id: string, label: string): Promise<void> => {
      if (!window.nestcafe?.gws) {
        return Promise.reject(new Error('GWS API not available'));
      }
      return window.nestcafe.gws.updateLabel(id, label);
    },

    gwsOnStatusChanged: (cb: (id: string, status: GoogleAccountStatus) => void): (() => void) => {
      if (!window.nestcafe?.gws) {
        throw new Error('GWS API not available');
      }
      return window.nestcafe.gws.onStatusChanged(cb);
    },
  };
}

export function isRunningInElectron(): boolean {
  return window.nestcafeShell?.isElectron === true;
}

export function getShellVersion(): string | null {
  return window.nestcafeShell?.version ?? null;
}

export function getShellPlatform(): string | null {
  return window.nestcafeShell?.platform ?? null;
}

export function useNestCafe(): NestCafeAPI {
  const api = window.nestcafe;
  if (!api) {
    throw new Error('Accomplish API not available - not running in Electron');
  }
  return api;
}
