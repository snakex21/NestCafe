// ============================================================
// SQLite database initialization and lifecycle.
// Uses better-sqlite3 with WAL mode and foreign keys.
// ============================================================

import Database from 'better-sqlite3';
import fs from 'node:fs';
import { runMigrations, getStoredVersion, CURRENT_VERSION } from './migrations/index.js';
import { FutureSchemaError } from './migrations/errors.js';

// ---- Types ----

export interface DatabaseOptions {
  databasePath: string;
  runMigrations?: boolean;
  legacyMetaDbPath?: string;
}

// ---- Singleton state ----

let _db: Database.Database | null = null;
let _currentPath: string | null = null;

// ---- Public API ----

export function getDatabase(): Database.Database {
  if (!_db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return _db;
}

export function initializeDatabase(options: DatabaseOptions): Database.Database {
  const { databasePath, runMigrations: shouldRunMigrations = true, legacyMetaDbPath } = options;
  const isReopen = _db !== null && _currentPath === databasePath;
  let preMigrationVersion = CURRENT_VERSION;

  if (!isReopen) {
    if (_db) {
      closeDatabase();
    }

    _db = new Database(databasePath);
    _currentPath = databasePath;

    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');

    if (shouldRunMigrations) {
      preMigrationVersion = getStoredVersion(_db);
      if (preMigrationVersion > CURRENT_VERSION) {
        const error = new FutureSchemaError(preMigrationVersion, CURRENT_VERSION);
        closeDatabase();
        throw error;
      }
      runMigrations(_db);
    }
  }

  if (shouldRunMigrations && legacyMetaDbPath && _db) {
    importLegacyWorkspaceMeta(_db, legacyMetaDbPath, preMigrationVersion);
  }

  // _db is guaranteed non-null after initialization above
  return _db!;
}

export function closeDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
    _currentPath = null;
  }
}

export function isDatabaseInitialized(): boolean {
  return _db !== null;
}

export function getDatabasePath(): string | null {
  return _currentPath;
}

export function resetDatabase(databasePath: string): void {
  closeDatabase();

  if (fs.existsSync(databasePath)) {
    const backupPath = `${databasePath}.corrupt.${Date.now()}`;
    fs.renameSync(databasePath, backupPath);
  }

  const walPath = `${databasePath}-wal`;
  const shmPath = `${databasePath}-shm`;
  if (fs.existsSync(walPath)) {
    fs.unlinkSync(walPath);
  }
  if (fs.existsSync(shmPath)) {
    fs.unlinkSync(shmPath);
  }
}

export function databaseExists(databasePath: string): boolean {
  return fs.existsSync(databasePath);
}

// ---- Legacy import (placeholder) ----

function importLegacyWorkspaceMeta(
  _db: Database.Database,
  _legacyPath: string,
  _preMigrationVersion: number,
): void {
  // Ported from import-legacy-workspace-meta.ts when needed.
  // Handles v30 consolidation of workspace metadata from legacy DB.
}
