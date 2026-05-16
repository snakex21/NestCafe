import type { FolderIndexingConfig } from '../../common/types/folder-indexing.js';
import { DEFAULT_FOLDER_INDEXING_CONFIG } from '../../common/types/folder-indexing.js';
import { getDatabase } from '../database.js';
import { safeParseJsonWithFallback } from '../../utils/json.js';

/**
 * Reads the persisted folder-indexing config from the `app_settings` row.
 * Falls back to {@link DEFAULT_FOLDER_INDEXING_CONFIG} when the column
 * is null or contains unparseable JSON.
 */
export function getFolderIndexingConfig(): FolderIndexingConfig {
  const db = getDatabase();
  const row = db.prepare('SELECT folder_indexing_config FROM app_settings WHERE id = 1').get() as
    | { folder_indexing_config: string | null }
    | undefined;
  if (!row?.folder_indexing_config) {
    return { ...DEFAULT_FOLDER_INDEXING_CONFIG };
  }
  const parsed = safeParseJsonWithFallback<Partial<FolderIndexingConfig>>(
    row.folder_indexing_config,
  );
  if (!parsed) {
    return { ...DEFAULT_FOLDER_INDEXING_CONFIG };
  }
  return {
    enabled: parsed.enabled ?? DEFAULT_FOLDER_INDEXING_CONFIG.enabled,
    selectedPaths: Array.isArray(parsed.selectedPaths) ? parsed.selectedPaths : [],
    customPaths: Array.isArray(parsed.customPaths) ? parsed.customPaths : [],
  };
}

/**
 * Persists the folder-indexing config as a JSON blob in the `app_settings` row.
 */
export function setFolderIndexingConfig(config: FolderIndexingConfig): void {
  const db = getDatabase();
  db.prepare('UPDATE app_settings SET folder_indexing_config = ? WHERE id = 1').run(
    JSON.stringify(config),
  );
}
