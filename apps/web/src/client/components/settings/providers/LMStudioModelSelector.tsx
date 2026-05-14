import { useTranslation } from 'react-i18next';
import { ModelList } from '../shared';
import type { LMStudioModel } from './useLMStudioProviderConnect';

type LMStudioSelectorModel = { id: string; name: string; enabled?: boolean };

export function LMStudioModelSelector({
  models,
  value,
  onChange,
  onModelsChange,
  error,
  onRefresh,
  refreshing,
}: {
  models: LMStudioModel[];
  value: string | null;
  onChange: (modelId: string) => void;
  onModelsChange?: (models: LMStudioSelectorModel[]) => void;
  error: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const { t } = useTranslation('settings');
  const selectorModels = models.map((model) => {
    return { id: `lmstudio/${model.id}`, name: model.name, enabled: model.enabled };
  });

  return (
    <div>
      <ModelList
        models={selectorModels}
        value={value}
        onChange={onChange}
        onModelsChange={onModelsChange}
        error={error}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
      <p className="pt-2 text-xs text-muted-foreground">
        {t('lmstudio.toolVerificationSkipped', {
          defaultValue: 'LM Studio models are not filtered by tool-calling verification.',
        })}
      </p>
    </div>
  );
}
