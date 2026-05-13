import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DEFAULT_PROVIDERS,
  PROVIDER_META,
  getModelDisplayName,
} from '@nestcafe_ai/agent-core/common';
import type { ConnectedProvider, ProviderId } from '@nestcafe_ai/agent-core/common';

interface ProviderSubMenuProps {
  providerId: ProviderId;
  provider: ConnectedProvider;
  onSelectModel: (providerId: ProviderId, modelId: string) => Promise<void>;
  disabled: boolean;
}

export function ProviderSubMenu({
  providerId,
  provider,
  onSelectModel,
  disabled,
}: ProviderSubMenuProps) {
  const providerName =
    providerId.startsWith('custom:') && provider.credentials.type === 'custom'
      ? provider.credentials.displayName || 'Custom Provider'
      : (PROVIDER_META[providerId]?.name ?? providerId);

  // If availableModels is defined (even empty) use it; only fall back to static config when undefined
  const models: Array<{ id: string; displayName: string }> =
    provider.availableModels !== undefined
      ? provider.availableModels
          .filter((m) => m.enabled !== false)
          .map((m) => ({ id: m.id, displayName: m.name }))
      : (DEFAULT_PROVIDERS.find((p) => p.id === providerId)?.models ?? []).map((m) => ({
          id: m.fullId,
          displayName: getModelDisplayName(m.fullId),
        }));

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        disabled={disabled}
        className="gap-2 px-3 py-2 text-sm cursor-pointer"
      >
        <span className="min-w-0 flex-1 truncate">{providerName}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-[min(420px,70vh)] w-56 overflow-y-auto overflow-x-hidden">
        {models.length === 0 ? (
          <DropdownMenuItem disabled className="px-3 py-2 text-sm text-muted-foreground">
            No models available
          </DropdownMenuItem>
        ) : (
          models.map((model) => (
            <DropdownMenuItem
              key={model.id}
              disabled={disabled}
              className="px-3 py-2 text-sm cursor-pointer"
              onClick={() => void onSelectModel(providerId, model.id)}
              title={model.displayName}
            >
              <span className="min-w-0 flex-1 truncate">{model.displayName}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
