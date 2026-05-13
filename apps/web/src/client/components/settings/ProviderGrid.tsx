import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import type { ProviderId, ProviderSettings } from '@nestcafe_ai/agent-core/common';
import { PROVIDER_META, isProviderReady } from '@nestcafe_ai/agent-core/common';
import { ProviderCard } from './ProviderCard';
import { getNestCafe } from '@/lib/nestcafe';
import { PROVIDER_LOGOS, DARK_INVERT_PROVIDERS } from '@/lib/provider-logos';
import { cn } from '@/lib/utils';

// Provider order matching Figma design (4 columns per row)
const PROVIDER_ORDER: ProviderId[] = [
  'openai',
  'anthropic',
  'google',
  'bedrock',
  'vertex',
  'moonshot',
  'azure-foundry',
  'deepseek',
  'zai',
  'ollama',
  'lmstudio',
  'huggingface-local',
  'xai',
  'openrouter',
  'litellm',
  'minimax',
  'nebius',
  'together',
  'fireworks',
  'groq',
  'venice',
  'nim',
  'qwen-china',
  'qwen-international',
  'xiaomi',
  'xiaomi-token',
  'perplexity',
  'custom',
];

interface ProviderGridProps {
  settings: ProviderSettings;
  selectedProvider: ProviderId | null;
  onSelectProvider: (providerId: ProviderId) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  layout?: 'grid' | 'list';
  onAddCustomProvider?: () => Promise<ProviderId>;
}

