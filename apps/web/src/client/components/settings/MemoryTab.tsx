import { useEffect, useState, useCallback } from 'react';
import { Trash, ArrowLeft, BookOpen, Spinner } from '@phosphor-icons/react';
import { getNestCafe } from '@/lib/nestcafe';
import {
  MEMORY_HISTORY_CHANGED_EVENT,
  isAutoMemoryEnabled,
  loadMemoryHistory,
  setAutoMemoryEnabled,
  type MemoryNotificationDetail,
} from '@/lib/autoMemory';

interface WikiPage {
  name: string;
  size: number;
  lines: number;
  mtime: string;
}

export function MemoryTab() {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [pageContent, setPageContent] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [autoMemory, setAutoMemory] = useState(() => isAutoMemoryEnabled());
  const [memoryHistory, setMemoryHistory] = useState<MemoryNotificationDetail[]>(() =>
    loadMemoryHistory(),
  );

  const fetchPages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getNestCafe().memory.listPages();
      setPages(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  useEffect(() => {
    const refreshHistory = () => setMemoryHistory(loadMemoryHistory());
    window.addEventListener(MEMORY_HISTORY_CHANGED_EVENT, refreshHistory);
    return () => window.removeEventListener(MEMORY_HISTORY_CHANGED_EVENT, refreshHistory);
  }, []);

  const openPage = async (name: string) => {
    try {
      setPageLoading(true);
      setSelectedPage(name);
      const { content } = await getNestCafe().memory.readPage(name);
      setPageContent(content);
    } catch {
      setPageContent('(nie udało się wczytać strony)');
    } finally {
      setPageLoading(false);
    }
  };

  const deletePage = async (name: string) => {
    try {
      await getNestCafe().memory.deletePage(name);
      setPages((prev) => prev.filter((p) => p.name !== name));
      if (selectedPage === name) {
        setSelectedPage(null);
        setPageContent(null);
      }
    } catch {
      // ignore
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  if (selectedPage) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setSelectedPage(null);
              setPageContent(null);
            }}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Wróć
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{selectedPage}</span>
            <button
              type="button"
              onClick={() => deletePage(selectedPage)}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-destructive transition-colors"
              title="Usuń"
            >
              <Trash className="h-4 w-4" />
            </button>
          </div>
        </div>
        {pageLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <pre className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-muted/20 p-4 text-sm text-foreground whitespace-pre-wrap font-mono">
            {pageContent || '(puste)'}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Pamięć wiki</h3>
          <p className="text-xs text-muted-foreground">
            Trwała pamięć Markdown — agent zapisuje tu fakty, projekty i preferencje.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchPages}
          disabled={loading}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {loading ? 'Ładowanie…' : 'Odśwież'}
        </button>
      </div>

      <label className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3">
        <div>
          <div className="text-sm font-medium text-foreground">Automatyczna pamięć rozmów</div>
          <p className="text-xs text-muted-foreground">
            Po zakończeniu zadania cichy Memory Manager zapisze tylko trwałe, przydatne fakty. Możesz to wyłączyć.
          </p>
        </div>
        <input
          type="checkbox"
          checked={autoMemory}
          onChange={(event) => {
            const enabled = event.target.checked;
            setAutoMemory(enabled);
            setAutoMemoryEnabled(enabled);
          }}
          className="h-4 w-4 accent-primary"
        />
      </label>

      {memoryHistory.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h4 className="text-sm font-semibold text-foreground">Ostatnio zapamiętane</h4>
            <p className="text-xs text-muted-foreground">
              Historia automatycznie zapisanych faktów i cofnięć.
            </p>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {memoryHistory.slice(0, 8).map((item) => (
              <div key={item.id} className="border-b border-border px-4 py-3 last:border-b-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString('pl-PL')}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    item.undone
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-primary/10 text-primary'
                  }`}
                  >
                    {item.undone ? 'cofnięte' : `${item.facts.length} faktów`}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {item.facts.slice(0, 3).map((fact) => (
                    <p key={fact.id ?? `${fact.page}-${fact.content}`} className="truncate text-xs text-muted-foreground">
                      <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{fact.page}</code>{' '}
                      {fact.content}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted/10 py-12">
          <BookOpen className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Pamięć wiki jest pusta. Agent uzupełni ją po zakończonych zadaniach.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          {pages.map((page) => (
            <div
              key={page.name}
              className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/20 cursor-pointer"
              onClick={() => openPage(page.name)}
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {page.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {page.lines} linii · {formatSize(page.size)} · aktualizacja {formatDate(page.mtime)}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deletePage(page.name);
                }}
                className="ml-3 rounded-md border border-border p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                title="Usuń"
              >
                <Trash className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
