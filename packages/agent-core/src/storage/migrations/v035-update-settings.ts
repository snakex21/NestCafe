/**
 * Migration v035 — add update settings columns to app_settings
 *
 * Adds three boolean columns controlling auto-update behavior:
 * - update_auto_check: whether to automatically check for updates (default: 1)
 * - update_auto_download: whether to auto-download found updates (default: 1)
 * - update_auto_install: whether to auto-install on app quit (default: 1)
 */
import type { Database } from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration: Migration = {
  version: 35,
  up: (db: Database) => {
    const columns = db.prepare(`PRAGMA table_info(app_settings)`).all() as Array<{
      name: string;
    }>;
    if (!columns.some((col) => col.name === 'update_auto_check')) {
      db.prepare(
        `ALTER TABLE app_settings ADD COLUMN update_auto_check INTEGER NOT NULL DEFAULT 1`,
      ).run();
    }
    if (!columns.some((col) => col.name === 'update_auto_download')) {
      db.prepare(
        `ALTER TABLE app_settings ADD COLUMN update_auto_download INTEGER NOT NULL DEFAULT 1`,
      ).run();
    }
    if (!columns.some((col) => col.name === 'update_auto_install')) {
      db.prepare(
        `ALTER TABLE app_settings ADD COLUMN update_auto_install INTEGER NOT NULL DEFAULT 1`,
      ).run();
    }
  },
};
