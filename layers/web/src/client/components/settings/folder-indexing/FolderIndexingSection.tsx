import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  SpinnerGap,
  Folder,
  Rocket,
  CheckCircle,
  Clock,
  ClockCounterClockwise,
} from '@phosphor-icons/react';
import { getNestCafe } from '@/lib/nestcafe';
import { ModelIndicator } from '@/components/ui/ModelIndicator';
import type { FolderEntry, StartTaskFn, IndexProgressState, IndexedFolderInfo } from './types';
import { PREDEFINED_LOCATIONS } from './constants';
import { buildFolderPageName } from './utils';
import {
  getIndexRunSnapshot,
  subscribeIndexRun,
  setIndexRunSnapshot,
  startFolderIndexingRun,
  loadIndexedFolders,
  getIndexedFolderHistory,
  getSnapshotItems,
} from './index-run-state';
import { scanFolders } from './scan-folders';
import { IndexingHistoryDialog } from './IndexingHistoryDialog';
import { FolderRow } from './FolderRow';

export function FolderIndexingSection() {
  const snapshot = getIndexRunSnapshot();
  const [entries, setEntries] = useState<FolderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [indexing, setIndexing] = useState(snapshot.indexing);
  const [indexSuccess, setIndexSuccess] = useState(snapshot.success);
  const [indexProgress, setIndexProgress] = useState<IndexProgressState | null>(snapshot.progress);
  const [lastIndexedAt, setLastIndexedAt] = useState<string | null>(snapshot.lastIndexedAt);
  const [indexedFolders, setIndexedFolders] = useState<Record<string, IndexedFolderInfo>>(() =>
    loadIndexedFolders(),
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [canResumeIndexing, setCanResumeIndexing] = useState(
    !snapshot.indexing && getSnapshotItems(snapshot).length > snapshot.nextIndex,
  );
  const nestcafe = getNestCafe();
  const startBackgroundTask = useCallback<StartTaskFn>(
    (config) => nestcafe.startTask(config),
    [nestcafe],
  );

  useEffect(() => {
    return subscribeIndexRun((snap) => {
      setIndexing(snap.indexing);
      setIndexSuccess(snap.success);
      setIndexProgress(snap.progress);
      setLastIndexedAt(snap.lastIndexedAt);
      setCanResumeIndexing(
        !snap.indexing && getSnapshotItems(snap).length > snap.nextIndex,
      );
      setIndexedFolders(loadIndexedFolders());
    });
  }, []);

  useEffect(() => {
    const refreshIndexedFolders = () => setIndexedFolders(loadIndexedFolders());
    window.addEventListener('nestcafe:folder-indexing:indexed-folders-changed', refreshIndexedFolders);
    return () => window.removeEventListener('nestcafe:folder-indexing:indexed-folders-changed', refreshIndexedFolders);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const config = await nestcafe.folderIndexing.getConfig();

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

        for (const customPath of config.customPaths) {
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
      } finally {
        setSaving(false);
      }
    },
    [nestcafe],
  );

  const handleToggle = useCallback(
    async (entryId: string) => {
      setEntries((prev) => {
        const next = prev.map((e) => (e.id === entryId ? { ...e, selected: !e.selected } : e));
        saveConfig(next);
        const toggled = next.find((e) => e.id === entryId);
        if (toggled?.selected && !toggled.scanResult && !toggled.scanning) {
          scanFolders(next, [toggled.path], false, setEntries);
        }
        return next;
      });
    },
    [saveConfig],
  );

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
          progress: {
            current: 0,
            total: 0,
            currentFile: 'Brak plików do indeksowania.',
            done: true,
          },
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
        progress: {
          current: 0,
          total: 0,
          currentFile: '',
          done: true,
          error: 'Nie udało się uruchomić zadania.',
        },
      });
    }
  }, [entries, nestcafe, startBackgroundTask, indexing]);

  const handleResumeIndexing = useCallback(() => {
    const snap = getIndexRunSnapshot();
    const items = getSnapshotItems(snap);
    if (indexing || items.length <= snap.nextIndex) {
      return;
    }
    startFolderIndexingRun(items, startBackgroundTask, snap.nextIndex);
  }, [indexing, startBackgroundTask]);

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
            Wybierz foldery do indeksowania. Agent będzie widział strukturę plików (maks. 2
            poziomy).
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
                {lastHistoryItem.fileCount} plików ·{' '}
                {lastHistoryItem.path.split(/[\\/]/).pop() || lastHistoryItem.path}
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
              {indexProgress?.done
                ? 'Indeksowanie zakończone!'
                : 'Zadanie indeksowania uruchomione!'}
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
                width: `${
                  indexProgress.total > 0
                    ? Math.round((indexProgress.current / indexProgress.total) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          {indexProgress.error && (
            <p className="text-xs text-red-500 mt-2">{indexProgress.error}</p>
          )}
          {indexProgress.done && !indexProgress.error && (
            <p className="text-xs text-muted-foreground mt-2">
              Wyniki zapisane w pamięci wiki (strona{' '}
              <code className="text-xs bg-muted px-1 rounded">file-index</code>). Po ponownym
              uruchomieniu zostanie tylko status przy zindeksowanych folderach.
            </p>
          )}
          {canResumeIndexing && (
            <button
              onClick={handleResumeIndexing}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Rocket className="h-3.5 w-3.5" />
              Wznów od checkpointu ({getIndexRunSnapshot().nextIndex}/
              {getSnapshotItems(getIndexRunSnapshot()).length})
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
