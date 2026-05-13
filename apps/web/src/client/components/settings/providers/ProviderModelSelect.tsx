import { ModelList } from '../shared';

interface ProviderModelSelectProps {
  models: Array<{ id: string; name: string; enabled?: boolean }>;
  selectedModelId: string | null | undefined;
  onChange: (modelId: string) => void;
  onModelsChange?: (models: Array<{ id: string; name: string; enabled?: boolean }>) => void;
  showModelError: boolean;
  onDisconnect: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

/** Model selector + disconnect controls shown when a provider is connected. */
export function ProviderModelSelect({
  models,
  selectedModelId,
  onChange,
  onModelsChange,
  showModelError,
  onRefresh,
  refreshing,
}: ProviderModelSelectProps) {
  return (
    <div className="space-y-3">
      <ModelList
        models={models}
        value={selectedModelId || null}
        onChange={onChange}
        onModelsChange={onModelsChange}
        error={showModelError && !selectedModelId}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
    </div>
  );
}
