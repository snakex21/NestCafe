import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { settingsVariants, settingsTransitions } from '@/lib/animations';
import type { ProviderId } from '@nestcafe_ai/agent-core/common';
import { ProviderGrid } from '@/components/settings/ProviderGrid';
import { ProviderSettingsPanel } from '@/components/settings/ProviderSettingsPanel';
import { SpeechSettingsForm } from '@/components/settings/SpeechSettingsForm';
import { SkillsPanel, AddSkillDropdown } from '@/components/settings/skills';
import { WorkspacesPanel } from '@/components/settings/WorkspacesPanel';
import { AboutTab } from '@/components/settings/AboutTab';
import { GeneralTab } from '@/components/settings/GeneralTab';
import { MemoryTab } from '@/components/settings/MemoryTab';
import { FolderIndexingSection } from '@/components/settings/folder-indexing';
import { SandboxSection } from '@/components/settings/SandboxSection';
import { IntegrationsPanel } from '@/components/settings/integrations';
import { SchedulerPanel } from '@/components/settings/scheduler';

import { CloudBrowsersPanel } from '@/components/settings/CloudBrowsersPanel';
import { cn } from '@/lib/utils';
import logoImage from '/assets/logo-1.png';
import { SETTINGS_TABS, type SettingsTabId } from './settings-tabs';
import { useSettingsDialog } from './useSettingsDialog';
import { ChatText } from '@phosphor-icons/react';

interface SettingsViewProps {
  onClose: () => void;
  onApiKeySaved?: () => void;
  initialProvider?: ProviderId;
  initialTab?: SettingsTabId;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApiKeySaved?: () => void;
  initialProvider?: ProviderId;
  initialTab?: SettingsTabId;
}

export function SettingsDialog({
  open,
  onOpenChange,
  onApiKeySaved,
  initialProvider,
  initialTab = 'providers',
}: SettingsDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <SettingsView
      onClose={() => onOpenChange(false)}
      onApiKeySaved={onApiKeySaved}
      initialProvider={initialProvider}
      initialTab={initialTab}
    />
  );
}

