import { useTranslation } from 'react-i18next';
import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { settingsVariants, settingsTransitions } from '@/lib/animations';
import type { ProviderId, ConnectedProvider } from '@nestcafe_ai/agent-core/common';
import { PROVIDER_META, DEFAULT_PROVIDERS } from '@nestcafe_ai/agent-core/common';
import { ProviderFormHeader, FormError } from '../shared';
import { PROVIDER_LOGOS, DARK_INVERT_PROVIDERS } from '@/lib/provider-logos';
import { ProviderModelSelect } from './ProviderModelSelect';
import { ProviderAdvancedSettings } from './ProviderAdvancedSettings';
import { useClassicProviderConnect } from './useClassicProviderConnect';
import { ClassicProviderOpenAISection } from './ClassicProviderOpenAISection';
import { ClassicApiKeyInput } from './ClassicApiKeyInput';
import { getNestCafe } from '@/lib/nestcafe';

interface ClassicProviderFormProps {
  providerId: ProviderId;
  connectedProvider?: ConnectedProvider;
  onConnect: (provider: ConnectedProvider) => void;
  onDisconnect: () => void;
  onModelChange: (modelId: string) => void;
  onModelsChange?: (models: Array<{ id: string; name: string; enabled?: boolean }>) => void;
  showModelError: boolean;
}

