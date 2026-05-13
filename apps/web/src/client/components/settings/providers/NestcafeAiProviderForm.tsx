import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { getNestCafe } from '@/lib/nestcafe';
import type { ConnectedProvider, CreditUsage } from '@nestcafe_ai/agent-core/common';
import { DEFAULT_PROVIDERS } from '@nestcafe_ai/agent-core/common';
import { ProviderFormHeader } from '../shared';
import { PROVIDER_LOGOS } from '@/lib/provider-logos';
import { getCreditStatusColor } from '@/hooks/useCreditsState';
import { settingsVariants, settingsTransitions } from '@/lib/animations';

// ─── Static config (module-level, derived once from constants) ────────────────

const NESTCAFE_CONFIG = DEFAULT_PROVIDERS.find((p) => p.id === 'nestcafe-ai');
if (!NESTCAFE_CONFIG || NESTCAFE_CONFIG.models.length === 0) {
  throw new Error('Accomplish provider configuration is missing required models');
}
const STATIC_MODELS = NESTCAFE_CONFIG.models.map((m) => ({
  id: m.fullId,
  name: m.displayName,
}));
const NESTCAFE_LOGO = PROVIDER_LOGOS['nestcafe-ai'];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function UsageSkeleton() {
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 rounded-full bg-muted animate-pulse" />
        <div className="h-3 w-24 rounded-full bg-muted animate-pulse" />
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted animate-pulse" />
      <div className="h-3 w-32 rounded-full bg-muted animate-pulse" />
    </div>
  );
}

// ─── Connection retry notice ─────────────────────────────────────────────────

