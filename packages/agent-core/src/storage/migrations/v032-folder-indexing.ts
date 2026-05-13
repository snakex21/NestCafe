import type { Database } from 'better-sqlite3';
import type { Migration } from './index.js';

/**
 * v032 — Add `folder_indexing_config` JSON column to `app_settings`.
 *
 * Stores {@link FolderIndexingConfig} as a JSON text blob. Defaults to
 * `null` (feature off, no paths selected). The repository layer provides
 * a typed getter that falls back to the default config when the column
 * is null.
 */
export const migration: Migration = {
  version: 32,
  up: (db: Database) => {
    const cols = db.prepare('PRAGMA table_info(app_settings)').all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'folder_indexing_config')) {
      db.exec("ALTER TABLE app_settings ADD COLUMN folder_indexing_config TEXT DEFAULT NULL");
    }
  },
};
