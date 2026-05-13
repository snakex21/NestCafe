import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { settingsVariants, settingsTransitions } from '@/lib/animations';
import type { ConnectedProvider, LMStudioCredentials } from '@nestcafe_ai/agent-core/common';
import { ConnectButton, ProviderFormHeader, FormError } from '../shared';
import { useLMStudioProviderConnect } from './useLMStudioProviderConnect';
import { LMStudioModelSelector } from './LMStudioModelSelector';

import lmstudioLogo from '/assets/ai-logos/lmstudio.png';

interface LMStudioProviderFormProps {
  connectedProvider?: ConnectedProvider;
  onConnect: (provider: ConnectedProvider) => void;
  onUpdateProvider?: (provider: ConnectedProvider) => void;
  onDisconnect: () => void;
  onModelChange: (modelId: string) => void;
  showModelError: boolean;
}

export function LMStudioProviderForm({
  connectedProvider,
  onConnect,
  onUpdateProvider,
  onDisconnect,
  onModelChange,
  showModelError,
}: LMStudioProviderFormProps) {
  const { t } = useTranslation('settings');
  const {
    serverUrl,
    setServerUrl,
    connecting,
    refreshing,
    error,
    models,
    handleConnect,
    handleRefresh,
  } = useLMStudioProviderConnect({ connectedProvider, onConnect, onUpdateProvider, onDisconnect });

  const isConnected = connectedProvider?.connectionStatus === 'connected';

  return (
    <div
      className="rounded-xl border border-border bg-card p-5"
      data-testid="provider-settings-panel"
    >
      <div className="flex items-start justify-between gap-4">
        <ProviderFormHeader logoSrc={lmstudioLogo} providerName="LM Studio" />
        <button
          type="button"
          onClick={isConnected ? onDisconnect : handleConnect}
          disabled={connecting}
          className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            isConnected ? 'bg-primary' : 'bg-muted'
          }`}
          aria-label={isConnected ? t('buttons.disconnect') : t('buttons.connect')}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-background shadow transition-transform ${
              isConnected ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      <div className="space-y-3">
        <AnimatePresence mode="wait">
          {!isConnected ? (
            <motion.div
              key="disconnected"
              variants={settingsVariants.fadeSlide}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={settingsTransitions.enter}
              className="space-y-3"
            >
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {t('lmstudio.serverUrl')}
                </label>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://localhost:1234"
                  data-testid="lmstudio-server-url"
                  className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">{t('lmstudio.serverHint')}</p>
              </div>
              <FormError error={error} />
              <ConnectButton onClick={handleConnect} connecting={connecting} />
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
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {t('lmstudio.serverUrl')}
                </label>
                <input
                  type="text"
                  value={
                    (connectedProvider?.credentials as LMStudioCredentials)?.serverUrl ||
                    'http://localhost:1234'
                  }
                  disabled
                  className="w-full rounded-md border border-input bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground"
                />
              </div>
              <LMStudioModelSelector
                models={models}
                value={connectedProvider?.selectedModelId || null}
                onChange={onModelChange}
                error={showModelError && !connectedProvider?.selectedModelId}
                onRefresh={handleRefresh}
                refreshing={refreshing}
              />
              <FormError error={error} />
              <div className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-400">
                <svg
                  className="h-5 w-5 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="font-medium">{t('common.contextLengthWarning')}</p>
                  <p className="text-blue-400/80 mt-1">{t('common.contextLengthWarningDetail')}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
