import { ClockCounterClockwise, CheckCircle, Folder } from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { IndexedFolderInfo } from './types';

interface IndexingHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  historyItems: IndexedFolderInfo[];
  lastHistoryItem?: IndexedFolderInfo;
}

export function IndexingHistoryDialog({
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
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
                      Pliki
                    </div>
                    <div className="font-medium text-foreground">{item.fileCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
                      Data
                    </div>
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
