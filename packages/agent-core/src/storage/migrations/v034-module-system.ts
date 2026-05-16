import type { Database } from 'better-sqlite3';
import type { Migration } from './index.js';

/**
 * v034 — Module system infrastructure.
 *
 * Adds two tables:
 *   `modules`         — installed/discovered modules with their manifest
 *   `module_settings`  — per-module key-value configuration
 */
export const migration: Migration = {
  version: 34,
  up: (db: Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS modules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        version TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        icon TEXT NOT NULL DEFAULT 'box',
        entry TEXT NOT NULL,
        manifest_json TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        installed_at TEXT NOT NULL,
        source_path TEXT NOT NULL
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS module_settings (
        module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (module_id, key)
      )
    `);
  },
};