export function ProviderGrid({
  settings,
  selectedProvider,
  onSelectProvider,
  expanded,
  onToggleExpanded,
  layout = 'grid',
  onAddCustomProvider,
}: ProviderGridProps) {
  const { t } = useTranslation('settings');
  const [search, setSearch] = useState('');
  const [hasFreeMode, setHasFreeMode] = useState<boolean | null>(null);

  const handleAddCustomProvider = async () => {
    if (onAddCustomProvider) {
      const newProviderId = await onAddCustomProvider();
      onSelectProvider(newProviderId);
    }
  };

  const filteredProviders = useMemo(() => {
    const customProviderIds = (Object.keys(settings?.connectedProviders ?? {}).filter((id) =>
      id.startsWith('custom:'),
    ) as ProviderId[]).sort((a, b) => {
      const providerA = settings?.connectedProviders?.[a];
      const providerB = settings?.connectedProviders?.[b];
      const nameA =
        providerA?.credentials.type === 'custom' ? providerA.credentials.displayName || a : a;
      const nameB =
        providerB?.credentials.type === 'custom' ? providerB.credentials.displayName || b : b;
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' }) || a.localeCompare(b);
    });
    const providers = [...customProviderIds, ...PROVIDER_ORDER.filter((id) => id !== 'custom')];

    if (!search.trim()) return providers;
    const query = search.toLowerCase();
    return providers.filter((id) => {
      const meta = id.startsWith('custom:') ? PROVIDER_META.custom : PROVIDER_META[id];
      const connectedProvider = settings?.connectedProviders?.[id];
      const customCredentials =
        id.startsWith('custom:') && connectedProvider?.credentials.type === 'custom'
          ? connectedProvider.credentials
          : undefined;
      const providerName = customCredentials?.displayName || meta.name;
      return providerName.toLowerCase().includes(query);
    });
  }, [search, hasFreeMode, settings?.connectedProviders]);

  if (layout === 'list') {
    const connectedProviders = filteredProviders.filter(
      (providerId) => settings?.connectedProviders?.[providerId]?.connectionStatus === 'connected',
    );
    const disconnectedProviders = filteredProviders.filter(
      (providerId) => settings?.connectedProviders?.[providerId]?.connectionStatus !== 'connected',
    );
    const sections = [
      { label: t('providers.enabled'), providers: connectedProviders },
      { label: t('providers.disabled'), providers: disconnectedProviders },
    ].filter((section) => section.providers.length > 0);

    return (
      <div className="flex h-full min-h-0 flex-col border-r border-border bg-muted/20 p-4">
        <div className="mb-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('providers.title')}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('providers.selectProvider', {
                  defaultValue: 'Select a provider to configure it.',
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddCustomProvider}
              className="rounded-md border border-border px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground"
              title="Add custom provider"
            >
              +
            </button>
          </div>
          <div className="relative">
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
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('providers.search')}
              data-testid="provider-search-input"
              className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-4">
            {sections.map((section) => (
              <div key={section.label} className="space-y-1">
                <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.label}
                </div>
                {section.providers.map((providerId) => {
                  const connectedProvider = settings?.connectedProviders?.[providerId];
                  const providerReady = isProviderReady(connectedProvider);
                  const isConnected = connectedProvider?.connectionStatus === 'connected';
                  const customCredentials =
                    providerId.startsWith('custom:') &&
                    connectedProvider?.credentials.type === 'custom'
                      ? connectedProvider.credentials
                      : undefined;
                  const isCustomProvider = providerId.startsWith('custom:');
                  const providerName =
                    customCredentials?.displayName ||
                    (isCustomProvider ? t('providers.custom') : t(`providers.${providerId}`));
                  const providerLabel = isCustomProvider
                    ? t('providerLabels.custom')
                    : t(`providerLabels.${providerId}`);
                  const logoSrc =
                    customCredentials?.iconUrl ||
                    PROVIDER_LOGOS[providerId] ||
                    PROVIDER_LOGOS.custom;
                  const selected = selectedProvider === providerId;

                  return (
                    <button
                      key={providerId}
                      onClick={() => onSelectProvider(providerId)}
                      data-testid={`provider-card-${providerId}`}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                        selected
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-provider-bg-hover">
                        <img
                          src={logoSrc}
                          alt={providerName}
                          className={cn(
                            'h-5 w-5 object-contain',
                            DARK_INVERT_PROVIDERS.has(providerId) && 'dark:invert',
                          )}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{providerName}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {providerLabel}
                        </span>
                      </span>
                      {providerReady ? (
                        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                          {t('status.ready')}
                        </span>
                      ) : isConnected ? (
                        <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                          {t('status.noModel')}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-provider-bg p-4" data-testid="provider-grid">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-foreground">{t('providers.title')}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAddCustomProvider}
            className="rounded-md border border-border px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground"
            title="Add custom provider"
          >
            +
          </button>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
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
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('providers.search')}
              data-testid="provider-search-input"
              className="w-48 rounded-md border border-input bg-background pl-9 pr-3 py-1.5 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Providers - first 4 always visible */}
      <div className="grid grid-cols-4 gap-3 min-h-[110px] justify-items-center">
        {filteredProviders.slice(0, 4).map((providerId) => (
          <ProviderCard
            key={providerId}
            providerId={providerId}
            connectedProvider={settings?.connectedProviders?.[providerId]}
            isActive={settings?.activeProviderId === providerId}
            isSelected={selectedProvider === providerId}
            onSelect={onSelectProvider}
          />
        ))}
      </div>

      {/* Expanded providers (5-10) with staggered animation */}
      <AnimatePresence mode="sync">
        {expanded && filteredProviders.length > 4 && (
          <motion.div
            className="grid grid-cols-4 gap-3 mt-3 justify-items-center overflow-hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {filteredProviders.slice(4).map((providerId, index) => (
              <motion.div
                key={providerId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: index * 0.03 }}
              >
                <ProviderCard
                  providerId={providerId}
                  connectedProvider={settings?.connectedProviders?.[providerId]}
                  isActive={settings?.activeProviderId === providerId}
                  isSelected={selectedProvider === providerId}
                  onSelect={onSelectProvider}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Show All / Hide toggle */}
      <div className="mt-4 text-center border-t border-border pt-3">
        <button
          onClick={onToggleExpanded}
          className="text-sm text-muted-foreground hover:text-foreground font-medium"
          data-testid="show-all-toggle"
        >
          {expanded ? t('providers.hide') : t('providers.showAll')}
        </button>
      </div>
    </div>
  );
}
