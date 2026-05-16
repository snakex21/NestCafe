import { useState, useEffect, useCallback, useMemo } from 'react';
import { getNestCafe } from '../lib/nestcafe';
import { isProviderReady, type ProviderId } from '@nestcafe_ai/agent-core/common';
import type { CreditUsage } from '@nestcafe_ai/agent-core/common';

export type { CreditUsage };

export function getCreditStatusColor(usage: CreditUsage): string {
  if (usage.remainingCredits <= 0) return 'bg-red-500';
  const pct = usage.totalCredits > 0 ? (usage.spentCredits / usage.totalCredits) * 100 : 0;
  if (pct < 60) return 'bg-emerald-500';
  if (pct < 85) return 'bg-amber-500';
  return 'bg-red-500';
}

export function useCreditsState() {
  const nestcafe = useMemo(() => getNestCafe(), []);

  const [usage, setUsage] = useState<CreditUsage | null>(null);
  const [isCreditsBlocked, setIsCreditsBlocked] = useState(false);
  const [hasAlternativeReadyProvider, setHasAlternativeReadyProvider] = useState(false);
  const [showQuotaInline, setShowQuotaInline] = useState(false);

  type ProviderSettingsSnapshot = Awaited<ReturnType<typeof nestcafe.getProviderSettings>>;

  const applyLiveUsage = useCallback(
    (settings: ProviderSettingsSnapshot, liveUsage: CreditUsage): boolean => {
      const connectedAccomplish = settings.connectedProviders['nestcafe-ai'];
      const readyAlternativeExists = (
        Object.keys(settings.connectedProviders) as ProviderId[]
      ).some(
        (providerId) =>
          providerId !== 'nestcafe-ai' && isProviderReady(settings.connectedProviders[providerId]),
      );
      setHasAlternativeReadyProvider(readyAlternativeExists);

      if (connectedAccomplish?.connectionStatus !== 'connected') {
        setUsage(null);
        setIsCreditsBlocked(false);
        setShowQuotaInline(false);
        return false;
      }

      const isExhausted = liveUsage.remainingCredits <= 0;
      const shouldBlock =
        settings.activeProviderId === 'nestcafe-ai' &&
        isProviderReady(connectedAccomplish) &&
        isExhausted;

      setUsage(liveUsage);
      setIsCreditsBlocked(shouldBlock);

      if (!shouldBlock) {
        setShowQuotaInline(false);
      }
      return shouldBlock;
    },
    [],
  );

  const refreshCreditsState = useCallback(async (): Promise<boolean> => {
    try {
      const settings = await nestcafe.getProviderSettings();
      const connectedAccomplish = settings.connectedProviders['nestcafe-ai'];
      if (connectedAccomplish?.connectionStatus !== 'connected') {
        const readyAlternativeExists = (
          Object.keys(settings.connectedProviders) as ProviderId[]
        ).some(
          (providerId) =>
            providerId !== 'nestcafe-ai' &&
            isProviderReady(settings.connectedProviders[providerId]),
        );
        setHasAlternativeReadyProvider(readyAlternativeExists);
        setUsage(null);
        setIsCreditsBlocked(false);
        setShowQuotaInline(false);
        return false;
      }
      const liveUsage = await nestcafe.NestcafeAiGetUsage();
      return applyLiveUsage(settings, liveUsage);
    } catch {
      setHasAlternativeReadyProvider(false);
      setUsage(null);
      setIsCreditsBlocked(false);
      setShowQuotaInline(false);
      return false;
    }
  }, [nestcafe, applyLiveUsage]);

  const openQuotaBlockExperience = useCallback(() => {
    setShowQuotaInline(true);
  }, []);

  // Initial fetch — inline to avoid ESLint set-state-in-effect warning
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [usageData, settings] = await Promise.all([
          nestcafe.NestcafeAiGetUsage?.(),
          nestcafe.getProviderSettings(),
        ]);
        if (cancelled || !usageData) return;
        applyLiveUsage(settings, usageData);
      } catch {
        // Accomplish AI not connected — no-op
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nestcafe, applyLiveUsage]);

  // Subscribe to live usage updates
  useEffect(() => {
    const unsubscribe = nestcafe.onNestcafeAiUsageUpdate?.((liveUsage) => {
      void (async () => {
        try {
          const settings = await nestcafe.getProviderSettings();
          applyLiveUsage(settings, liveUsage);
        } catch {
          setHasAlternativeReadyProvider(false);
          setUsage(null);
          setIsCreditsBlocked(false);
          setShowQuotaInline(false);
        }
      })();
    });

    return () => {
      unsubscribe?.();
    };
  }, [nestcafe, applyLiveUsage]);

  return {
    usage,
    isCreditsBlocked,
    hasAlternativeReadyProvider,
    showQuotaInline,
    setShowQuotaInline,
    refreshCreditsState,
    openQuotaBlockExperience,
  };
}
