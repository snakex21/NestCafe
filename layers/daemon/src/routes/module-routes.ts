import { validate } from '@nestcafe_ai/agent-core';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import {
  safeHandler,
  getModuleSearchDirs,
  installDiscoveredModule,
  ensureBundledModulesInstalled,
  sanitizeOcrSettingsForRpc,
} from './index.js';
import { discoverModules } from '@nestcafe_ai/agent-core/modules/loader';
import type { DaemonRpcServer, StorageAPI } from '@nestcafe_ai/agent-core';
import type { StorageService } from '../storage/index.js';

export function registerModuleRoutes(services: {
  rpc: DaemonRpcServer;
  storage: StorageAPI;
  storageService: StorageService;
  resourcesPath?: string;
}): void {
  const { rpc, storage, storageService, resourcesPath } = services;

  rpc.registerMethod(
    'module.list',
    safeHandler(async () => {
      ensureBundledModulesInstalled(storage, resourcesPath);
      return storage.listModules();
    }),
  );

  rpc.registerMethod(
    'module.get',
    safeHandler(async (params) => {
      const v = validate(z.object({ id: z.string().min(1) }), params);
      return storage.getModule(v.id) || null;
    }),
  );

  rpc.registerMethod(
    'module.install',
    safeHandler(async (params) => {
      const v = validate(z.object({ sourcePath: z.string().min(1) }), params);
      return installDiscoveredModule(storage, v.sourcePath);
    }),
  );

  rpc.registerMethod(
    'module.enable',
    safeHandler(async (params) => {
      const v = validate(z.object({ id: z.string().min(1), enabled: z.boolean() }), params);
      storage.enableModule(v.id, v.enabled);
    }),
  );

  rpc.registerMethod(
    'module.uninstall',
    safeHandler(async (params) => {
      const v = validate(z.object({ id: z.string().min(1) }), params);
      storage.uninstallModule(v.id);
    }),
  );

  rpc.registerMethod(
    'module.getSettings',
    safeHandler(async (params) => {
      const v = validate(z.object({ moduleId: z.string().min(1) }), params);
      const settings = storage.getModuleSettings(v.moduleId);
      const hasSavedDocs = Object.keys(settings).some((key) => key.startsWith('doc_'));
      const mod = storage.getModule(v.moduleId);

      if (mod?.name === 'ocr-viewer' && !hasSavedDocs) {
        const db = storageService.getRawDatabase();
        const rows = db
          .prepare(
            `SELECT key, value
             FROM module_settings
             WHERE module_id <> ?
               AND (key = 'model' OR key = 'lang' OR key LIKE 'doc_%')
             ORDER BY rowid ASC`,
          )
          .all(v.moduleId) as Array<{ key: string; value: string }>;

        for (const row of rows) {
          if (!row.value) {
            continue;
          }
          if (row.key.startsWith('doc_')) {
            try {
              const parsed = JSON.parse(row.value) as { name?: string; text?: string };
              if (!parsed.name || !parsed.text) {
                continue;
              }
            } catch {
              continue;
            }
          }
          if (!(row.key in settings)) {
            settings[row.key] = row.value;
            storage.setModuleSetting(v.moduleId, row.key, row.value);
          }
        }
      }

      if (mod?.name === 'ocr-viewer') {
        return sanitizeOcrSettingsForRpc(settings, storage, v.moduleId);
      }

      return settings;
    }),
  );

  rpc.registerMethod(
    'module.getSetting',
    safeHandler(async (params) => {
      const v = validate(z.object({ moduleId: z.string().min(1), key: z.string() }), params);
      return storage.getModuleSetting(v.moduleId, v.key) ?? null;
    }),
  );

  rpc.registerMethod(
    'module.setSetting',
    safeHandler(async (params) => {
      const v = validate(
        z.object({ moduleId: z.string().min(1), key: z.string(), value: z.string() }),
        params,
      );
      storage.setModuleSetting(v.moduleId, v.key, v.value);
    }),
  );

  rpc.registerMethod(
    'module.getSource',
    safeHandler(async (params) => {
      const v = validate(z.object({ id: z.string().min(1) }), params);
      const mod = storage.getModule(v.id);
      if (!mod) {
        throw new Error(`Module not found: ${v.id}`);
      }

      let sourceRoot = path.resolve(mod.sourcePath);
      let entryPath = path.resolve(mod.entry);

      if (!fs.existsSync(entryPath)) {
        const fallback = discoverModules(getModuleSearchDirs(storage, resourcesPath)).find(
          (item) => item.manifest.name === mod.name,
        );
        if (fallback) {
          sourceRoot = path.resolve(fallback.sourcePath);
          entryPath = path.resolve(fallback.entryPath);
        }
      }
      const relativeEntry = path.relative(sourceRoot, entryPath);
      if (relativeEntry.startsWith('..') || path.isAbsolute(relativeEntry)) {
        throw new Error('Module entry is outside its source directory');
      }

      if (!fs.existsSync(entryPath)) {
        throw new Error(`Module entry file not found: ${mod.entry}`);
      }

      const stat = fs.statSync(entryPath);
      if (!stat.isFile()) {
        throw new Error(`Module entry is not a file: ${mod.entry}`);
      }

      if (stat.size > 5 * 1024 * 1024) {
        throw new Error('Module entry is too large');
      }

      return { source: fs.readFileSync(entryPath, 'utf8') };
    }),
  );

  rpc.registerMethod(
    'module.discover',
    safeHandler(async () => {
      ensureBundledModulesInstalled(storage, resourcesPath);
      const dirs = getModuleSearchDirs(storage, resourcesPath);
      return discoverModules(dirs).map((d) => ({
        name: d.manifest.name,
        title: d.manifest.title,
        version: d.manifest.version,
        description: d.manifest.description,
        sourcePath: d.sourcePath,
        alreadyInstalled: !!storage.getModuleByName(d.manifest.name),
      }));
    }),
  );
}