export function ClassicProviderForm({
  providerId,
  connectedProvider,
  onConnect,
  onDisconnect,
  onModelChange,
  onModelsChange,
  showModelError,
}: ClassicProviderFormProps) {
  const { t } = useTranslation('settings');
  const meta = PROVIDER_META[providerId];
  const providerConfig = DEFAULT_PROVIDERS.find((p) => p.id === providerId);
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [storedApiKey, setStoredApiKey] = useState<string | null>(null);
  const [refreshedModels, setRefreshedModels] = useState<Array<{
    id: string;
    name: string;
    enabled?: boolean;
  }> | null>(null);
  const isOpenAI = providerId === 'openai';
  const hasEditableBaseUrl = providerConfig?.editableBaseUrl === true;
  const defaultBaseUrl = providerConfig?.baseUrl ?? '';

  const conn = useClassicProviderConnect({
    providerId,
    connectedProvider,
    onConnect,
    isOpenAI,
    hasEditableBaseUrl,
    defaultBaseUrl,
  });

  const staticModels =
    providerConfig?.models.map((m) => ({ id: m.fullId, name: m.displayName })) || [];
  const models = refreshedModels
    ? refreshedModels
    : connectedProvider?.availableModels?.length
      ? connectedProvider.availableModels.map((m) => ({
          id: m.id,
          name: m.name,
          enabled: m.enabled,
        }))
      : (conn.fetchedModels ?? staticModels);
  const providerName = t(`providers.${providerId}`, { defaultValue: meta.name });
  const logoSrc = PROVIDER_LOGOS[providerId];
  const savedKeyPreview =
    storedApiKey ??
    ((connectedProvider?.credentials as { keyPrefix?: string } | undefined)?.keyPrefix || null);

  useEffect(() => {
    if (!conn.isConnected) {
      setStoredApiKey(null);
      return;
    }

    let cancelled = false;
    setStoredApiKey(null);
    getNestCafe()
      .getStoredApiKey(providerId)
      .then((key) => {
        if (!cancelled) {
          setStoredApiKey(key);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStoredApiKey(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [conn.isConnected, connectedProvider?.lastConnectedAt, providerId]);

  const handleRefreshModels = async () => {
    if (!providerConfig?.modelsEndpoint || !connectedProvider) {
      return;
    }
    setRefreshingModels(true);
    try {
      const result = await getNestCafe().fetchProviderModels(providerId, {
        baseUrl: connectedProvider.customBaseUrl,
      });
      if (result.success && result.models) {
        const currentModels = connectedProvider.availableModels ?? [];
        const modelsWithExistingState = result.models.map((model) => {
          const currentModel = currentModels.find((item) => item.id === model.id);
          return {
            ...model,
            enabled: currentModel?.enabled,
          };
        });
        setRefreshedModels(modelsWithExistingState);
        onConnect({ ...connectedProvider, availableModels: modelsWithExistingState });
      }
    } finally {
      setRefreshingModels(false);
    }
  };

  const handleModelsChange = useCallback(
    (updatedModels: Array<{ id: string; name: string; enabled?: boolean }>) => {
      if (!connectedProvider) return;
      const availableModels = updatedModels.map((m) => ({
        id: m.id,
        name: m.name,
        enabled: m.enabled !== false,
      }));
      onConnect({ ...connectedProvider, availableModels });
      onModelsChange?.(updatedModels);
    },
    [connectedProvider, onConnect, onModelsChange],
  );

  const apiKeyInput = (
    <ClassicApiKeyInput
      apiKey={conn.apiKey}
      onChange={conn.setApiKey}
      onClear={() => conn.setApiKey('')}
      connecting={conn.connecting}
      error={conn.error}
      isConnected={conn.isConnected}
      savedApiKey={savedKeyPreview}
    />
  );

  return (
    <div
      className="rounded-xl border border-border bg-card p-5"
      data-testid="provider-settings-panel"
    >
      <div className="flex items-start justify-between gap-4">
        <ProviderFormHeader
          logoSrc={logoSrc}
          providerName={providerName}
          invertInDark={DARK_INVERT_PROVIDERS.has(providerId)}
        />
        <button
          type="button"
          onClick={conn.isConnected ? onDisconnect : conn.handleConnect}
          disabled={conn.connecting || (!conn.isConnected && !conn.apiKey.trim())}
          className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            conn.isConnected ? 'bg-primary' : 'bg-muted'
          }`}
          aria-label={conn.isConnected ? t('buttons.disconnect') : t('buttons.connect')}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-background shadow transition-transform ${
              conn.isConnected ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {isOpenAI && !conn.isConnected && (
        <ClassicProviderOpenAISection
          apiKey={conn.apiKey}
          apiKeyInput={apiKeyInput}
          openAiBaseUrl={conn.openAiBaseUrl}
          onOpenAiBaseUrlChange={conn.setOpenAiBaseUrl}
          error={conn.error}
          connecting={conn.connecting}
          signingIn={conn.signingIn}
          helpUrl={meta.helpUrl}
          onChatGptSignIn={conn.handleChatGptSignIn}
          onConnect={conn.handleConnect}
        />
      )}

      {!isOpenAI && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">{t('apiKey.title')}</label>
            {meta.helpUrl && (
              <a
                href={meta.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-primary underline"
              >
                {t('help.findApiKey')}
              </a>
            )}
          </div>
          <AnimatePresence mode="wait">
            {!conn.isConnected ? (
              <motion.div
                key="disconnected"
                variants={settingsVariants.fadeSlide}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={settingsTransitions.enter}
                className="space-y-3"
              >
                {apiKeyInput}
                {hasEditableBaseUrl && (
                  <ProviderAdvancedSettings
                    fieldId={`${providerId}-base-url-input`}
                    value={conn.customBaseUrl}
                    onChange={conn.setCustomBaseUrl}
                    placeholder={defaultBaseUrl}
                  />
                )}
                <FormError error={conn.error} />
                {conn.connecting && (
                  <p className="text-sm text-muted-foreground">Scanning models and saving…</p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="connected"
                variants={settingsVariants.fadeSlide}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={settingsTransitions.enter}
                className="space-y-3"
              >
                {apiKeyInput}
                {hasEditableBaseUrl && (
                  <ProviderAdvancedSettings
                    fieldId={`${providerId}-base-url-input`}
                    value={conn.customBaseUrl}
                    onChange={conn.setCustomBaseUrl}
                    placeholder={defaultBaseUrl}
                  />
                )}
                {!conn.error && (
                  <ProviderModelSelect
                    models={models}
                    selectedModelId={connectedProvider?.selectedModelId}
                    onChange={onModelChange}
                    onModelsChange={handleModelsChange}
                    showModelError={showModelError}
                    onDisconnect={onDisconnect}
                    onRefresh={providerConfig?.modelsEndpoint ? handleRefreshModels : undefined}
                    refreshing={refreshingModels}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {isOpenAI && conn.isConnected && (
        <ProviderModelSelect
          models={models}
          selectedModelId={connectedProvider?.selectedModelId}
          onChange={onModelChange}
          onModelsChange={handleModelsChange}
          showModelError={showModelError}
          onDisconnect={onDisconnect}
          onRefresh={providerConfig?.modelsEndpoint ? handleRefreshModels : undefined}
          refreshing={refreshingModels}
        />
      )}
    </div>
  );
}
