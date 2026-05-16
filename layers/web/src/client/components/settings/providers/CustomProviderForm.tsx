import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ConnectedProvider, CustomCredentials } from '@nestcafe_ai/agent-core';
import { ModelList, ProviderFormHeader } from '../shared';
import { settingsVariants, settingsTransitions } from '@/lib/animations';
import { getNestCafe } from '@/lib/nestcafe';
import { Switch } from '@/components/ui/switch';
import { CustomProviderInputs } from './CustomProviderInputs';

import customLogo from '/assets/ai-logos/custom.svg';

type CustomModel = { id: string; name: string; enabled?: boolean };

function getDisabledModelsStorageKey(providerId: string) {
  return `nestcafe:custom-provider:${providerId}:disabled-models`;
}

function readDisabledModelIds(providerId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(getDisabledModelsStorageKey(providerId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(
      Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

function writeDisabledModelIds(providerId: string, disabledIds: Set<string>) {
  window.localStorage.setItem(
    getDisabledModelsStorageKey(providerId),
    JSON.stringify([...disabledIds]),
  );
}

const customProviderApiKeyDrafts = new Map<string, string>();
const customProviderFieldDrafts = new Map<
  string,
  { baseUrl?: string; displayName?: string; iconUrl?: string }
>();

interface CustomProviderFormProps {
  providerId: string;
  connectedProvider?: ConnectedProvider;
  onConnect: (provider: ConnectedProvider) => void;
  onUpdateProvider?: (provider: ConnectedProvider) => void;
  onDisconnect: () => void;
  onModelChange: (modelId: string) => void; // Unused - model is set during connection
  showModelError: boolean;
  onDelete?: () => void;
}

export function CustomProviderForm({
  providerId,
  connectedProvider,
  onConnect,
  onUpdateProvider,
  onModelChange,
  showModelError: _showModelError,
  onDelete,
}: CustomProviderFormProps) {
  const initialCredentials =
    connectedProvider?.credentials.type === 'custom' ? connectedProvider.credentials : undefined;
  const [baseUrl, setBaseUrl] = useState(
    () => customProviderFieldDrafts.get(providerId)?.baseUrl ?? initialCredentials?.baseUrl ?? '',
  );
  const [apiKey, setApiKey] = useState(() => customProviderApiKeyDrafts.get(providerId) ?? '');
  const [displayName, setDisplayName] = useState(
    () =>
      customProviderFieldDrafts.get(providerId)?.displayName ??
      initialCredentials?.displayName ??
      'Custom Endpoint',
  );
  const [iconUrl, setIconUrl] = useState(
    () => customProviderFieldDrafts.get(providerId)?.iconUrl ?? initialCredentials?.iconUrl ?? '',
  );
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<CustomModel[]>(
    () =>
      connectedProvider?.availableModels?.map((model) => ({
        id: model.id,
        name: model.name,
        enabled: model.enabled,
      })) ?? [],
  );
  const [disabledModelIds, setDisabledModelIds] = useState<Set<string>>(() => {
    const stored = readDisabledModelIds(providerId);
    for (const model of connectedProvider?.availableModels ?? []) {
      if (model.enabled === false) {
        stored.add(model.id);
      }
    }
    return stored;
  });
  const loadedProviderIdRef = useRef<string | null>(null);
  const lastAutoScanSignatureRef = useRef<string | null>(null);
  const autoScanTimerRef = useRef<number | null>(null);
  const modelSaveTimerRef = useRef<number | null>(null);

  const isConnected = connectedProvider?.connectionStatus === 'connected';

  const buildDraftProvider = (
    connectionStatus: ConnectedProvider['connectionStatus'] = connectedProvider?.connectionStatus ??
      'disconnected',
  ): ConnectedProvider => {
    const existingCredentials = connectedProvider?.credentials as CustomCredentials | undefined;
    const resolvedDisplayName =
      displayName || existingCredentials?.displayName || 'Custom Provider';
    const selectedModelId = connectedProvider?.selectedModelId ?? models[0]?.id ?? null;
    const selectedModelName =
      selectedModelId?.replace(/^custom\//, '') || existingCredentials?.modelName || '';

    return {
      providerId: providerId as never,
      connectionStatus,
      selectedModelId: connectionStatus === 'connected' ? selectedModelId : null,
      credentials: {
        type: 'custom',
        baseUrl: baseUrl.trim(),
        modelName: connectionStatus === 'connected' ? selectedModelName : '',
        hasApiKey: existingCredentials?.hasApiKey ?? false,
        keyPrefix: existingCredentials?.keyPrefix,
        displayName: resolvedDisplayName,
        iconUrl: iconUrl.trim() || undefined,
      } as CustomCredentials,
      lastConnectedAt: connectedProvider?.lastConnectedAt || new Date().toISOString(),
      availableModels:
        models.length > 0
          ? models.map((model) => ({ ...model, enabled: !disabledModelIds.has(model.id) }))
          : connectedProvider?.availableModels,
    };
  };

  const saveDraft = (connectionStatus?: ConnectedProvider['connectionStatus']) => {
    if (!baseUrl.trim()) {
      return;
    }
    const provider = buildDraftProvider(connectionStatus);
    if (onUpdateProvider) {
      onUpdateProvider(provider);
    } else {
      onConnect(provider);
    }
  };

  useEffect(() => {
    if (!connectedProvider || connectedProvider.credentials.type !== 'custom') {
      return;
    }

    if (loadedProviderIdRef.current === providerId) {
      return;
    }

    loadedProviderIdRef.current = providerId;
    const loadedBaseUrl = connectedProvider.credentials.baseUrl;
    const draft = customProviderFieldDrafts.get(providerId);
    const nextBaseUrl = draft?.baseUrl ?? loadedBaseUrl;
    const nextDisplayName =
      draft?.displayName ?? connectedProvider.credentials.displayName ?? 'Custom Provider';
    const nextIconUrl = draft?.iconUrl ?? connectedProvider.credentials.iconUrl ?? '';
    setBaseUrl(nextBaseUrl);
    setDisplayName(nextDisplayName);
    setIconUrl(nextIconUrl);
    customProviderFieldDrafts.set(providerId, {
      ...draft,
      baseUrl: nextBaseUrl,
      displayName: nextDisplayName,
      iconUrl: nextIconUrl,
    });
    lastAutoScanSignatureRef.current = `${providerId}::${loadedBaseUrl.trim()}::`;
    if (connectedProvider.credentials.hasApiKey) {
      getNestCafe()
        .getStoredApiKey(providerId)
        .then((storedApiKey) => {
          if (storedApiKey !== null && loadedProviderIdRef.current === providerId) {
            customProviderApiKeyDrafts.set(providerId, storedApiKey);
            setApiKey(storedApiKey);
            lastAutoScanSignatureRef.current = `${providerId}::${loadedBaseUrl.trim()}::${storedApiKey.trim()}`;
          }
        })
        .catch(() => {
          // Keep the current local input value if secure storage cannot be read.
        });
    }
    if (connectedProvider.availableModels?.length) {
      const nextDisabledIds = readDisabledModelIds(providerId);
      for (const model of connectedProvider.availableModels) {
        if (model.enabled === false) {
          nextDisabledIds.add(model.id);
        }
      }
      setDisabledModelIds(nextDisabledIds);
      setModels(
        connectedProvider.availableModels.map((model) => ({
          id: model.id,
          name: model.name,
          enabled: !nextDisabledIds.has(model.id),
        })),
      );
    }
  }, [connectedProvider, providerId]);

  const scanAndSave = async (options?: { baseUrl?: string; apiKey?: string }) => {
    const baseUrlToScan = options?.baseUrl ?? baseUrl;
    const apiKeyToScan = options?.apiKey ?? apiKey;

    // Validate inputs
    if (!baseUrlToScan.trim()) {
      setError('Base URL is required');
      return;
    }

    // Check for common URL mistakes
    const trimmedUrl = baseUrlToScan.trim();
    if (trimmedUrl.includes('/chat/completions')) {
      setError('Base URL should not include /chat/completions (it is added automatically)');
      return;
    }
    if (trimmedUrl.includes('/completions')) {
      setError('Base URL should end with /v1, not /completions');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const nestcafe = getNestCafe();
      const existingCredentials = connectedProvider?.credentials as CustomCredentials | undefined;
      const trimmedKey = apiKeyToScan.trim() || undefined;

      // Test connection to the endpoint
      const result = await nestcafe.testCustomConnection(baseUrlToScan.trim(), trimmedKey);
      if (!result.success) {
        setError(result.error || 'Connection failed');
        setModels([]);
        setConnecting(false);
        return;
      }

      // Save or remove API key based on user input
      if (trimmedKey) {
        await nestcafe.addApiKey(providerId as never, trimmedKey);
        customProviderApiKeyDrafts.set(providerId, trimmedKey);
        setApiKey(trimmedKey);
      } else if (!existingCredentials?.hasApiKey) {
        // Remove any previously stored key when connecting without one
        await nestcafe.removeApiKey(providerId as never);
        customProviderApiKeyDrafts.delete(providerId);
      }

      const scannedModels = (result.models || []).map((model) => {
        const id = `custom/${model.id.replace(/^custom\//, '')}`;
        return {
          id,
          name: model.name,
          enabled: !disabledModelIds.has(id),
        };
      });
      const resolvedModels = scannedModels;
      if (resolvedModels.length === 0) {
        setError(
          'No models found from this endpoint. Check Base URL and API key, then fetch again.',
        );
        setModels([]);
        setConnecting(false);
        return;
      }

      setModels(resolvedModels);

      const existingSelected = connectedProvider?.selectedModelId;
      const selectedModelId = resolvedModels.some((model) => model.id === existingSelected)
        ? existingSelected!
        : (resolvedModels[0]?.id ?? null);
      const selectedModelName = selectedModelId?.replace(/^custom\//, '') || '';

      const provider: ConnectedProvider = {
        providerId: providerId as never,
        connectionStatus: 'connected',
        selectedModelId,
        credentials: {
          type: 'custom',
          baseUrl: baseUrlToScan.trim(),
          modelName: selectedModelName,
          hasApiKey: !!trimmedKey || !!existingCredentials?.hasApiKey,
          keyPrefix: trimmedKey ? '••••' + trimmedKey.slice(-4) : existingCredentials?.keyPrefix,
          displayName: displayName.trim() || 'Custom Provider',
          iconUrl: iconUrl.trim() || undefined,
        } as CustomCredentials,
        lastConnectedAt: new Date().toISOString(),
        availableModels: resolvedModels,
      };

      onConnect(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (!connectedProvider || connectedProvider.credentials.type !== 'custom') {
      return;
    }

    const timer = window.setTimeout(() => {
      saveDraft();
    }, 700);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounced custom provider draft save
  }, [displayName, iconUrl, baseUrl]);

  useEffect(() => {
    if (!connectedProvider || connectedProvider.credentials.type !== 'custom') {
      return;
    }

    const timer = window.setTimeout(() => {
      const trimmedKey = apiKey.trim();
      const saveApiKeyDraft = async () => {
        const nestcafe = getNestCafe();
        const provider = buildDraftProvider();

        if (trimmedKey) {
          await nestcafe.addApiKey(providerId as never, trimmedKey);
          customProviderApiKeyDrafts.set(providerId, trimmedKey);
          provider.credentials = {
            ...provider.credentials,
            hasApiKey: true,
            keyPrefix: '••••' + trimmedKey.slice(-4),
          } as CustomCredentials;
        } else {
          await nestcafe.removeApiKey(providerId as never);
          customProviderApiKeyDrafts.delete(providerId);
          provider.credentials = {
            ...provider.credentials,
            hasApiKey: false,
            keyPrefix: undefined,
          } as CustomCredentials;
        }

        if (onUpdateProvider) {
          onUpdateProvider(provider);
        } else {
          onConnect(provider);
        }
      };

      void saveApiKeyDraft().catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to save API key');
      });
    }, 700);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounced secure-storage save for custom API key
  }, [apiKey]);

  const handleEnabledChange = (checked: boolean) => {
    setError(null);
    if (checked) {
      void scanAndSave();
      return;
    }
    saveDraft('disconnected');
  };

  const updateFieldDraft = (draft: {
    baseUrl?: string;
    displayName?: string;
    iconUrl?: string;
  }) => {
    customProviderFieldDrafts.set(providerId, {
      ...customProviderFieldDrafts.get(providerId),
      ...draft,
    });
  };

  const scheduleAutoScan = (nextBaseUrl: string, nextApiKey: string) => {
    if (autoScanTimerRef.current !== null) {
      window.clearTimeout(autoScanTimerRef.current);
    }

    const signature = `${providerId}::${nextBaseUrl.trim()}::${nextApiKey.trim()}`;
    autoScanTimerRef.current = window.setTimeout(() => {
      autoScanTimerRef.current = null;
      if (!nextBaseUrl.trim() || signature === lastAutoScanSignatureRef.current) {
        return;
      }
      lastAutoScanSignatureRef.current = signature;
      void scanAndSave({ baseUrl: nextBaseUrl, apiKey: nextApiKey });
    }, 2000);
  };

  const handleApiKeyChange = (value: string) => {
    lastAutoScanSignatureRef.current = null;
    customProviderApiKeyDrafts.set(providerId, value);
    setApiKey(value);
    setModels([]);
    scheduleAutoScan(baseUrl, value);
  };

  const handleBaseUrlChange = (value: string) => {
    lastAutoScanSignatureRef.current = null;
    updateFieldDraft({ baseUrl: value });
    setBaseUrl(value);
    setModels([]);
    scheduleAutoScan(value, apiKey);
  };

  const handleDisplayNameChange = (value: string) => {
    updateFieldDraft({ displayName: value });
    setDisplayName(value);
  };

  const handleIconUrlChange = (value: string) => {
    updateFieldDraft({ iconUrl: value });
    setIconUrl(value);
  };

  const persistModels = (nextModels: CustomModel[]) => {
    if (modelSaveTimerRef.current !== null) {
      window.clearTimeout(modelSaveTimerRef.current);
    }

    modelSaveTimerRef.current = window.setTimeout(() => {
      modelSaveTimerRef.current = null;
      if (!baseUrl.trim()) {
        return;
      }

      const existingCredentials = connectedProvider?.credentials as CustomCredentials | undefined;
      const selectedModelId = nextModels.some(
        (model) => model.id === connectedProvider?.selectedModelId && model.enabled !== false,
      )
        ? (connectedProvider?.selectedModelId ?? null)
        : (nextModels.find((model) => model.enabled !== false)?.id ?? nextModels[0]?.id ?? null);
      const selectedModelName = selectedModelId?.replace(/^custom\//, '') || '';
      const provider: ConnectedProvider = {
        providerId: providerId as never,
        connectionStatus: connectedProvider?.connectionStatus ?? 'connected',
        selectedModelId,
        credentials: {
          type: 'custom',
          baseUrl: baseUrl.trim(),
          modelName: selectedModelName,
          hasApiKey: !!apiKey.trim() || !!existingCredentials?.hasApiKey,
          keyPrefix: apiKey.trim()
            ? '••••' + apiKey.trim().slice(-4)
            : existingCredentials?.keyPrefix,
          displayName: displayName.trim() || 'Custom Provider',
          iconUrl: iconUrl.trim() || undefined,
        } as CustomCredentials,
        lastConnectedAt: connectedProvider?.lastConnectedAt || new Date().toISOString(),
        availableModels: nextModels,
      };

      if (onUpdateProvider) {
        onUpdateProvider(provider);
      } else {
        onConnect(provider);
      }
    }, 250);
  };

  const handleModelsChange = (nextModels: CustomModel[]) => {
    if (!baseUrl.trim()) {
      return;
    }
    const nextDisabledIds = new Set(
      nextModels.filter((model) => model.enabled === false).map((model) => model.id),
    );
    writeDisabledModelIds(providerId, nextDisabledIds);
    setDisabledModelIds(nextDisabledIds);
    setModels(nextModels);
    persistModels(nextModels);
  };

  useEffect(() => {
    return () => {
      if (autoScanTimerRef.current !== null) {
        window.clearTimeout(autoScanTimerRef.current);
      }
      if (modelSaveTimerRef.current !== null) {
        window.clearTimeout(modelSaveTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className="rounded-xl border border-border bg-card p-5"
      data-testid="provider-settings-panel"
    >
      <ProviderFormHeader
        logoSrc={iconUrl.trim() || customLogo}
        providerName={displayName || 'Custom Provider'}
      />

      <div className="space-y-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={isConnected ? 'connected-editable' : 'disconnected'}
            variants={settingsVariants.fadeSlide}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={settingsTransitions.enter}
            className="space-y-3"
          >
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Enable provider</p>
                <p className="text-xs text-muted-foreground">
                  Disabled custom providers stay in the list and keep their settings.
                </p>
              </div>
              <Switch
                checked={isConnected}
                onCheckedChange={handleEnabledChange}
                disabled={connecting}
                ariaLabel="Enable custom provider"
              />
            </div>
            <CustomProviderInputs
              baseUrl={baseUrl}
              apiKey={apiKey}
              displayName={displayName}
              iconUrl={iconUrl}
              connecting={connecting}
              error={error}
              onBaseUrlChange={handleBaseUrlChange}
              onApiKeyChange={handleApiKeyChange}
              onDisplayNameChange={handleDisplayNameChange}
              onIconUrlChange={handleIconUrlChange}
            />
            {models.length === 0 && (
              <button
                type="button"
                onClick={() => void scanAndSave()}
                disabled={connecting || !baseUrl.trim()}
                className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {connecting ? 'Scanning models…' : 'Fetch models'}
              </button>
            )}
            {models.length > 0 && (
              <ModelList
                models={models}
                value={connectedProvider?.selectedModelId || null}
                onChange={onModelChange}
                onModelsChange={handleModelsChange}
                onRefresh={scanAndSave}
                refreshing={connecting}
              />
            )}
            {isConnected && (
              <p className="text-sm text-muted-foreground">Provider is enabled and ready to use.</p>
            )}
            {providerId.startsWith('custom:') && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                Delete custom provider
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
