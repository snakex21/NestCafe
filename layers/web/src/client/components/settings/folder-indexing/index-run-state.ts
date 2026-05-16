import { getNestCafe } from '@/lib/nestcafe';
import type { TaskStatus } from '@nestcafe_ai/agent-core/common';
import type { IndexRunSnapshot, IndexFileItem, IndexedFolderInfo, StartTaskFn } from './types';
import {
  INDEX_PROGRESS_STORAGE_KEY,
  INDEXED_FOLDERS_STORAGE_KEY,
  INDEXED_FOLDERS_CHANGED_EVENT,
  TERMINAL_TASK_STATUSES,
} from './constants';
import {
  buildSingleFileIndexPrompt,
  buildAttachmentInfo,
  getParentDirectory,
  buildFolderPageName,
} from './utils';

const indexRunListeners = new Set<(snapshot: IndexRunSnapshot) => void>();
let activeIndexRun: Promise<void> | null = null;
let indexRunSnapshot: IndexRunSnapshot = loadIndexRunSnapshot();

export function loadIndexRunSnapshot(): IndexRunSnapshot {
  if (typeof window === 'undefined') {
    return {
      indexing: false,
      success: false,
      lastIndexedAt: null,
      progress: null,
      files: [],
      items: [],
      nextIndex: 0,
    };
  }
  try {
    const raw = window.localStorage.getItem(INDEX_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return {
        indexing: false,
        success: false,
        lastIndexedAt: null,
        progress: null,
        files: [],
        items: [],
        nextIndex: 0,
      };
    }
    const parsed = JSON.parse(raw) as Partial<IndexRunSnapshot>;
    const normalized: IndexRunSnapshot = {
      indexing: parsed.indexing === true,
      success: parsed.success === true,
      lastIndexedAt: parsed.lastIndexedAt ?? null,
      progress: parsed.progress ?? null,
      files: Array.isArray(parsed.files) ? parsed.files : [],
      items: Array.isArray(parsed.items) ? parsed.items : [],
      nextIndex:
        typeof parsed.nextIndex === 'number' ? parsed.nextIndex : (parsed.progress?.current ?? 0),
    };
    if (normalized.indexing) {
      return {
        ...normalized,
        indexing: false,
        success: false,
        progress: normalized.progress
          ? {
              ...normalized.progress,
              done: true,
              error: 'Indeksowanie zostało przerwane. Możesz wznowić od checkpointu.',
            }
          : null,
      };
    }
    if (normalized.progress?.done) {
      return {
        ...normalized,
        success: false,
        progress: null,
      };
    }
    return normalized;
  } catch {
    return {
      indexing: false,
      success: false,
      lastIndexedAt: null,
      progress: null,
      files: [],
      items: [],
      nextIndex: 0,
    };
  }
}

function persistIndexRunSnapshot(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const persisted =
    indexRunSnapshot.progress?.done && !indexRunSnapshot.indexing
      ? { ...indexRunSnapshot, success: false, progress: null }
      : indexRunSnapshot;
  window.localStorage.setItem(INDEX_PROGRESS_STORAGE_KEY, JSON.stringify(persisted));
}

export function setIndexRunSnapshot(update: Partial<IndexRunSnapshot>): void {
  indexRunSnapshot = { ...indexRunSnapshot, ...update };
  persistIndexRunSnapshot();
  for (const listener of indexRunListeners) {
    listener(indexRunSnapshot);
  }
}

export function subscribeIndexRun(listener: (snapshot: IndexRunSnapshot) => void): () => void {
  indexRunListeners.add(listener);
  listener(indexRunSnapshot);
  return () => indexRunListeners.delete(listener);
}

export function getIndexRunSnapshot(): IndexRunSnapshot {
  return indexRunSnapshot;
}

export function loadIndexedFolders(): Record<string, IndexedFolderInfo> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(INDEXED_FOLDERS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, IndexedFolderInfo>) : {};
  } catch {
    return {};
  }
}

export function saveIndexedFolders(value: Record<string, IndexedFolderInfo>): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(INDEXED_FOLDERS_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event(INDEXED_FOLDERS_CHANGED_EVENT));
}

export function removeIndexedFolders(paths: string[]): void {
  if (paths.length === 0) {
    return;
  }
  const indexedFolders = loadIndexedFolders();
  let changed = false;
  for (const folderPath of paths) {
    if (indexedFolders[folderPath]) {
      delete indexedFolders[folderPath];
      changed = true;
    }
  }
  if (changed) {
    saveIndexedFolders(indexedFolders);
  }
}

