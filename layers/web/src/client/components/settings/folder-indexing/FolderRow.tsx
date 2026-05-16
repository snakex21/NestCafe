import { CheckSquare, Square, SpinnerGap, CheckCircle, Trash } from '@phosphor-icons/react';
import type { FolderEntry, IndexedFolderInfo } from './types';
import { CATEGORIES } from './constants';
import { formatCount } from './utils';

interface FolderRowProps {
  entry: FolderEntry;
  onToggle: () => void;
  onRemove?: () => void;
  saving: boolean;
  indexedInfo?: IndexedFolderInfo;
}

export function FolderRow({ entry, onToggle, onRemove, saving, indexedInfo }: FolderRowProps) {
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
              {CATEGORIES.filter(
                (c) => (entry.scanResult?.counts as Record<string, number>)?.[c.key] > 0,
              ).map((c) => (
                <span
                  key={c.key}
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${c.color}`}
                >
                  {c.label}{' '}
                  {formatCount((entry.scanResult?.counts as Record<string, number>)[c.key])}
                </span>
              ))}
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
