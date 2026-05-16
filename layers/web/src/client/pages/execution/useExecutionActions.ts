import { useEffect, useCallback } from 'react';
import { hasAnyReadyProvider } from '@nestcafe_ai/agent-core/common';
import { createLogger } from '../../lib/logger';
import type { useExecutionCore } from './useExecutionCore';
import { useExecutionEffects } from './useExecutionEffects';
import { useExecutionPauseActions } from './useExecutionPauseActions';
import type { SettingsTabId } from '@/components/layout/settings-tabs';
import { openSettingsView } from '@/lib/settingsNavigation';

const logger = createLogger('ExecutionActions');

type CoreState = ReturnType<typeof useExecutionCore>;
type ExecutionSettingsTab = Extract<
  SettingsTabId,
  'providers' | 'voice' | 'skills' | 'integrations'
>;

/** Action callbacks for the execution page. Derived from core state. */
export function useExecutionActions(s: CoreState) {
  const { id, navigate, nestcafe } = s;

  const openSettingsTab = useCallback((initialTab: SettingsTabId) => {
    openSettingsView({ initialTab });
  }, []);

  useExecutionEffects(s, nestcafe);

  const { handleContinue, handlePauseAction, handleTaskAction } = useExecutionPauseActions(
    s,
    openSettingsTab,
  );

  const handleFollowUp = useCallback(async () => {
    if (!s.followUp.trim() && s.attachments.length === 0) {
      return;
    }
    if (s.followUp.length > 0 && s.isFollowUpOverLimit) {
      return;
    }
    const isE2EMode = await nestcafe.isE2EMode();
    if (!isE2EMode) {
      const settings = await nestcafe.getProviderSettings();
      if (!hasAnyReadyProvider(settings)) {
        s.setPendingFollowUp(s.followUp);
        s.setSettingsInitialTab('providers');
        openSettingsTab('providers');
        return;
      }
    }
    const ok = await s.sendFollowUp(s.followUp, s.attachments);
    if (ok) {
      s.setFollowUp('');
      s.setAttachments([]);
    }
  }, [nestcafe, s, openSettingsTab]);

  const handleEditUserMessage = useCallback(
    async (_message: import('@nestcafe_ai/agent-core/common').TaskMessage, content: string) => {
      if (!s.currentTask || s.isLoading || !s.hasSession) {
        return;
      }
      await s.rerunFromMessage(_message.id, content);
    },
    [s],
  );

  useEffect(() => {
    if (!s.pendingSpeechFollowUpRef.current) {
      return;
    }
    if (!s.canFollowUp || s.isLoading) {
      return;
    }
    if (s.followUp !== s.pendingSpeechFollowUpRef.current) {
      return;
    }
    s.pendingSpeechFollowUpRef.current = null;
    void handleFollowUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.canFollowUp, s.followUp, s.isLoading, handleFollowUp]);

  const handleSettingsDialogClose = (open: boolean) => {
    s.setShowSettingsDialog(open);
    if (!open) {
      s.setPendingFollowUp(null);
      s.setSettingsInitialTab('providers');
    }
  };

  const handleApiKeySaved = async () => {
    s.setShowSettingsDialog(false);
    if (s.pendingFollowUp) {
      const ok = await s.sendFollowUp(s.pendingFollowUp, s.attachments);
      if (ok) {
        s.setFollowUp('');
        s.setPendingFollowUp(null);
        s.setAttachments([]);
      }
    }
  };

  const handlePermissionResponse = async (
    allowed: boolean,
    selectedOpts?: string[],
    customText?: string,
  ) => {
    if (!s.permissionRequest || !s.currentTask) {
      return;
    }
    await s.respondToPermission({
      requestId: s.permissionRequest.id,
      taskId: s.permissionRequest.taskId,
      decision: allowed ? 'allow' : 'deny',
      selectedOptions: selectedOpts,
      customText: customText,
    });
    if (!allowed && s.permissionRequest.type === 'question') {
      s.interruptTask();
    }
  };

  const handleBugReport = useCallback(async () => {
    if (!s.currentTask || !id) {
      return;
    }
    s.setBugReporting(true);
    try {
      const [screenshotResult, axtreeResult] = await Promise.all([
        nestcafe.captureScreenshot(),
        nestcafe.captureAxtree(),
      ]);
      const result = await nestcafe.generateBugReport({
        taskId: s.currentTask.id,
        taskPrompt: s.currentTask.prompt,
        taskStatus: s.currentTask.status,
        taskCreatedAt: s.currentTask.createdAt,
        taskCompletedAt: s.currentTask.completedAt,
        messages: s.currentTask.messages as unknown[],
        debugLogs: s.debugLogs as unknown[],
        screenshot: screenshotResult.success ? screenshotResult.data : undefined,
        axtree: axtreeResult.success ? axtreeResult.data : undefined,
      });
      if (result.success) {
        s.setBugReportSaved(true);
        if (s.bugSavedTimerRef.current) {
          clearTimeout(s.bugSavedTimerRef.current);
        }
        s.bugSavedTimerRef.current = setTimeout(() => {
          s.setBugReportSaved(false);
          s.bugSavedTimerRef.current = null;
        }, 2500);
      }
    } catch (err) {
      logger.error('Bug report failed:', err);
    } finally {
      s.setBugReporting(false);
    }
  }, [nestcafe, s, id]);

  const handleRepeatTask = useCallback(async () => {
    if (!s.currentTask) {
      return;
    }
    if (
      ['pending', 'queued', 'running', 'waiting_permission', 'waiting'].includes(
        s.currentTask.status,
      )
    ) {
      return;
    }
    s.setRepeatingTask(true);
    try {
      const newTask = await nestcafe.startTask({ prompt: s.currentTask.prompt });
      navigate(`/execution/${newTask.id}`);
    } catch (err) {
      logger.error('Failed to repeat task:', err);
    } finally {
      s.setRepeatingTask(false);
    }
  }, [nestcafe, s, navigate]);

  const handleOpenSpeechSettings = useCallback(() => {
    s.setSettingsInitialTab('voice');
    openSettingsTab('voice');
  }, [s, openSettingsTab]);
  const handleOpenModelSettings = useCallback(() => {
    s.setSettingsInitialTab('providers');
    openSettingsTab('providers');
  }, [s, openSettingsTab]);
  const handleOpenSettings = useCallback(
    (tab: ExecutionSettingsTab) => {
      s.setSettingsInitialTab(tab);
      openSettingsTab(tab);
    },
    [s, openSettingsTab],
  );

  return {
    handleFollowUp,
    handleEditUserMessage,
    handleSettingsDialogClose,
    handleApiKeySaved,
    handleContinue,
    handlePauseAction,
    handleTaskAction,
    handlePermissionResponse,
    handleBugReport,
    handleRepeatTask,
    handleOpenSettings,
    handleOpenSpeechSettings,
    handleOpenModelSettings,
  };
}
