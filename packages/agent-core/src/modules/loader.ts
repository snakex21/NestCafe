import fs from 'node:fs';
import path from 'node:path';
import type { ModuleManifest } from '../common/types/module.js';

/**
 * Discovers modules from the given directories by scanning for manifest.json files.
 * Returns validated (manifest, sourcePath) pairs. Validation errors are logged but
 * do not prevent discovery of other modules.
 */
export interface DiscoveredModule {
  manifest: ModuleManifest;
  sourcePath: string;
  entryPath: string;
}

export function discoverModules(searchDirs: string[]): DiscoveredModule[] {
  const results: DiscoveredModule[] = [];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const moduleDir = path.join(dir, entry.name);
      const manifestPath = path.join(moduleDir, 'manifest.json');

      if (!fs.existsSync(manifestPath)) {
        continue;
      }

      let manifest: ModuleManifest;
      try {
        const raw = fs.readFileSync(manifestPath, 'utf8');
        manifest = JSON.parse(raw) as ModuleManifest;
      } catch (err) {
        console.warn(`[ModuleLoader] Skipping ${moduleDir}: invalid manifest.json (${err})`);
        continue;
      }

      if (!manifest.name || !manifest.entry) {
        console.warn(`[ModuleLoader] Skipping ${moduleDir}: manifest missing required fields (name, entry)`);
        continue;
      }

      const entryPath = path.join(moduleDir, manifest.entry);
      if (!fs.existsSync(entryPath)) {
        console.warn(`[ModuleLoader] Skipping ${moduleDir}: entry file not found (${manifest.entry})`);
        continue;
      }

      results.push({ manifest, sourcePath: moduleDir, entryPath });
    }
  }

  return results;
}

/**
 * Returns default module search directories:
 *   1. <projectRoot>/modules        (dev mode, checked into repo)
 *   2. <userData>/modules           (user-installed modules)
 */
export function getDefaultModuleDirs(projectRoot: string, userDataPath: string): string[] {
  return [path.join(projectRoot, 'modules'), path.join(userDataPath, 'modules')];
}
