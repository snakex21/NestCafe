import { useCallback, useMemo } from 'react';
import { hasAnyReadyProvider, getOAuthProviderDisplayName } from '@nestcafe_ai/agent-core/common';
import type { useExecutionCore } from './useExecutionCore';
import type { SettingsTabId } from '@/components/layout/settings-tabs';

type CoreState = ReturnType<typeof useExecutionCore>;

export function useExecutionPauseActions(
  s: CoreState,
  openSettingsView: (initialTab: SettingsTabId) => void,
) {
  const { nestcafe, t } = s;

  const resumePausedTask = useCallback(
    async (message: string): Promise<boolean> => {
      const isE2EMode = await nestcafe.isE2EMode();
      if (!isE2EMode) {
        const settings = await nestcafe.getProviderSettings();
        if (!hasAnyReadyProvider(settings)) {
          s.setPendingFollowUp(message);
          s.setSettingsInitialTab('providers');
          openSettingsView('providers');
          return false;
        }
      }
      return await s.sendFollowUp(message, []);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- s is a stable hook result; individual actions are listed
    [nestcafe, s.setPendingFollowUp, s.setSettingsInitialTab, openSettingsView, s.sendFollowUp],
  );

  const handleContinue = useCallback(async () => {
    return await resumePausedTask('continue');
  }, [resumePausedTask]);

  const { pauseAction, setTaskActionError, setIsTaskActionRunning } = s;

  const handlePauseAction = useCallback(async () => {
    if (!pauseAction || pauseAction.type !== 'oauth-connect') {
      return;
    }
    const providerName = getOAuthProviderDisplayName(pauseAction.providerId);
    setTaskActionError(null);
    setIsTaskActionRunning(true);
    try {
      // Slack MCP is currently the only supported oauth-connect provider.
      const status = await nestcafe.getSlackMcpOauthStatus();
      if (status.pendingAuthorization) {
        await nestcafe.logoutSlackMcp();
      }
      if (!status.connected) {
        await nestcafe.loginSlackMcp();
      }
      const refreshed = await nestcafe.getSlackMcpOauthStatus();
      if (!refreshed.connected) {
        throw new Error(t('questionPrompt.oauthStillDisconnected', { provider: providerName }));
      }
      return await resumePausedTask(pauseAction.successText ?? `${providerName} is connected.`);
    } catch (error) {
      setTaskActionError(
        error instanceof Error
          ? error.message
          : t('questionPrompt.oauthFailed', { provider: providerName }),
      );
      return false;
    } finally {
      setIsTaskActionRunning(false);
    }
  }, [nestcafe, t, resumePausedTask, pauseAction, setTaskActionError, setIsTaskActionRunning]);

  const handleTaskAction = useMemo(
    () => (s.isConnectorAuthPause ? handlePauseAction : handleContinue),
    [s.isConnectorAuthPause, handlePauseAction, handleContinue],
  );

  return { handleContinue, handlePauseAction, handleTaskAction, resumePausedTask };
}
