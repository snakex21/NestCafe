/**
 * Folder indexing — types for the file-system indexing feature.
 *
 * Users select folders (predefined locations or custom paths); the app
 * performs a shallow scan (max 2 levels deep) and reports file counts
 * grouped by category. The selected folder paths are persisted.
 */

/** File categories used for counting during shallow scans. */
export type FileCategory = 'pdf' | 'docx' | 'txt' | 'md' | 'mp4' | 'png' | 'jpg' | 'mp3' | 'other';

/** Mapping of extension (lowercase, no dot) → category. */
export const EXT_CATEGORY_MAP: Record<string, FileCategory> = {
  pdf: 'pdf',
  docx: 'docx',
  doc: 'docx',
  txt: 'txt',
  md: 'md',
  mp4: 'mp4',
  avi: 'mp4',
  mkv: 'mp4',
  mov: 'mp4',
  webm: 'mp4',
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg',
  mp3: 'mp3',
  wav: 'mp3',
  flac: 'mp3',
  ogg: 'mp3',
};

/** File-type counts returned by a scan of a single folder. */
export type FileTypeCounts = Record<FileCategory, number>;

/** A single predefined or custom folder entry shown in the UI. */
export interface FolderIndexEntry {
  /** Unique identifier for this entry (e.g. 'desktop', 'documents', or a hash of the path). */
  id: string;
  /** Display label (e.g. 'Pulpit', 'Dokumenty', 'D:\') */
  label: string;
  /** Absolute file-system path. */
  path: string;
  /** Whether this is a predefined location or a user-added custom path. */
  kind: 'predefined' | 'custom';
  /** Whether the user has checked this folder for indexing. */
  selected: boolean;
  /** File counts from the last scan, or undefined if not yet scanned. */
  counts?: FileTypeCounts;
}

/** Persisted configuration for the folder-indexing feature. */
export interface FolderIndexingConfig {
  /** Enabled state for the whole feature. */
  enabled: boolean;
  /** Absolute paths of folders selected for indexing. */
  selectedPaths: string[];
  /** Custom (user-picked) folder paths that should appear in the list. */
  customPaths: string[];
}

/** Default config — feature off, no paths selected. */
export const DEFAULT_FOLDER_INDEXING_CONFIG: FolderIndexingConfig = {
  enabled: false,
  selectedPaths: [],
  customPaths: [],
};

/** Result of scanning a single folder (returned by the IPC handler). */
export interface FolderScanResult {
  /** The absolute path that was scanned. */
  path: string;
  /** File counts grouped by category. */
  counts: FileTypeCounts;
  /** Total number of files found (sum of all counts). */
  total: number;
  /** Absolute file paths found during the scan, limited to the supported scan depth. */
  files?: string[];
  /** Error message if the scan failed, or null on success. */
  error: string | null;
}
