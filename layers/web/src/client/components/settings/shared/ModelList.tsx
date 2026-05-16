import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type ModelListModel = { id: string; name: string; enabled?: boolean };

const ROW_HEIGHT = 72;
const OVERSCAN = 6;
const VIEWPORT_HEIGHT = 420;

const ModelRow = memo(function ModelRow({
  model,
  enabled,
  selected,
  onToggle,
}: {
  model: ModelListModel;
  enabled: boolean;
  selected: boolean;
  onToggle: (modelId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(model.id)}
      className={cn(
        'flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/40',
        selected && 'bg-muted/50',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{model.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{model.id}</span>
      </span>
      <span
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          enabled ? 'bg-primary' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-background shadow transition-transform',
            enabled ? 'translate-x-5' : 'translate-x-1',
          )}
        />
      </span>
    </button>
  );
});

interface ModelListProps {
  models: ModelListModel[];
  value: string | null | undefined;
  onChange: (modelId: string) => void;
  onModelsChange?: (models: ModelListModel[]) => void;
  error?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function ModelList({
  models,
  value,
  onChange,
  onModelsChange,
  error,
  onRefresh,
  refreshing,
}: ModelListProps) {
  const { t } = useTranslation('settings');
  const [query, setQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const scrollFrameRef = useRef<number | null>(null);

  const filteredModels = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return models;
    }
    return models.filter((model) => model.name.toLowerCase().includes(normalized));
  }, [models, query]);

  const isEnabled = (model: ModelListModel) => {
    return model.enabled !== false;
  };
  const enabledCount = models.filter(isEnabled).length;

  const visibleWindow = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2;
    const end = Math.min(filteredModels.length, start + visibleCount);
    return {
      start,
      end,
      items: filteredModels.slice(start, end),
      topPadding: start * ROW_HEIGHT,
      bottomPadding: Math.max(0, (filteredModels.length - end) * ROW_HEIGHT),
    };
  }, [filteredModels, scrollTop]);

  const updateModels = (nextModels: ModelListModel[]) => {
    if (onModelsChange) {
      onModelsChange(nextModels);
    }
  };

  const enableAll = () => updateModels(models.map((model) => ({ ...model, enabled: true })));
  const disableAll = () => updateModels(models.map((model) => ({ ...model, enabled: false })));

  const toggleModel = useCallback(
    (modelId: string) => {
      const model = models.find((item) => item.id === modelId);
      const nextEnabled = model ? !isEnabled(model) : true;
      updateModels(
        models.map((item) => (item.id === modelId ? { ...item, enabled: nextEnabled } : item)),
      );
      if (!onModelsChange) {
        onChange(modelId);
      }
    },
    [models, onChange, onModelsChange],
  );

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const nextScrollTop = event.currentTarget.scrollTop;
    if (scrollFrameRef.current !== null) {
      return;
    }
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      setScrollTop(nextScrollTop);
      scrollFrameRef.current = null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  return (
    <section
      className={cn('rounded-xl border bg-card', error ? 'border-destructive' : 'border-border')}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {t('model.listTitle', { defaultValue: 'Model list' })}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('model.enabledCount', { enabled: enabledCount, total: models.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={enableAll}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {t('model.enableAll')}
          </button>
          <button
            type="button"
            onClick={disableAll}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {t('model.disableAll')}
          </button>
          {onRefresh && (
            <button
              type="button"
              onClick={() => onRefresh()}
              disabled={refreshing}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {refreshing ? t('model.scanning') : t('model.fetchModels')}
            </button>
          )}
        </div>
      </div>
      <div className="border-b border-border p-4">
        <div className="relative max-w-sm">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('model.searchModels')}
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>
      <div className="max-h-[420px] overflow-y-auto" onScroll={handleScroll}>
        <div style={{ height: visibleWindow.topPadding }} />
        {visibleWindow.items.map((model) => {
          const enabled = isEnabled(model);
          const selected = value === model.id;

          return (
            <ModelRow
              key={model.id}
              model={model}
              enabled={enabled}
              selected={selected}
              onToggle={toggleModel}
            />
          );
        })}
        <div style={{ height: visibleWindow.bottomPadding }} />
      </div>
    </section>
  );
}
