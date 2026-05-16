import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence } from 'framer-motion';
import type { ConnectedProvider, LiteLLMCredentials } from '@nestcafe_ai/agent-core/common';
import { ProviderFormHeader } from '../shared';
import { getNestCafe } from '@/lib/nestcafe';
import { LiteLLMDisconnectedForm, LiteLLMConnectedSection } from './LiteLLMFormSections';

import litellmLogo from '/assets/ai-logos/litellm.svg';

interface LiteLLMProviderFormProps {
  connectedProvider?: ConnectedProvider;
  onConnect: (provider: ConnectedProvider) => void;
  onDisconnect: () => void;
  onModelChange: (modelId: string) => void;
  showModelError: boolean;
}

export function LiteLLMProviderForm({
  connectedProvider,
  onConnect,
  onDisconnect,
  onModelChange,
  showModelError,
}: LiteLLMProviderFormProps) {
  const { t } = useTranslation('settings');
  const [serverUrl, setServerUrl] = useState('http://localhost:4000');
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAutoConnectSignatureRef = useRef<string | null>(null);

  const isConnected = connectedProvider?.connectionStatus === 'connected';

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      const nestcafe = getNestCafe();
      const trimmedKey = apiKey.trim() || undefined;

      const result = await nestcafe.testLiteLLMConnection(serverUrl, trimmedKey);
      if (!result.success) {
        setError(result.error || t('status.connectionFailed'));
        setConnecting(false);
        return;
      }

      if (trimmedKey) {
        await nestcafe.addApiKey('litellm', trimmedKey);
      } else {
        await nestcafe.removeApiKey('litellm');
      }

      const models =
        result.models?.map((m) => ({
          id: m.id,
          name: m.name,
        })) || [];

      const provider: ConnectedProvider = {
        providerId: 'litellm',
        connectionStatus: 'connected',
        selectedModelId: models[0]?.id ?? null,
        credentials: {
          type: 'litellm',
          serverUrl,
          hasApiKey: !!trimmedKey,
          keyPrefix: trimmedKey ? trimmedKey.substring(0, 10) + '...' : undefined,
        } as LiteLLMCredentials,
        lastConnectedAt: new Date().toISOString(),
        availableModels: models,
      };

      onConnect(provider);
      setApiKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('status.connectionFailed'));
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (isConnected || connecting || !serverUrl.trim()) {
      return;
    }

    const signature = `${serverUrl.trim()}::${apiKey.trim()}`;
    if (signature === lastAutoConnectSignatureRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      lastAutoConnectSignatureRef.current = signature;
      void handleConnect();
    }, 900);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce LiteLLM endpoint/key validation and model scan
  }, [serverUrl, apiKey, isConnected, connecting]);

  return (
    <div
      className="rounded-xl border border-border bg-card p-5"
      data-testid="provider-settings-panel"
    >
      <ProviderFormHeader logoSrc={litellmLogo} providerName={t('providers.litellm')} />
      <div className="space-y-3">
        <AnimatePresence mode="wait">
          {!isConnected ? (
            <LiteLLMDisconnectedForm
              serverUrl={serverUrl}
              onServerUrlChange={setServerUrl}
              apiKey={apiKey}
              onApiKeyChange={setApiKey}
              connecting={connecting}
              error={error}
              onConnect={handleConnect}
            />
          ) : (
            <LiteLLMConnectedSection
              connectedProvider={connectedProvider}
              onDisconnect={onDisconnect}
              onModelChange={onModelChange}
              showModelError={showModelError}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