export function markIndexedFolders(items: IndexFileItem[], indexedAt: string): void {
  const indexedFolders = loadIndexedFolders();
  const counts = new Map<string, { page: string; count: number }>();
  for (const item of items) {
    const current = counts.get(item.folderPath) ?? { page: item.folderPage, count: 0 };
    counts.set(item.folderPath, { page: item.folderPage, count: current.count + 1 });
  }
  for (const [folderPath, info] of counts) {
    indexedFolders[folderPath] = {
      path: folderPath,
      page: info.page,
      indexedAt,
      fileCount: info.count,
    };
  }
  saveIndexedFolders(indexedFolders);
}

export function getIndexedFolderHistory(
  indexedFolders: Record<string, IndexedFolderInfo>,
): IndexedFolderInfo[] {
  return Object.values(indexedFolders).sort(
    (a, b) => new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime(),
  );
}

export function getSnapshotItems(snapshot: IndexRunSnapshot): IndexFileItem[] {
  if (snapshot.items.length > 0) {
    return snapshot.items;
  }
  return snapshot.files.map((filePath) => {
    const folderPath = getParentDirectory(filePath) ?? filePath;
    return {
      filePath,
      folderPath,
      folderPage: buildFolderPageName(folderPath),
    };
  });
}

async function waitForTaskCompletion(taskId: string): Promise<TaskStatus | null> {
  const nestcafe = getNestCafe();
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const task = await nestcafe.getTask(taskId);
    if (!task) {
      return null;
    }
    if (TERMINAL_TASK_STATUSES.has(task.status)) {
      return task.status;
    }
  }
}

export function startFolderIndexingRun(
  items: IndexFileItem[],
  startTask: StartTaskFn,
  startIndex = 0,
): void {
  if (activeIndexRun) {
    return;
  }

  activeIndexRun = runFolderIndexing(items, startTask, startIndex).finally(() => {
    activeIndexRun = null;
  });
}

async function runFolderIndexing(
  items: IndexFileItem[],
  startTask: StartTaskFn,
  startIndex: number,
): Promise<void> {
  const files = items.map((item) => item.filePath);
  const totalFiles = items.length;
  let failed = 0;
  const safeStartIndex = Math.min(Math.max(startIndex, 0), totalFiles);

  setIndexRunSnapshot({
    indexing: true,
    success: true,
    files,
    items,
    nextIndex: safeStartIndex,
    progress: {
      current: safeStartIndex,
      total: totalFiles,
      currentFile:
        safeStartIndex > 0
          ? `Wznawianie od pliku ${safeStartIndex + 1}/${totalFiles}`
          : 'Rozpoczynanie indeksowania...',
      done: false,
    },
  });

  for (let index = safeStartIndex; index < files.length; index += 1) {
    const item = items[index];
    const filePath = item.filePath;
    setIndexRunSnapshot({
      nextIndex: index,
      progress: {
        current: index,
        total: totalFiles,
        currentFile: filePath,
        done: false,
      },
    });

    const task = await startTask({
      taskId: `index_${Date.now()}_${index}`,
      prompt: buildSingleFileIndexPrompt(item, index + 1, totalFiles),
      workingDirectory: getParentDirectory(filePath),
      autoApprovePermissions: true,
      files: [buildAttachmentInfo(filePath)],
    });

    if (!task) {
      failed += 1;
      continue;
    }

    const status = await waitForTaskCompletion(task.id);
    if (status !== 'completed') {
      failed += 1;
    }

    setIndexRunSnapshot({
      nextIndex: index + 1,
      progress: {
        current: index + 1,
        total: totalFiles,
        currentFile: filePath,
        done: false,
      },
    });
  }

  const indexedAt = new Date().toISOString();
  markIndexedFolders(items, indexedAt);

  setIndexRunSnapshot({
    indexing: false,
    success: true,
    lastIndexedAt: indexedAt,
    files,
    items,
    nextIndex: totalFiles,
    progress: {
      current: totalFiles,
      total: totalFiles,
      currentFile:
        failed > 0 ? `Zakończono z błędami: ${failed}` : 'Zeskanowano i zapisano wyniki do wiki',
      done: true,
      error: failed > 0 ? `${failed} plików nie udało się przetworzyć.` : undefined,
    },
  });
}
