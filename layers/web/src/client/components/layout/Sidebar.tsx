'use client';

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useTaskStore } from '@/stores/taskStore';
import { getNestCafe } from '@/lib/nestcafe';
import { staggerContainer } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import ConversationListItem from './ConversationListItem';
import WorkspaceSelector from './WorkspaceSelector';
import ModuleManager from '@/components/modules/ModuleManager';
import { useModuleStore } from '@/stores/moduleStore';
import { Gear, ChatText, MagnifyingGlass, Trash } from '@phosphor-icons/react';
import { DaemonStatusDot } from '@/components/DaemonStatusDot';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import type { SettingsTabId } from './settings-tabs';
import { openSettingsView } from '@/lib/settingsNavigation';
import logoImage from '/assets/logo-1.png';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tasks, loadTasks, updateTaskStatus, addTaskUpdate, openLauncher, clearHistory } =
    useTaskStore();
  const nestcafe = getNestCafe();
  const { t } = useTranslation('sidebar');
  const { t: tCommon } = useTranslation('common');
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Subscribe to task status changes (queued -> running) and task updates (complete/error)
  // This ensures sidebar always reflects current task status
  useEffect(() => {
    const unsubscribeStatusChange = nestcafe.onTaskStatusChange?.((data) => {
      updateTaskStatus(data.taskId, data.status);
    });

    const unsubscribeTaskUpdate = nestcafe.onTaskUpdate((event) => {
      addTaskUpdate(event);
    });

    return () => {
      unsubscribeStatusChange?.();
      unsubscribeTaskUpdate();
    };
  }, [updateTaskStatus, addTaskUpdate, nestcafe]);

  const handleNewConversation = () => {
    navigate('/');
  };

  const handleDeleteAllChats = async () => {
    await clearHistory();

    if (location.pathname.startsWith('/execution/')) {
      navigate('/');
    }
  };

  const openSettings = (initialTab: SettingsTabId) => {
    openSettingsView({ initialTab });
  };

  return (
    <div className="flex h-screen w-[260px] flex-col border-r border-border bg-card pt-12">
      {/* Workspace Selector */}
      <div className="px-3 pt-3 pb-1">
        <WorkspaceSelector
          onManageWorkspaces={() => {
            openSettings('workspaces');
          }}
        />
      </div>

      {/* Module Manager */}
      <div className="py-2">
        <ModuleManager
          onSelectModule={(moduleId) => {
            useModuleStore.getState().setActiveModule(moduleId);
            navigate(`/module/${moduleId}`);
          }}
        />
      </div>

      {/* Action Buttons */}
      <div className="px-3 py-3 border-b border-border flex gap-2">
        <Button
          data-testid="sidebar-new-task-button"
          onClick={handleNewConversation}
          variant="default"
          size="sm"
          className="flex-1 justify-center gap-2"
          title={t('newTask')}
        >
          <ChatText className="h-4 w-4" />
          {t('newTask')}
        </Button>
        <Button
          onClick={openLauncher}
          variant="outline"
          size="sm"
          className="px-2"
          title={t('searchTasks')}
        >
          <MagnifyingGlass className="h-4 w-4" />
        </Button>
      </div>

      {tasks.length > 0 && (
        <div className="border-b border-border px-3 py-2">
          <Button
            type="button"
            onClick={() => setDeleteAllOpen(true)}
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title={t('deleteAllChats')}
          >
            <Trash className="h-4 w-4" />
            {t('deleteAllChats')}
          </Button>
          <ConfirmationDialog
            open={deleteAllOpen}
            onOpenChange={setDeleteAllOpen}
            title={t('deleteAllChats')}
            description={t('confirmDeleteAll')}
            confirmLabel={tCommon('buttons.deleteAll')}
            cancelLabel={tCommon('buttons.cancel')}
            onConfirm={handleDeleteAllChats}
          />
        </div>
      )}

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          <AnimatePresence mode="wait">
            {tasks.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-3 py-8 text-center text-sm text-muted-foreground"
              >
                {t('noConversations')}
              </motion.div>
            ) : (
              <motion.div
                key="task-list"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="space-y-1"
              >
                {tasks.map((task) => (
                  <ConversationListItem key={task.id} task={task} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Bottom Section - Logo and Settings */}
      <div className="px-3 py-4 border-t border-border flex items-center justify-between">
        {/* Logo - Bottom Left */}
        <div className="flex items-center gap-2">
          <img
            src={logoImage}
            alt="NestCafe"
            className="dark:invert"
            style={{ height: '20px', paddingLeft: '6px' }}
          />
          <span className="text-sm font-semibold text-foreground/80">NestCafe</span>
        </div>

        {/* Settings Button + Daemon Status - Bottom Right */}
        <div className="flex items-center gap-2">
          <DaemonStatusDot />
          <Button
            data-testid="sidebar-settings-button"
            variant="ghost"
            size="icon"
            onClick={() => {
              openSettings('providers');
            }}
            title={t('settings')}
          >
            <Gear className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
