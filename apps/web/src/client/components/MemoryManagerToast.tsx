import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, X } from '@phosphor-icons/react';
import {
  MEMORY_NOTIFICATION_EVENT,
  markMemoryNotificationUndone,
  type MemoryNotificationDetail,
} from '@/lib/autoMemory';
import { getNestCafe } from '@/lib/nestcafe';
import { openSettingsView } from '@/lib/settingsNavigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function MemoryManagerToast() {
  const [notification, setNotification] = useState<MemoryNotificationDetail | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    const handleNotification = (event: Event) => {
      const detail = (event as CustomEvent<MemoryNotificationDetail>).detail;
      if (detail?.facts?.length > 0) {
        setNotification(detail);
      }
    };

    window.addEventListener(MEMORY_NOTIFICATION_EVENT, handleNotification);
    return () => window.removeEventListener(MEMORY_NOTIFICATION_EVENT, handleNotification);
  }, []);

  const handleUndo = async () => {
    if (!notification || undoing) {
      return;
    }
    setUndoing(true);
    try {
      const nestcafe = getNestCafe();
      const byPage = new Map<string, string[]>();
      for (const fact of notification.facts) {
        byPage.set(fact.page, [...(byPage.get(fact.page) ?? []), fact.content]);
      }

      for (const [page, contents] of byPage) {
        const { content } = await nestcafe.memory.readPage(page);
        let nextContent = content;
        for (const factContent of contents) {
          nextContent = removeMemoryFactFromPage(nextContent, factContent);
        }
        if (nextContent !== content) {
          await nestcafe.memory.writePage(page, nextContent);
        }
      }

      markMemoryNotificationUndone(notification.id);
      setNotification({
        ...notification,
        undone: true,
        facts: notification.facts.map((fact) => ({ ...fact, undone: true })),
      });
    } finally {
      setUndoing(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            className="fixed bottom-5 right-5 z-50 w-[340px] rounded-xl border border-border bg-card p-4 shadow-lg"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Brain className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {notification.undone
                    ? 'Cofnięto zapis pamięci'
                    : `Zapamiętano ${notification.facts.length} ${notification.facts.length === 1 ? 'rzecz' : 'rzeczy'}`}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {notification.undone
                    ? 'Ostatnio zapisane fakty zostały usunięte ze stron wiki.'
                    : 'Memory Manager zapisał trwałe fakty do wiki.'}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailsOpen(true)}
                    className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Pokaż
                  </button>
                  <button
                    type="button"
                    onClick={() => openSettingsView({ initialTab: 'memory' })}
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    Pamięć
                  </button>
                  {!notification.undone && (
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={undoing}
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                    >
                      {undoing ? 'Cofanie…' : 'Cofnij'}
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Zamknij powiadomienie pamięci"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Co zapamiętano
            </DialogTitle>
            <DialogDescription>
              Te fakty zostały zapisane przez Memory Managera po ostatnim zadaniu.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
            {notification?.facts.map((fact, index) => (
              <div key={`${fact.page}-${index}`} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {fact.page}
                  </code>
                  {fact.category && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {fact.category}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{fact.content}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function removeMemoryFactFromPage(pageContent: string, factContent: string): string {
  const trimmedFact = factContent.trim();
  if (!trimmedFact) {
    return pageContent;
  }

  const directIndex = pageContent.indexOf(trimmedFact);
  if (directIndex !== -1) {
    return `${pageContent.slice(0, directIndex)}${pageContent.slice(directIndex + trimmedFact.length)}`
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  const lines = trimmedFact.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return pageContent;
  }
  let nextContent = pageContent;
  for (const line of lines) {
    nextContent = nextContent.replace(line, '');
  }
  return nextContent.replace(/\n{3,}/g, '\n\n').trim();
}