function ConnectionRetryNotice() {
  const { t } = useTranslation('settings');
  return (
    <motion.div
      className="mt-3 rounded-lg border border-border bg-muted/20 p-3"
      variants={settingsVariants.fadeSlide}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={settingsTransitions.enter}
    >
      <div className="flex items-start gap-2.5">
        <span className="relative mt-[3px] flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-foreground/80">
            {t('providers.NestcafeAi.connectionIssue', 'Having trouble connecting')}
          </p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {t(
              'providers.NestcafeAi.retryingInBackground',
              'Retrying in the background — this will resolve when your connection is restored.',
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function UsageRetryNotice() {
  const { t } = useTranslation('settings');
  return (
    <motion.div
      className="mt-3 rounded-lg border border-border bg-muted/20 p-3"
      variants={settingsVariants.fadeSlide}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={settingsTransitions.enter}
    >
      <div className="flex items-start gap-2.5">
        <span className="relative mt-[3px] flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
        </span>
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-foreground/80">
            {t('providers.NestcafeAi.usageIssue', 'Unable to refresh credits')}
          </p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {t(
              'providers.NestcafeAi.usageRetryingInBackground',
              'Retrying in the background. Sending with NestCafe should still work.',
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Usage panel ──────────────────────────────────────────────────────────────

function formatResetDate(resetsAt: string): string | null {
  if (!resetsAt) return null;
  try {
    return new Date(resetsAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

function UsagePanel({ usage }: { usage: CreditUsage }) {
  const { t } = useTranslation('settings');
  const pct =
    usage.totalCredits > 0
      ? Math.max(0, Math.min(100, (usage.spentCredits / usage.totalCredits) * 100))
      : 0;

  const isExhausted = usage.remainingCredits <= 0;
  const barColor = getCreditStatusColor(usage);
  const resetsDate = formatResetDate(usage.resetsAt);

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">Credits</span>
        <span className="tabular-nums text-muted-foreground">
          {usage.spentCredits.toLocaleString()} / {usage.totalCredits.toLocaleString()} used
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {isExhausted ? (
        <p className="text-xs text-destructive">
          {resetsDate
            ? t('providers.NestcafeAi.exhaustedMessage', { date: resetsDate })
            : t(
                'providers.NestcafeAi.exhaustedMessageSoon',
                'Credits exhausted. They will reset soon.',
              )}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {resetsDate ? `Resets on ${resetsDate}` : 'Credits will reset soon'}
        </p>
      )}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

interface NestcafeAiProviderFormProps {
  connectedProvider?: ConnectedProvider;
  onConnect: (provider: ConnectedProvider) => void;
  onUpdateProvider?: (provider: ConnectedProvider) => void;
  onDisconnect: () => void;
  onModelChange: (modelId: string) => void;
  showModelError: boolean;
}

export function NestcafeAiProviderForm({
  connectedProvider,
  onConnect,
  onUpdateProvider,
  onDisconnect,
}: NestcafeAiProviderFormProps) {
  const { t } = useTranslation('settings');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usage, setUsage] = useState<CreditUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // Keep stable refs so effects never capture stale callbacks
  const onConnectRef = useRef(onConnect);
  onConnectRef.current = onConnect;
  const onUpdateProviderRef = useRef(onUpdateProvider);
  onUpdateProviderRef.current = onUpdateProvider;

  // Auto-connect on mount when not already connected
  const autoConnectRef = useRef<{ attempt: number; timeout: ReturnType<typeof setTimeout> | null }>(
    {
      attempt: 0,
      timeout: null,
    },
  );

  // Refresh availableModels with current capabilities if stale (e.g. DB saved before capabilities existed)
  // Refresh availableModels if stale (e.g. DB saved before models were populated)
  useEffect(() => {
    if (connectedProvider?.connectionStatus !== 'connected') return;
    if (!connectedProvider.availableModels || connectedProvider.availableModels.length === 0) {
      const update = onUpdateProviderRef.current ?? onConnectRef.current;
      update({ ...connectedProvider, availableModels: STATIC_MODELS });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedProvider?.connectionStatus]);

  useEffect(() => {
    if (connectedProvider?.connectionStatus === 'connected') return;

    const ref = autoConnectRef.current;
    ref.attempt = 0;
    let cancelled = false;
    setUsageLoading(true);

    const tryConnect = async () => {
      try {
        const nestcafe = getNestCafe();
        const data = await nestcafe.NestcafeAiEnsureReady();
        if (cancelled) return;
        if (!data.deviceFingerprint) {
          throw new Error('Missing deviceFingerprint in nestcafe-ai ready response');
        }
        setConnectionError(null);

        // Use onUpdateProvider (not onConnect) to refresh renderer state
        // without promoting nestcafe-ai to the active provider.
        const connected: ConnectedProvider = {
          providerId: 'nestcafe-ai',
          connectionStatus: 'connected',
          credentials: { type: 'nestcafe-ai', deviceFingerprint: data.deviceFingerprint },
          lastConnectedAt: new Date().toISOString(),
          availableModels: STATIC_MODELS,
          selectedModelId: STATIC_MODELS[0].id,
        };
        const update = onUpdateProviderRef.current ?? onConnectRef.current;
        update(connected);
      } catch (err) {
        if (cancelled) return;
        ref.attempt += 1;
        if (ref.attempt < 5) {
          // Fast retries: 1s, 2s, 4s, 8s
          const delay = Math.pow(2, ref.attempt - 1) * 1000;
          ref.timeout = setTimeout(tryConnect, delay);
        } else {
          // Show the soft error notice, then keep retrying every 30s
          setUsageLoading(false);
          setConnectionError(err instanceof Error ? err.message : t('status.connectionFailed'));
          ref.timeout = setTimeout(tryConnect, 30_000);
        }
      }
    };

    tryConnect();

    return () => {
      cancelled = true;
      if (ref.timeout) clearTimeout(ref.timeout);
    };
    // Only run on mount / when connectionStatus changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedProvider?.connectionStatus]);

  // Fetch usage once the provider is connected
  useEffect(() => {
    if (connectedProvider?.connectionStatus !== 'connected') return;
    let cancelled = false;
    setUsageLoading(true);
    getNestCafe()
      .NestcafeAiGetUsage()
      .then((data) => {
        if (!cancelled) {
          setUsage(data);
          setUsageError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setUsageError(err instanceof Error ? err.message : 'Unable to refresh credits');
        }
      })
      .finally(() => {
        if (!cancelled) setUsageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connectedProvider?.connectionStatus]);

  // Subscribe to live usage updates
  useEffect(() => {
    if (connectedProvider?.connectionStatus !== 'connected') return;
    const unsubscribe = getNestCafe().onNestcafeAiUsageUpdate?.((liveUsage) => {
      setUsage(liveUsage);
    });
    return () => {
      unsubscribe?.();
    };
  }, [connectedProvider?.connectionStatus]);

  // Periodic health check — polls usage every 30s while connected
  useEffect(() => {
    if (connectedProvider?.connectionStatus !== 'connected') return;

    const poll = async () => {
      try {
        const data = await getNestCafe().NestcafeAiGetUsage();
        setUsage(data);
        setUsageLoading(false);
        setUsageError(null);
      } catch (err) {
        setUsageError(err instanceof Error ? err.message : 'Unable to refresh credits');
      }
    };

    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [connectedProvider?.connectionStatus]);

  return (
    <div
      className="rounded-xl border border-border bg-card p-5"
      data-testid="provider-settings-panel"
    >
      <ProviderFormHeader logoSrc={NESTCAFE_LOGO} providerName="NestCafe" />

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {t(
            'providers.NestcafeAi.description',
            'Use the built-in model powered by NestCafe - no API key required.\nIncludes 200 free credits per month to get you started.',
          )}
        </p>

        <AnimatePresence mode="wait">
          {connectionError ? (
            <ConnectionRetryNotice key="connection-retry" />
          ) : usage ? (
            <UsagePanel key="usage" usage={usage} />
          ) : usageLoading ? (
            <UsageSkeleton key="skeleton" />
          ) : usageError ? (
            <UsageRetryNotice key="usage-retry" />
          ) : (
            <UsageSkeleton key="skeleton-fallback" />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {usage && !connectionError && usageError ? (
            <UsageRetryNotice key="usage-inline-retry" />
          ) : null}
        </AnimatePresence>

        {/* Disconnect button */}
        {connectedProvider?.connectionStatus === 'connected' && (
          <button
            onClick={async () => {
              try {
                await getNestCafe().NestcafeAiDisconnect();
              } catch {
                // best-effort
              }
              onDisconnect();
            }}
            className="mt-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            {t('providers.NestcafeAi.disconnect', 'Disconnect')}
          </button>
        )}
      </div>
    </div>
  );
}
