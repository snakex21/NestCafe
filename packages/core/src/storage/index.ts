// ============================================================
// Storage barrel — re-exports all storage modules.
// ============================================================

export {
  getDatabase,
  initializeDatabase,
  closeDatabase,
  isDatabaseInitialized,
  getDatabasePath,
  resetDatabase,
  databaseExists,
} from './database.js';
export type { DatabaseOptions } from './database.js';

export { SecureStorage } from './secure-storage.js';
export type { SecureStorageOptions } from './secure-storage.js';

export {
  runMigrations,
  registerMigration,
  getStoredVersion,
  setStoredVersion,
  CURRENT_VERSION,
} from './migrations/index.js';
export type { Migration } from './migrations/index.js';

export { FutureSchemaError, MigrationError, CorruptDatabaseError } from './migrations/errors.js';
