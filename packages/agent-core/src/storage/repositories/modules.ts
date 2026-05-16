import { randomUUID } from 'node:crypto';
import type { ModuleManifest, ModuleInstance } from '../../common/types/module.js';
import { getDatabase } from '../database.js';

interface ModuleRow {
  id: string;
  name: string;
  title: string;
  version: string;
  description: string;
  icon: string;
  entry: string;
  manifest_json: string;
  enabled: number;
  installed_at: string;
  source_path: string;
}

function rowToInstance(row: ModuleRow): ModuleInstance {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    version: row.version,
    description: row.description,
    icon: row.icon,
    entry: row.entry,
    manifestJson: row.manifest_json,
    enabled: row.enabled === 1,
    installedAt: row.installed_at,
    sourcePath: row.source_path,
  };
}

export function listModules(): ModuleInstance[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM modules ORDER BY installed_at DESC').all() as ModuleRow[];
  return rows.map(rowToInstance);
}

export function getModule(id: string): ModuleInstance | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM modules WHERE id = ?').get(id) as ModuleRow | undefined;
  return row ? rowToInstance(row) : undefined;
}

export function getModuleByName(name: string): ModuleInstance | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM modules WHERE name = ?').get(name) as ModuleRow | undefined;
  return row ? rowToInstance(row) : undefined;
}

export function installModule(
  manifest: ModuleManifest,
  sourcePath: string,
  entryPath: string,
): ModuleInstance {
  const db = getDatabase();
  const existing = getModuleByName(manifest.name);
  const id = existing?.id ?? randomUUID();
  const installedAt = new Date().toISOString();
  const manifestJson = JSON.stringify(manifest);

  if (existing) {
    db.prepare(
      `UPDATE modules
       SET title = ?, version = ?, description = ?, icon = ?, entry = ?, manifest_json = ?, enabled = 1, installed_at = ?, source_path = ?
       WHERE id = ?`,
    ).run(
      manifest.title,
      manifest.version,
      manifest.description,
      manifest.icon,
      entryPath,
      manifestJson,
      installedAt,
      sourcePath,
      id,
    );
  } else {
    db.prepare(
      `INSERT INTO modules (id, name, title, version, description, icon, entry, manifest_json, enabled, installed_at, source_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).run(
      id,
      manifest.name,
      manifest.title,
      manifest.version,
      manifest.description,
      manifest.icon,
      entryPath,
      manifestJson,
      installedAt,
      sourcePath,
    );
  }

  return {
    id,
    name: manifest.name,
    title: manifest.title,
    version: manifest.version,
    description: manifest.description,
    icon: manifest.icon,
    entry: entryPath,
    manifestJson,
    enabled: true,
    installedAt,
    sourcePath,
  };
}

export function enableModule(id: string, enabled: boolean): void {
  const db = getDatabase();
  db.prepare('UPDATE modules SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
}

export function uninstallModule(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM modules WHERE id = ?').run(id);
}

export function getModuleSetting(moduleId: string, key: string): string | undefined {
  const db = getDatabase();
  const row = db
    .prepare('SELECT value FROM module_settings WHERE module_id = ? AND key = ?')
    .get(moduleId, key) as { value: string } | undefined;
  return row?.value;
}

export function setModuleSetting(moduleId: string, key: string, value: string): void {
  const db = getDatabase();
  db.prepare('INSERT OR REPLACE INTO module_settings (module_id, key, value) VALUES (?, ?, ?)').run(
    moduleId,
    key,
    value,
  );
}

export function deleteModuleSetting(moduleId: string, key: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM module_settings WHERE module_id = ? AND key = ?').run(moduleId, key);
}

export function getModuleSettings(moduleId: string): Record<string, string> {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT key, value FROM module_settings WHERE module_id = ?')
    .all(moduleId) as Array<{ key: string; value: string }>;

  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}
