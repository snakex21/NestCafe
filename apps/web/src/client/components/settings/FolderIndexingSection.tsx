/**
 * FolderIndexingSection — UI for selecting folders to index.
 *
 * Shows predefined locations (Documents, Desktop, Downloads, D:\, E:\)
 * and user-added custom folders with checkboxes. On selection, triggers
 * a shallow scan (max 2 levels) and displays file counts by type.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash,
  SpinnerGap,
  CheckSquare,
  Square,
  Folder,
  Rocket,
  CheckCircle,
  Clock,
  ClockCounterClockwise,
} from '@phosphor-icons/react';
import { getNestCafe } from '@/lib/nestcafe';
import { ModelIndicator } from '@/components/ui/ModelIndicator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { FileAttachmentInfo, FolderScanResult, Task, TaskConfig, TaskStatus } from '@nestcafe_ai/agent-core/common';

// ---------------------------------------------------------------------------
// Predefined locations
// ---------------------------------------------------------------------------

interface PredefinedLocation {
  id: string;
  label: string;
  getPath: () => Promise<string | null>;
}

const PREDEFINED_LOCATIONS: PredefinedLocation[] = [
  {
    id: 'desktop',
    label: 'Pulpit',
    getPath: async () => {
      const a = getNestCafe();
      if (a.folderIndexing?.getSystemPath) {
        return a.folderIndexing.getSystemPath('desktop');
      }
      return null;
    },
  },
  {
    id: 'documents',
    label: 'Dokumenty',
    getPath: async () => {
      const a = getNestCafe();
      if (a.folderIndexing?.getSystemPath) {
        return a.folderIndexing.getSystemPath('documents');
      }
      return null;
    },
  },
  {
    id: 'downloads',
    label: 'Pobrane',
    getPath: async () => {
      const a = getNestCafe();
      if (a.folderIndexing?.getSystemPath) {
        return a.folderIndexing.getSystemPath('downloads');
      }
      return null;
    },
  },
  { id: 'drive-d', label: 'Dysk D:\\', getPath: async () => 'D:\\' },
  { id: 'drive-e', label: 'Dysk E:\\', getPath: async () => 'E:\\' },
];

// ---------------------------------------------------------------------------
// Category display helpers
// ---------------------------------------------------------------------------

interface CategoryInfo {
  key: string;
  label: string;
  color: string;
}

const CATEGORIES: CategoryInfo[] = [
  { key: 'pdf', label: 'PDF', color: 'bg-red-100 text-red-700' },
  { key: 'docx', label: 'DOCX', color: 'bg-blue-100 text-blue-700' },
  { key: 'txt', label: 'TXT', color: 'bg-gray-100 text-gray-700' },
  { key: 'md', label: 'MD', color: 'bg-purple-100 text-purple-700' },
  { key: 'mp4', label: 'MP4', color: 'bg-green-100 text-green-700' },
  { key: 'png', label: 'PNG', color: 'bg-amber-100 text-amber-700' },
  { key: 'jpg', label: 'JPG', color: 'bg-orange-100 text-orange-700' },
  { key: 'mp3', label: 'MP3', color: 'bg-pink-100 text-pink-700' },
  { key: 'other', label: 'Inne', color: 'bg-zinc-100 text-zinc-600' },
];

function formatCount(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return String(n);
}

const TERMINAL_TASK_STATUSES = new Set<TaskStatus>([
  'completed',
  'failed',
  'cancelled',
  'interrupted',
]);

const INDEX_PROGRESS_STORAGE_KEY = 'nestcafe:folder-indexing:progress';
const INDEXED_FOLDERS_STORAGE_KEY = 'nestcafe:folder-indexing:indexed-folders';
const INDEXED_FOLDERS_CHANGED_EVENT = 'nestcafe:folder-indexing:indexed-folders-changed';

interface IndexProgressState {
  current: number;
  total: number;
  currentFile: string;
  done: boolean;
  error?: string;
}

interface IndexFileItem {
  filePath: string;
  folderPath: string;
  folderPage: string;
}

interface IndexedFolderInfo {
  path: string;
  page: string;
  indexedAt: string;
  fileCount: number;
}

interface IndexRunSnapshot {
  indexing: boolean;
  success: boolean;
  lastIndexedAt: string | null;
  progress: IndexProgressState | null;
  files: string[];
  items: IndexFileItem[];
  nextIndex: number;
}

type StartTaskFn = (config: TaskConfig) => Promise<Task | null>;

const indexRunListeners = new Set<(snapshot: IndexRunSnapshot) => void>();
let activeIndexRun: Promise<void> | null = null;
let indexRunSnapshot: IndexRunSnapshot = loadIndexRunSnapshot();

function loadIndexRunSnapshot(): IndexRunSnapshot {
  if (typeof window === 'undefined') {
    return { indexing: false, success: false, lastIndexedAt: null, progress: null, files: [], items: [], nextIndex: 0 };
  }
  try {
    const raw = window.localStorage.getItem(INDEX_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return { indexing: false, success: false, lastIndexedAt: null, progress: null, files: [], items: [], nextIndex: 0 };
    }
    const parsed = JSON.parse(raw) as Partial<IndexRunSnapshot>;
    const normalized: IndexRunSnapshot = {
      indexing: parsed.indexing === true,
      success: parsed.success === true,
      lastIndexedAt: parsed.lastIndexedAt ?? null,
      progress: parsed.progress ?? null,
      files: Array.isArray(parsed.files) ? parsed.files : [],
      items: Array.isArray(parsed.items) ? parsed.items : [],
      nextIndex: typeof parsed.nextIndex === 'number' ? parsed.nextIndex : parsed.progress?.current ?? 0,
    };
    if (normalized.indexing) {
      return {
        ...normalized,
        indexing: false,
        success: false,
        progress: normalized.progress
          ? { ...normalized.progress, done: true, error: 'Indeksowanie zostało przerwane. Możesz wznowić od checkpointu.' }
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
    return { indexing: false, success: false, lastIndexedAt: null, progress: null, files: [], items: [], nextIndex: 0 };
  }
}

function persistIndexRunSnapshot(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const persisted = indexRunSnapshot.progress?.done && !indexRunSnapshot.indexing
    ? { ...indexRunSnapshot, success: false, progress: null }
    : indexRunSnapshot;
  window.localStorage.setItem(INDEX_PROGRESS_STORAGE_KEY, JSON.stringify(persisted));
}

function setIndexRunSnapshot(update: Partial<IndexRunSnapshot>): void {
  indexRunSnapshot = { ...indexRunSnapshot, ...update };
  persistIndexRunSnapshot();
  for (const listener of indexRunListeners) {
    listener(indexRunSnapshot);
  }
}

function subscribeIndexRun(listener: (snapshot: IndexRunSnapshot) => void): () => void {
  indexRunListeners.add(listener);
  listener(indexRunSnapshot);
  return () => indexRunListeners.delete(listener);
}

function loadIndexedFolders(): Record<string, IndexedFolderInfo> {
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

function saveIndexedFolders(value: Record<string, IndexedFolderInfo>): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(INDEXED_FOLDERS_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event(INDEXED_FOLDERS_CHANGED_EVENT));
}

function removeIndexedFolders(paths: string[]): void {
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

function markIndexedFolders(items: IndexFileItem[], indexedAt: string): void {
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

function getIndexedFolderHistory(indexedFolders: Record<string, IndexedFolderInfo>): IndexedFolderInfo[] {
  return Object.values(indexedFolders).sort(
    (a, b) => new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime(),
  );
}

function getSnapshotItems(snapshot: IndexRunSnapshot): IndexFileItem[] {
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

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

function buildFolderPageName(folderPath: string): string {
  const normalized = folderPath
    .replace(/^[a-zA-Z]:/, (drive) => drive.replace(':', ''))
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 90);
  return `folder-index--${normalized || 'root'}`;
}

function getParentDirectory(filePath: string): string | undefined {
  const index = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
  if (index <= 0) {
    return undefined;
  }
  return filePath.slice(0, index);
}

function getAttachmentType(filePath: string): FileAttachmentInfo['type'] {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) {
    return 'image';
  }
  if (ext === 'pdf') {
    return 'pdf';
  }
  if (['txt', 'md', 'json', 'csv', 'xml', 'html'].includes(ext)) {
    return 'text';
  }
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'ps1', 'sh', 'bat', 'css', 'yml', 'yaml'].includes(ext)) {
    return 'code';
  }
  return 'other';
}

function buildAttachmentInfo(filePath: string): FileAttachmentInfo {
  return {
    id: `folder-index-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: getFileName(filePath),
    path: filePath,
    type: getAttachmentType(filePath),
    size: 0,
  };
}

function buildSingleFileIndexPrompt(item: IndexFileItem, current: number, total: number): string {
  return [
    '<folder-indexing-file>',
    `Indeksujesz plik ${current}/${total}.`,
    `Folder źródłowy: ${item.folderPath}`,
    `Strona wiki folderu/szufladki: ${item.folderPage}`,
    `Ścieżka pliku: ${item.filePath}`,
    '',
    'To zadanie jest niezależne od innych plików — użyj czystego kontekstu tylko dla tego pliku.',
    'Otwórz/odczytaj ten konkretny plik. Jeśli jest załączony jako PDF/obraz, przeanalizuj załącznik.',
    'Wyciągnij tytuł, temat, ważne fakty, osoby/projekty/daty i 1-2 zdaniowe podsumowanie.',
    'Na końcu KONIECZNIE zapisz wynik do szufladki folderu narzędziem update_wiki:',
    `update_wiki(page="${item.folderPage}", mode="append", content="## [nazwa pliku]\nŚcieżka: [ścieżka]\nTyp: [typ]\nPodsumowanie: [podsumowanie i kluczowe fakty]")`,
    'Dodatkowo zaktualizuj ogólną mapę indeksu:',
    `update_wiki(page="file-index", mode="append", content="${item.folderPath} -> ${item.folderPage}")`,
    'Jeśli pliku nie da się odczytać, też zapisz krótką informację do szufladki folderu, że został pominięty i dlaczego.',
    'Nie pytaj użytkownika o potwierdzenie.',
    '</folder-indexing-file>',
  ].join('\n');
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

function startFolderIndexingRun(items: IndexFileItem[], startTask: StartTaskFn, startIndex = 0): void {
  if (activeIndexRun) {
    return;
  }

  activeIndexRun = runFolderIndexing(items, startTask, startIndex).finally(() => {
    activeIndexRun = null;
  });
}

async function runFolderIndexing(items: IndexFileItem[], startTask: StartTaskFn, startIndex: number): Promise<void> {
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
      currentFile: safeStartIndex > 0 ? `Wznawianie od pliku ${safeStartIndex + 1}/${totalFiles}` : 'Rozpoczynanie indeksowania...',
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
      currentFile: failed > 0 ? `Zakończono z błędami: ${failed}` : 'Zeskanowano i zapisano wyniki do wiki',
      done: true,
      error: failed > 0 ? `${failed} plików nie udało się przetworzyć.` : undefined,
    },
  });
}

// ---------------------------------------------------------------------------
// Types for internal state
// ---------------------------------------------------------------------------

interface FolderEntry {
  id: string;
  label: string;
  path: string;
  kind: 'predefined' | 'custom';
  selected: boolean;
  scanning: boolean;
  scanResult: FolderScanResult | null;
  scanError: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FolderIndexingSection() {
  const [entries, setEntries] = useState<FolderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [indexing, setIndexing] = useState(indexRunSnapshot.indexing);
  const [indexSuccess, setIndexSuccess] = useState(indexRunSnapshot.success);
  const [indexProgress, setIndexProgress] = useState<IndexProgressState | null>(indexRunSnapshot.progress);
  const [lastIndexedAt, setLastIndexedAt] = useState<string | null>(indexRunSnapshot.lastIndexedAt);
  const [indexedFolders, setIndexedFolders] = useState<Record<string, IndexedFolderInfo>>(() =>
    loadIndexedFolders(),
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [canResumeIndexing, setCanResumeIndexing] = useState(
    !indexRunSnapshot.indexing && getSnapshotItems(indexRunSnapshot).length > indexRunSnapshot.nextIndex,
  );
  const nestcafe = getNestCafe();
  const startBackgroundTask = useCallback<StartTaskFn>((config) => nestcafe.startTask(config), [nestcafe]);

  useEffect(() => {
    return subscribeIndexRun((snapshot) => {
      setIndexing(snapshot.indexing);
      setIndexSuccess(snapshot.success);
      setIndexProgress(snapshot.progress);
      setLastIndexedAt(snapshot.lastIndexedAt);
      setCanResumeIndexing(!snapshot.indexing && getSnapshotItems(snapshot).length > snapshot.nextIndex);
      setIndexedFolders(loadIndexedFolders());
    });
  }, []);

  useEffect(() => {
    const refreshIndexedFolders = () => setIndexedFolders(loadIndexedFolders());
    window.addEventListener(INDEXED_FOLDERS_CHANGED_EVENT, refreshIndexedFolders);
    return () => window.removeEventListener(INDEXED_FOLDERS_CHANGED_EVENT, refreshIndexedFolders);
  }, []);

  // ── Load saved config + resolve predefined paths ──────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const config = await nestcafe.folderIndexing.getConfig();

        // Resolve predefined locations to actual paths
        const resolved: FolderEntry[] = [];
        for (const loc of PREDEFINED_LOCATIONS) {
          const resolvedPath = await loc.getPath();
          if (!resolvedPath) {
            continue;
          }
          resolved.push({
            id: loc.id,
            label: loc.label,
            path: resolvedPath,
            kind: 'predefined',
            selected: config.selectedPaths.includes(resolvedPath),
            scanning: false,
            scanResult: null,
            scanError: null,
          });
        }

        // Add custom paths from config
        for (const customPath of config.customPaths) {
          // Avoid duplicates with predefined
          if (resolved.some((e) => e.path === customPath)) {
            continue;
          }
          resolved.push({
            id: `custom-${customPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
            label: customPath.split(/[\\/]/).pop() || customPath,
            path: customPath,
            kind: 'custom',
            selected: config.selectedPaths.includes(customPath),
            scanning: false,
            scanResult: null,
            scanError: null,
          });
        }

        if (!cancelled) {
          setEntries(resolved);
          // Auto-scan already-selected entries
          const toScan = resolved.filter((e) => e.selected).map((e) => e.path);
          if (toScan.length > 0) {
            scanFolders(resolved, toScan, cancelled, setEntries);
          }
        }
      } catch {
        if (!cancelled) {
          setEntries([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save config to daemon ─────────────────────────────────────────────
  const saveConfig = useCallback(
    async (updatedEntries: FolderEntry[]) => {
      setSaving(true);
      try {
        const selectedPaths = updatedEntries.filter((e) => e.selected).map((e) => e.path);
        const customPaths = updatedEntries.filter((e) => e.kind === 'custom').map((e) => e.path);
        await nestcafe.folderIndexing.setConfig({
          enabled: selectedPaths.length > 0,
          selectedPaths,
          customPaths,
        });
      } catch {
        // Save failures are silent — user can retry by toggling.
      } finally {
        setSaving(false);
      }
    },
    [nestcafe],
  );

  // ── Toggle selection ──────────────────────────────────────────────────
  const handleToggle = useCallback(
    async (entryId: string) => {
      setEntries((prev) => {
        const next = prev.map((e) => (e.id === entryId ? { ...e, selected: !e.selected } : e));
        // Persist
        saveConfig(next);
        // If newly selected and not yet scanned, trigger scan
        const toggled = next.find((e) => e.id === entryId);
        if (toggled?.selected && !toggled.scanResult && !toggled.scanning) {
          scanFolders(next, [toggled.path], false, setEntries);
        }
        return next;
      });
    },
    [saveConfig],
  );

  // ── Add custom folder ─────────────────────────────────────────────────
  const handleAddCustom = useCallback(async () => {
    const folderPath = await nestcafe.pickFolder();
    if (!folderPath) {
      return;
    }
    setEntries((prev) => {
      if (prev.some((e) => e.path === folderPath)) {
        return prev;
      }
      const newEntry: FolderEntry = {
        id: `custom-${folderPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
        label: folderPath.split(/[\\/]/).pop() || folderPath,
        path: folderPath,
        kind: 'custom',
        selected: true,
        scanning: true,
        scanResult: null,
        scanError: null,
      };
      const next = [...prev, newEntry];
      saveConfig(next);
      scanFolders(next, [folderPath], false, setEntries);
      return next;
    });
  }, [nestcafe, saveConfig]);

  // ── Index documents (start agent task) ─────────────────────────────────
  const handleIndexDocuments = useCallback(async () => {
    const selected = entries.filter((e) => e.selected);
    if (selected.length === 0) {
      return;
    }

    if (indexing) {
      return;
    }

    try {
      const paths = selected.map((e) => e.path);
      const results = await nestcafe.folderIndexing.scanFolders(paths);
      const items = results.flatMap((result) =>
        (result.files ?? []).map((filePath) => ({
          filePath,
          folderPath: result.path,
          folderPage: buildFolderPageName(result.path),
        })),
      );
      const totalFiles = items.length;

      if (totalFiles === 0) {
        setIndexRunSnapshot({
          indexing: false,
          success: false,
          files: [],
          items: [],
          nextIndex: 0,
          progress: { current: 0, total: 0, currentFile: 'Brak plików do indeksowania.', done: true },
        });
        return;
      }

      startFolderIndexingRun(items, startBackgroundTask);
    } catch (_err) {
      setIndexRunSnapshot({
        indexing: false,
        success: false,
        files: [],
        items: [],
        nextIndex: 0,
        progress: { current: 0, total: 0, currentFile: '', done: true, error: 'Nie udało się uruchomić zadania.' },
      });
    }
  }, [entries, nestcafe, startBackgroundTask, indexing]);

  const handleResumeIndexing = useCallback(() => {
    const items = getSnapshotItems(indexRunSnapshot);
    if (indexing || items.length <= indexRunSnapshot.nextIndex) {
      return;
    }
    startFolderIndexingRun(items, startBackgroundTask, indexRunSnapshot.nextIndex);
  }, [indexing, startBackgroundTask]);

  // ── Remove custom folder ──────────────────────────────────────────────
  const handleRemove = useCallback(
    async (entryId: string) => {
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== entryId);
        saveConfig(next);
        return next;
      });
    },
    [saveConfig],
  );

  // ── Loading state ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <SpinnerGap className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const historyItems = getIndexedFolderHistory(indexedFolders);
  const lastHistoryItem = historyItems[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/35 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">Indeksowanie folderów</h3>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            >
              <ClockCounterClockwise className="h-3.5 w-3.5" />
              Historia
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {historyItems.length}
              </span>
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Wybierz foldery do indeksowania. Agent będzie widział strukturę plików (maks. 2 poziomy).
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/70">
            {lastIndexedAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Ostatnia indeksacja: {new Date(lastIndexedAt).toLocaleString('pl-PL')}
              </span>
            )}
            {lastHistoryItem && (
              <span>
                {lastHistoryItem.fileCount} plików · {lastHistoryItem.path.split(/[\\/]/).pop() || lastHistoryItem.path}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ModelIndicator className="text-xs" />
          <button
            onClick={handleAddCustom}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Wybierz folder ręcznie
          </button>
        </div>
      </div>

      <IndexingHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        historyItems={historyItems}
        lastHistoryItem={lastHistoryItem}
      />

      {/* Success notification */}
      {indexSuccess && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" weight="fill" />
          <div>
            <p className="text-sm font-medium text-green-800">
              {indexProgress?.done ? 'Indeksowanie zakończone!' : 'Zadanie indeksowania uruchomione!'}
            </p>
            <p className="text-xs text-green-600">
              {indexProgress?.done
                ? 'Wyniki są zapisane w pamięci wiki na stronie file-index.'
                : 'Postęp jest zapisany i pozostanie widoczny po zmianie zakładki.'}
            </p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {indexProgress && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {indexProgress.done
                ? 'Indeksowanie zakończone!'
                : `Indeksowanie: ${indexProgress.current}/${indexProgress.total}`}
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-[60%]">
              {indexProgress.currentFile}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                indexProgress.done
                  ? 'bg-green-500'
                  : indexProgress.error
                    ? 'bg-red-500'
                    : 'bg-primary'
              }`}
              style={{
                width: `${indexProgress.total > 0
                  ? Math.round((indexProgress.current / indexProgress.total) * 100)
                  : 0}%`,
              }}
            />
          </div>
          {indexProgress.error && (
            <p className="text-xs text-red-500 mt-2">{indexProgress.error}</p>
          )}
          {indexProgress.done && !indexProgress.error && (
            <p className="text-xs text-muted-foreground mt-2">
              Wyniki zapisane w pamięci wiki (strona <code className="text-xs bg-muted px-1 rounded">file-index</code>).
              Po ponownym uruchomieniu zostanie tylko status przy zindeksowanych folderach.
            </p>
          )}
          {canResumeIndexing && (
            <button
              onClick={handleResumeIndexing}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Rocket className="h-3.5 w-3.5" />
              Wznów od checkpointu ({indexRunSnapshot.nextIndex}/{getSnapshotItems(indexRunSnapshot).length})
            </button>
          )}
        </div>
      )}

      {/* Folder list */}
      <div className="space-y-2">
        {entries.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Folder className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Brak folderów do wyświetlenia. Kliknij &quot;Wybierz folder ręcznie&quot; aby dodać.
            </p>
          </div>
        )}

        {entries.map((entry) => (
          <FolderRow
            key={entry.id}
            entry={entry}
            onToggle={() => handleToggle(entry.id)}
            onRemove={entry.kind === 'custom' ? () => handleRemove(entry.id) : undefined}
            saving={saving}
            indexedInfo={entry.scanError ? undefined : indexedFolders[entry.path]}
          />
        ))}
      </div>

      {/* Index documents button */}
      {entries.some((e) => e.selected && e.scanResult && e.scanResult.total > 0) && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">Zindeksuj dokumenty</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Agent przetworzy każdy plik osobno i zapisze podsumowania do pamięci wiki.
              </p>
            </div>
            <button
              onClick={handleIndexDocuments}
              disabled={indexing}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {indexing ? (
                <>
                  <SpinnerGap className="h-4 w-4 animate-spin" />
                  Indeksowanie...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  Zindeksuj dokumenty
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Indexing history dialog
// ---------------------------------------------------------------------------

interface IndexingHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  historyItems: IndexedFolderInfo[];
  lastHistoryItem?: IndexedFolderInfo;
}

function IndexingHistoryDialog({
  open,
  onOpenChange,
  historyItems,
  lastHistoryItem,
}: IndexingHistoryDialogProps) {
  const totalFiles = historyItems.reduce((sum, item) => sum + item.fileCount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ClockCounterClockwise className="h-4 w-4" />
            </span>
            Historia indeksowania
          </DialogTitle>
          <DialogDescription>
            {historyItems.length > 0
              ? `${historyItems.length} folderów · ${totalFiles} plików · ostatnio ${lastHistoryItem ? new Date(lastHistoryItem.indexedAt).toLocaleString('pl-PL') : '—'}`
              : 'Tutaj pojawią się foldery po pierwszym zakończonym indeksowaniu.'}
          </DialogDescription>
        </DialogHeader>

        {historyItems.length === 0 ? (
          <div className="m-6 rounded-lg border border-dashed border-border p-8 text-center">
            <Folder className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Brak historii indeksowania.</p>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            {historyItems.map((item) => (
              <div
                key={item.path}
                className="grid gap-3 border-b border-border px-6 py-4 last:border-b-0 sm:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-600" weight="fill" />
                    <p className="truncate text-sm font-semibold text-foreground">
                      {item.path.split(/[\\/]/).pop() || item.path}
                    </p>
                    <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600">
                      zindeksowane
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground" title={item.path}>
                    {item.path}
                  </p>
                  <code className="mt-2 inline-block max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {item.page}
                  </code>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground sm:justify-end sm:text-right">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Pliki</div>
                    <div className="font-medium text-foreground">{item.fileCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Data</div>
                    <div className="font-medium text-foreground">
                      {new Date(item.indexedAt).toLocaleString('pl-PL')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// FolderRow sub-component
// ---------------------------------------------------------------------------

interface FolderRowProps {
  entry: FolderEntry;
  onToggle: () => void;
  onRemove?: () => void;
  saving: boolean;
  indexedInfo?: IndexedFolderInfo;
}

function FolderRow({ entry, onToggle, onRemove, saving, indexedInfo }: FolderRowProps) {
  return (
    <div
      className={`rounded-lg border transition-colors ${
        entry.selected ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center gap-3 p-4">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          disabled={saving}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {entry.selected ? (
            <CheckSquare className="h-5 w-5 text-primary" weight="fill" />
          ) : (
            <Square className="h-5 w-5" />
          )}
        </button>

        {/* Label + path */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{entry.label}</span>
            {entry.kind === 'custom' && (
              <span className="flex-shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                niestandardowy
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.path}</p>
          {indexedInfo && (
            <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" weight="fill" />
              Zindeksowane: {new Date(indexedInfo.indexedAt).toLocaleString('pl-PL')} · szufladka{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                {indexedInfo.page}
              </code>
            </p>
          )}
        </div>

        {/* Scan result / spinner / remove */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {entry.scanning && <SpinnerGap className="h-4 w-4 animate-spin text-muted-foreground" />}

          {entry.scanResult && !entry.scanning && (
            <div className="flex items-center gap-2">
              {CATEGORIES.filter((c) => (entry.scanResult?.counts as Record<string, number>)?.[c.key] > 0).map(
                (c) => (
                  <span
                    key={c.key}
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${c.color}`}
                  >
                    {c.label}{' '}
                    {formatCount(
                      (entry.scanResult?.counts as Record<string, number>)[c.key],
                    )}
                  </span>
                ),
              )}
              <span className="text-xs text-muted-foreground font-medium">
                {formatCount(entry.scanResult.total)} plików
              </span>
            </div>
          )}

          {entry.scanError && !entry.scanning && (
            <span className="text-xs text-red-500">{entry.scanError}</span>
          )}

          {onRemove && (
            <button
              onClick={onRemove}
              disabled={saving}
              className="ml-1 rounded p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <Trash className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scan helper (async, updates state via callback)
// ---------------------------------------------------------------------------

async function scanFolders(
  currentEntries: FolderEntry[],
  paths: string[],
  cancelled: boolean | (() => boolean),
  setEntries: React.Dispatch<React.SetStateAction<FolderEntry[]>>,
): Promise<void> {
  if (paths.length === 0) {
    return;
  }

  // Mark as scanning
  setEntries((prev) =>
    prev.map((e) => (paths.includes(e.path) ? { ...e, scanning: true, scanError: null } : e)),
  );

  try {
    const nestcafe = getNestCafe();
    const results = await nestcafe.folderIndexing.scanFolders(paths);
    removeIndexedFolders(results.filter((result) => result.error).map((result) => result.path));

    if (typeof cancelled === 'function' ? cancelled() : cancelled) {
      return;
    }

    setEntries((prev) =>
      prev.map((e) => {
        const result = results.find((r) => r.path === e.path);
        if (!result) {
          return e;
        }
        const typed = result as FolderScanResult;
        return {
          ...e,
          scanning: false,
          scanResult: typed.error ? null : typed,
          scanError: typed.error,
        };
      }),
    );
  } catch (err) {
    if (typeof cancelled === 'function' ? cancelled() : cancelled) {
      return;
    }
    setEntries((prev) =>
      prev.map((e) =>
        paths.includes(e.path)
          ? { ...e, scanning: false, scanError: String(err) }
          : e,
      ),
    );
  }
}
