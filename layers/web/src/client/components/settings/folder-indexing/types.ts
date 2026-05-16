import type { FolderScanResult, Task, TaskConfig, TaskStatus } from '@nestcafe_ai/agent-core/common';

export interface PredefinedLocation {
  id: string;
  label: string;
  getPath: () => Promise<string | null>;
}

export interface CategoryInfo {
  key: string;
  label: string;
  color: string;
}

export type StartTaskFn = (config: TaskConfig) => Promise<Task | null>;

export interface IndexProgressState {
  current: number;
  total: number;
  currentFile: string;
  done: boolean;
  error?: string;
}

export interface IndexFileItem {
  filePath: string;
  folderPath: string;
  folderPage: string;
}

export interface IndexedFolderInfo {
  path: string;
  page: string;
  indexedAt: string;
  fileCount: number;
}

export interface IndexRunSnapshot {
  indexing: boolean;
  success: boolean;
  lastIndexedAt: string | null;
  progress: IndexProgressState | null;
  files: string[];
  items: IndexFileItem[];
  nextIndex: number;
}

export interface FolderEntry {
  id: string;
  label: string;
  path: string;
  kind: 'predefined' | 'custom';
  selected: boolean;
  scanning: boolean;
  scanResult: FolderScanResult | null;
  scanError: string | null;
}