export function SettingsView({
  onClose,
  onApiKeySaved,
  initialProvider,
  initialTab = 'providers',
}: SettingsViewProps) {
  const { t } = useTranslation('settings');
  const s = useSettingsDialog({
    open: true,
    onOpenChange: (nextOpen) => {
      if (!nextOpen) {
        onClose();
      }
    },
    onApiKeySaved,
    initialProvider,
    initialTab,
  });

  if (s.loading || !s.settings) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-background" data-testid="settings-dialog">
        <div className="flex items-center gap-4 border-b border-border px-8 py-5">
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChatText className="h-4 w-4 shrink-0" />
            {t('navigation.backToChat')}
          </button>
          <h1 className="text-base font-semibold text-foreground">{t('title')}</h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 w-full overflow-hidden bg-background"
      data-testid="settings-dialog"
    >
      <nav className="w-60 shrink-0 border-r border-border bg-muted/30 p-4 flex flex-col gap-1">
        <div className="px-3 py-2 mb-1 flex items-center gap-2">
          <img
            src={logoImage}
            alt="NestCafe"
            className="dark:invert"
            style={{ height: '20px', paddingLeft: '6px' }}
          />
          <span className="text-sm font-semibold text-foreground/80">NestCafe</span>
        </div>
        <button
          onClick={onClose}
          className="mb-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground"
        >
          <ChatText className="h-4 w-4 shrink-0" />
          {t('navigation.backToChat')}
        </button>
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => s.setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left',
              s.activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
            )}
          >
            <tab.icon className="h-4 w-4 shrink-0" />
            {t(tab.labelKey)}
          </button>
        ))}
      </nav>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center border-b border-border px-8 py-5">
          <h1 className="text-base font-semibold text-foreground">
            {SETTINGS_TABS.find((tab) => tab.id === s.activeTab)?.labelKey &&
              t(SETTINGS_TABS.find((tab) => tab.id === s.activeTab)!.labelKey)}
          </h1>
        </div>

        <div
          className={cn(
            'flex-1 overflow-y-auto',
            s.activeTab === 'providers' ? 'p-0' : 'px-8 py-6',
          )}
        >
          <div
            className={cn(
              s.activeTab === 'providers' ? 'h-full min-h-0' : 'mx-auto max-w-5xl space-y-6',
            )}
          >
            <AnimatePresence>
              {s.closeWarning && (
                <motion.div
                  className="rounded-lg border border-warning bg-warning/10 p-4 mb-6"
                  variants={settingsVariants.fadeSlide}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={settingsTransitions.enter}
                >
                  <div className="flex items-start gap-3">
                    <svg
                      className="h-5 w-5 text-warning flex-shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-warning">
                        {t('warnings.noProviderReady')}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t('warnings.noProviderReadyDescription')}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={s.handleForceClose}
                          className="rounded-md px-3 py-1.5 text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80"
                        >
                          {t('warnings.closeAnyway')}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {s.activeTab === 'providers' && (
              <div className="grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)]">
                <section className="min-h-0">
                  <ProviderGrid
                    settings={s.settings}
                    selectedProvider={s.selectedProvider}
                    onSelectProvider={s.handleSelectProvider}
                    expanded={s.gridExpanded}
                    onToggleExpanded={() => s.setGridExpanded(!s.gridExpanded)}
                    layout="list"
                    onAddCustomProvider={s.handleAddCustomProvider}
                  />
                </section>
                <section className="min-w-0 overflow-y-auto px-8 py-6">
                  <div className="mx-auto max-w-5xl space-y-6">
                    <AnimatePresence>
                      {s.selectedProvider ? (
                        <motion.div
                          key={s.selectedProvider}
                          variants={settingsVariants.fadeSlide}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          transition={settingsTransitions.enter}
                          className="space-y-6"
                        >
                          <ProviderSettingsPanel
                            providerId={s.selectedProvider}
                            connectedProvider={s.settings?.connectedProviders?.[s.selectedProvider]}
                            onConnect={s.handleConnect}
                            onUpdateProvider={s.handleUpdateProvider}
                            onDisconnect={s.handleDisconnect}
                            onModelChange={s.handleModelChange}
                            showModelError={s.showModelError}
                            onDelete={s.handleDelete}
                          />
                          <SandboxSection visible={true} />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="provider-empty"
                          variants={settingsVariants.fadeSlide}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          transition={settingsTransitions.enter}
                          className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {t('providers.emptyTitle')}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {t('providers.emptyDescription')}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </section>
              </div>
            )}

            {s.activeTab === 'skills' && (
              <div className="space-y-4">
                <SkillsPanel refreshTrigger={s.skillsRefreshTrigger} />
              </div>
            )}
            {s.activeTab === 'browsers' && (
              <div className="space-y-6">
                <CloudBrowsersPanel />
              </div>
            )}
            {s.activeTab === 'integrations' && (
              <div className="space-y-6">
                <IntegrationsPanel />
              </div>
            )}
            {s.activeTab === 'scheduler' && (
              <div className="space-y-6">
                <SchedulerPanel />
              </div>
            )}
            {s.activeTab === 'workspaces' && (
              <div className="space-y-6">
                <WorkspacesPanel />
              </div>
            )}
            {s.activeTab === 'voice' && (
              <div className="space-y-6">
                <SpeechSettingsForm />
              </div>
            )}
            {s.activeTab === 'memory' && (
              <div className="space-y-6">
                <MemoryTab />
              </div>
            )}
            {s.activeTab === 'folders' && (
              <div className="space-y-6">
                <FolderIndexingSection />
              </div>
            )}
            {s.activeTab === 'general' && (
              <GeneralTab
                notificationsEnabled={s.notificationsEnabled}
                onNotificationsToggle={s.handleNotificationsToggle}
                debugMode={s.debugMode}
                onDebugToggle={s.handleDebugToggle}
              />
            )}
            {s.activeTab === 'about' && <AboutTab appVersion={s.appVersion} />}

            {s.activeTab === 'skills' && (
              <div className="mt-4">
                <AddSkillDropdown
                  onSkillAdded={() => s.setSkillsRefreshTrigger((prev) => prev + 1)}
                  onClose={onClose}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsDialog;
