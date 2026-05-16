// ============================================================
// Migration error types — thrown when schema version mismatches
// or a migration step fails irrecoverably.
// ============================================================

/**
 * Thrown when the stored schema version exceeds the app's CURRENT_VERSION.
 * The database was created by a newer version of the application.
 */
export class FutureSchemaError extends Error {
  override name = 'FutureSchemaError';

  constructor(
    public readonly storedVersion: number,
    public readonly appVersion: number,
  ) {
    super(
      `Database schema version ${storedVersion} is newer than app version ${appVersion}. ` +
        'Please update the application.',
    );
  }
}

/**
 * Thrown when a specific migration fails to execute.
 */
export class MigrationError extends Error {
  override name = 'MigrationError';

  constructor(
    public readonly version: number,
    public override readonly cause: Error,
  ) {
    super(`Migration v${version} failed: ${cause.message}`);
  }
}

/**
 * Thrown when the database file is corrupt and cannot be opened.
 */
export class CorruptDatabaseError extends Error {
  override name = 'CorruptDatabaseError';

  constructor(
    message: string,
    public override readonly cause?: Error,
  ) {
    super(`Database is corrupt: ${message}`);
  }
}
