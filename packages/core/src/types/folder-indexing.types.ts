// ============================================================
// Folder indexing domain types — filesystem scanning
// configuration and results for AI context awareness.
// ============================================================

export type FileCategory =
  | 'code'
  | 'document'
  | 'data'
  | 'config'
  | 'image'
  | 'media'
  | 'archive'
  | 'other';

export type ExtensionCategoryMap = Record<string, FileCategory>;

export const EXT_CATEGORY_MAP: ExtensionCategoryMap = {
  // Code
  '.ts': 'code',
  '.tsx': 'code',
  '.js': 'code',
  '.jsx': 'code',
  '.py': 'code',
  '.rs': 'code',
  '.go': 'code',
  '.java': 'code',
  '.c': 'code',
  '.cpp': 'code',
  '.h': 'code',
  '.hpp': 'code',
  '.cs': 'code',
  '.rb': 'code',
  '.php': 'code',
  '.swift': 'code',
  '.kt': 'code',
  '.scala': 'code',
  '.vue': 'code',
  '.svelte': 'code',
  // Documents
  '.md': 'document',
  '.txt': 'document',
  '.pdf': 'document',
  '.doc': 'document',
  '.docx': 'document',
  '.rst': 'document',
  // Data
  '.json': 'data',
  '.yaml': 'data',
  '.yml': 'data',
  '.xml': 'data',
  '.csv': 'data',
  '.toml': 'data',
  '.sql': 'data',
  // Config
  '.env': 'config',
  '.ini': 'config',
  '.cfg': 'config',
  '.conf': 'config',
  // Images
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.svg': 'image',
  '.webp': 'image',
  '.ico': 'image',
  // Media
  '.mp4': 'media',
  '.mp3': 'media',
  '.wav': 'media',
  '.ogg': 'media',
  '.mov': 'media',
  '.avi': 'media',
  // Archive
  '.zip': 'archive',
  '.tar': 'archive',
  '.gz': 'archive',
  '.rar': 'archive',
  '.7z': 'archive',
};

export interface FileTypeCounts {
  code: number;
  document: number;
  data: number;
  config: number;
  image: number;
  media: number;
  archive: number;
  other: number;
}

export interface FolderIndexEntry {
  path: string;
  name: string;
  category: FileCategory;
  size: number;
  modifiedAt: string;
}

export interface FolderIndexingConfig {
  enabled: boolean;
  paths: string[];
  maxDepth: number;
  excludePatterns: string[];
  maxFileSize: number;
  maxTotalFiles: number;
}

export const DEFAULT_FOLDER_INDEXING_CONFIG: FolderIndexingConfig = {
  enabled: false,
  paths: [],
  maxDepth: 5,
  excludePatterns: ['node_modules', '.git', 'dist', 'build', '__pycache__', '.next'],
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  maxTotalFiles: 10000,
};

export interface FolderScanResult {
  path: string;
  indexedAt: string;
  totalFiles: number;
  typeCounts: FileTypeCounts;
  entries: FolderIndexEntry[];
}
