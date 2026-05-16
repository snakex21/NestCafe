import { validate } from '@nestcafe_ai/agent-core';
import { z } from 'zod';
import { safeHandler } from './index.js';
import type { DaemonRpcServer, StorageAPI } from '@nestcafe_ai/agent-core';
import type { LegacyImportService } from '../storage/index.js';

export function registerSystemRoutes(services: {
  rpc: DaemonRpcServer;
  storage: StorageAPI;
  legacyImportService: LegacyImportService;
}): void {
  const { rpc, storage, legacyImportService } = services;

  // ── Logs (bug-report support) ───────────────────────────────────────────
  // The desktop bug-report handler reads recent task history to attach to
  // the generated report. Exposing it here avoids having the renderer reach
  // into the DB through main after M3.
  rpc.registerMethod(
    'logs.getTasksForBugReport',
    safeHandler(() => Promise.resolve(storage.getTasks())),
  );

  // ── Legacy electron-store import (one-shot, guarded) ─────────────────────
  rpc.registerMethod(
    'legacy.importElectronStoreIfNeeded',
    safeHandler((params) => {
      const v = validate(
        z.object({
          appSettingsPath: z.string().min(1),
          providerSettingsPath: z.string().min(1),
          taskHistoryPath: z.string().min(1),
        }),
        params,
      );
      return Promise.resolve(legacyImportService.importElectronStoreIfNeeded(v));
    }),
  );
}
