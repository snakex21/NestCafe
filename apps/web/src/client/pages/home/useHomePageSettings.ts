import { useState, useCallback } from 'react';
import { getNestCafe } from '@/lib/nestcafe';
import { hasAnyReadyProvider } from '@nestcafe_ai/agent-core/common';
import { createLogger } from '@/lib/logger';
import type { SettingsTabId } from '@/components/layout/settings-tabs';
import { openSettingsView } from '@/lib/settingsNavigation';

const logger = createLogger('HomePageSettings');

type SettingsTab = Extract<SettingsTabId, 'providers' | 'voice' | 'skills' | 'integrations'>;

interface UseHomePageSettingsParams {
  onResume: () => Promise<void>;
}

export interface UseHomePageSettingsReturn {
  showSettingsDialog: boolean;
  settingsInitialTab: SettingsTab;
  resumeAfterSettingsSave: boolean;
  setResumeAfterSettingsSave: (v: boolean) => void;
  setShowSettingsDialog: (v: boolean) => void;
  setSettingsInitialTab: (tab: SettingsTab) => void;
  handleSettingsDialogChange: (open: boolean) => void;
  handleOpenSpeechSettings: () => void;
  handleOpenModelSettings: () => void;
  handleOpenSettings: (tab: SettingsTab) => void;
  handleApiKeySaved: () => Promise<void>;
}

export function useHomePageSettings({
  onResume,
}: UseHomePageSettingsParams): UseHomePageSettingsReturn {
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('providers');
  const [resumeAfterSettingsSave, setResumeAfterSettingsSave] = useState(false);

  const nestcafe = getNestCafe();

  const openSettingsTab = useCallback((tab: SettingsTab) => {
    openSettingsView({ initialTab: tab });
  }, []);

  const handleSettingsDialogChange = useCallback((open: boolean) => {
    setShowSettingsDialog(open);
    if (!open) {
      setResumeAfterSettingsSave(false);
      setSettingsInitialTab('providers');
    }
  }, []);

  const handleOpenSpeechSettings = useCallback(() => {
    setSettingsInitialTab('voice');
    openSettingsTab('voice');
  }, [openSettingsTab]);

  const handleOpenModelSettings = useCallback(() => {
    setSettingsInitialTab('providers');
    openSettingsTab('providers');
  }, [openSettingsTab]);

  const handleOpenSettings = useCallback(
    (tab: SettingsTab) => {
      setSettingsInitialTab(tab);
      openSettingsTab(tab);
    },
    [openSettingsTab],
  );

  const handleApiKeySaved = useCallback(async () => {
    if (!resumeAfterSettingsSave) {
      setShowSettingsDialog(false);
      return;
    }
    try {
      const settings = await nestcafe.getProviderSettings();
      if (!hasAnyReadyProvider(settings)) {
        setSettingsInitialTab('providers');
        setShowSettingsDialog(true);
        return;
      }
      setShowSettingsDialog(false);
      await onResume();
      setResumeAfterSettingsSave(false);
    } catch (err) {
      logger.error('Failed to resume task after settings save:', err);
    }
  }, [resumeAfterSettingsSave, nestcafe, onResume]);

  return {
    showSettingsDialog,
    settingsInitialTab,
    resumeAfterSettingsSave,
    setResumeAfterSettingsSave,
    setShowSettingsDialog,
    setSettingsInitialTab,
    handleSettingsDialogChange,
    handleOpenSpeechSettings,
    handleOpenModelSettings,
    handleOpenSettings,
    handleApiKeySaved,
  };
}
