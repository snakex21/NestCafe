// ============================================================
// Migration runner — applies schema migrations sequentially.
// Each migration is a numbered file with `up()` and optional
// `down()` functions. Migrations run inside a transaction.
// ============================================================

import type Database from 'better-sqlite3';
import { FutureSchemaError, MigrationError } from './errors.js';

// ---- Migration interface ----

export interface Migration {
  version: number;
  up: (db: Database.Database) => void;
  down?: (db: Database.Database) => void;
}

// ---- Migration registry ----

// Each migration module exports a `migration` object.
// Add new migrations here in order.
import { migration as v001 } from './v001-initial-schema.js';

const migrations: Migration[] = [
  v001,
  // v002, v003, ... — add subsequent migrations here
];

/**
 * Register a migration at runtime (for plugins/modules).
 * Migrations are sorted by version after insertion.
 */
export function registerMigration(migration: Migration): void {
  migrations.push(migration);
  migrations.sort((a, b) => a.version - b.version);
}

// ---- Current schema version ----

/** The latest schema version supported by this build. */
export const CURRENT_VERSION = 1;

// ---- Version read/write ----

export function getStoredVersion(db: Database.Database): number {
  try {
    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_meta'")
      .get();

    if (!tableExists) {
      return 0;
    }

    const row = db.prepare("SELECT value FROM schema_meta WHERE key = 'version'").get() as
      | { value: string }
      | undefined;

    return row ? parseInt(row.value, 10) : 0;
  } catch {
    return 0;
  }
}

export function setStoredVersion(db: Database.Database, version: number): void {
  db.prepare("INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('version', ?)").run(
    String(version),
  );
}

// ---- Migration runner ----

export function runMigrations(db: Database.Database): void {
  const storedVersion = getStoredVersion(db);

  if (storedVersion > CURRENT_VERSION) {
    throw new FutureSchemaError(storedVersion, CURRENT_VERSION);
  }

  if (storedVersion === CURRENT_VERSION) {
    return;
  }

  for (const migration of migrations) {
    if (migration.version > storedVersion) {
      try {
        db.transaction(() => {
          migration.up(db);
          setStoredVersion(db, migration.version);
        })();
      } catch (err) {
        throw new MigrationError(
          migration.version,
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    }
  }
}
