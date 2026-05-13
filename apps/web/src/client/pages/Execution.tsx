import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { springs } from '../lib/animations';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, WarningCircle } from '@phosphor-icons/react';
import { ModelIndicator } from '../components/ui/ModelIndicator';
import { SpinningIcon } from '../components/execution/SpinningIcon';
import { MessageBubble } from '../components/execution/MessageList';
import { DebugPanel } from '../components/execution/DebugPanel';
import { ExecutionCompleteFooter } from './execution/ExecutionCompleteFooter';
import { ExecutionHeader } from './execution/ExecutionHeader';
import { BrowserInstallModal } from './execution/BrowserInstallModal';
import { ConversationView } from './execution/ConversationView';
import { FollowUpInput } from './execution/FollowUpInput';
import { useExecutionPage } from './execution/useExecutionPage';
import { CreditExhaustedChatBanner } from '../components/execution/CreditExhaustedChatBanner';
import { useCreditsState } from '../hooks/useCreditsState';
import { ErrorBoundary, DefaultFallback } from '../components/ui/ErrorBoundary';

/** Detects Accomplish AI free-tier credit exhaustion errors specifically. */
function isNestcafeCreditExhaustedError(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  // Only match Accomplish-specific error codes, not generic provider billing errors
  return (
    lower.includes('credits_exhausted') ||
    lower.includes('monthly_credit_limit_reached') ||
    (lower.includes('nestcafe') && lower.includes('free credits'))
  );
}

function formatPageError(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown; error?: unknown }).message;
    if (typeof maybeMessage === 'string') {
      return maybeMessage;
    }

    const nestedError = (error as { error?: unknown }).error;
    if (nestedError !== undefined) {
      return formatPageError(nestedError);
    }

    try {
      const stringified = JSON.stringify(error, null, 2);
      if (stringified && stringified !== '{}' && !stringified.includes('[object Object]')) {
        return stringified;
      }
    } catch {
      // JSON.stringify failed, fall through
    }

    return 'Unknown error';
  }

  return 'Unknown error';
}

export default function ExecutionPage() {
  const s = useExecutionPage();
  const { t } = useTranslation('execution');
  const creditsState = useCreditsState();
  const { t: tCommon } = useTranslation('common');

  if (s.error) {
    const errorMessage = formatPageError(s.error);
    return (
      <div className="h-full flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <WarningCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive mb-4">{errorMessage}</p>
          <Button onClick={() => s.navigate('/')}>{tCommon('buttons.goHome')}</Button>
        </Card>
      </div>
    );
  }

  if (!s.currentTask) {
    return (
      <div className="h-full flex items-center justify-center">
        <SpinningIcon className="h-8 w-8" />
      </div>
    );
  }

  const { scrollContainerRef, messagesEndRef } = s;

  return (
    <div className="h-full flex flex-col bg-background relative">
      <ExecutionHeader prompt={s.currentTask.prompt} status={s.currentTask.status} />

      <BrowserInstallModal
        setupProgress={s.setupProgress}
        setupProgressTaskId={s.setupProgressTaskId}
        taskId={s.id}
        setupDownloadStep={s.setupDownloadStep}
      />

      {/* Queued — full page */}
      {s.currentTask.status === 'queued' && s.currentTask.messages.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
          className="flex-1 flex flex-col items-center justify-center gap-6 px-6"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <div className="text-center max-w-md">
            <h2 className="text-xl font-semibold text-foreground mb-2">{t('waiting.title')}</h2>
            <p className="text-muted-foreground">{t('waiting.description')}</p>
          </div>
          <button
            type="button"
            onClick={s.cancelTask}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t('waiting.cancel')}
          </button>
        </motion.div>
      )}

      {/* Queued — inline with messages */}
      {s.currentTask.status === 'queued' && s.currentTask.messages.length > 0 && (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {s.currentTask.messages
              .filter((m) => !(m.type === 'tool' && m.toolName?.toLowerCase() === 'bash'))
              .map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springs.gentle}
              className="flex flex-col items-center gap-4 py-8"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">{t('waiting.title')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('waiting.followUpDescription')}
                </p>
                <button
                  type="button"
                  onClick={s.cancelTask}
                  className="mt-3 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                >
                  {t('waiting.cancel')}
                </button>
              </div>
            </motion.div>
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Running messages */}
      {s.currentTask.status !== 'queued' && (
        <ErrorBoundary
          fallback={(error, reset) => (
            <div className="flex-1 flex items-center justify-center p-6">
              <DefaultFallback error={error} reset={reset} compact={false} />
            </div>
          )}
        >
          <ConversationView
            currentTask={s.currentTask}
            taskId={s.id}
            scrollContainerRef={scrollContainerRef}
            messagesEndRef={messagesEndRef}
            onScroll={s.handleScroll}
            isAtBottom={s.isAtBottom}
            scrollToBottom={s.scrollToBottom}
            hasSession={s.hasSession}
            isConnectorAuthPause={s.isConnectorAuthPause}
            taskActionLabel={s.taskActionLabel}
            taskActionPendingLabel={s.taskActionPendingLabel}
            onTaskAction={s.handleTaskAction}
            isTaskActionRunning={s.isTaskActionRunning}
            taskActionError={s.taskActionError}
            isLoading={s.isLoading}
            canEditUserMessages={s.canEditUserMessages}
            onEditUserMessage={s.handleEditUserMessage}
            permissionRequest={s.permissionRequest}
            onPermissionResponse={s.handlePermissionResponse}
            currentTool={s.currentTool}
            currentToolInput={s.currentToolInput}
            startupStage={s.startupStage}
            startupStageTaskId={s.startupStageTaskId}
            elapsedTime={s.elapsedTime}
            todos={s.todos}
            todosTaskId={s.todosTaskId}
          />
        </ErrorBoundary>
      )}

      {/* Running — stop button */}
      {s.currentTask.status === 'running' && !s.permissionRequest && (
        <div className="flex-shrink-0 border-t border-border bg-card/50 px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
              <input
                placeholder={t('agentWorking')}
                disabled
                className="flex-1 bg-transparent text-sm text-muted-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed"
              />
              <ModelIndicator isRunning={true} onOpenSettings={s.handleOpenModelSettings} />
              <div className="w-px h-6 bg-border flex-shrink-0" />
              <button
                onClick={s.cancelTask}
                title={t('stopAgent')}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e54d2e] text-white hover:bg-[#d4442a] transition-colors shrink-0"
                data-testid="execution-stop-button"
              >
                <span className="block h-2.5 w-2.5 rounded-[2px] bg-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up input */}
      {s.canFollowUp && (
        <FollowUpInput
          followUp={s.followUp}
          setFollowUp={s.setFollowUp}
          isFollowUpOverLimit={s.isFollowUpOverLimit}
          attachments={s.attachments}
          setAttachments={s.setAttachments}
          removeAttachment={s.removeAttachment}
          isDragging={s.isDragging}
          setDragCounter={s.setDragCounter}
          setIsDragging={s.setIsDragging}
          handleDrop={s.handleDrop}
          handlePickFiles={s.handlePickFiles}
          speechInput={s.speechInput}
          slashCommand={s.slashCommand}
          followUpInputRef={s.followUpInputRef}
          handleFollowUp={s.handleFollowUp}
          isLoading={s.isLoading}
          currentTask={s.currentTask}
          hasSession={s.hasSession}
          onOpenSettings={s.handleOpenSettings}
          onOpenModelSettings={s.handleOpenModelSettings}
          onOpenSpeechSettings={s.handleOpenSpeechSettings}
        />
      )}

      {/* Credit exhaustion banner — shown when task fails due to quota or live credits exhausted */}
      {(creditsState.isCreditsBlocked ||
        (s.currentTask?.status === 'failed' &&
          isNestcafeCreditExhaustedError(s.currentTask?.result?.error))) && (
        <CreditExhaustedChatBanner
          variant="exhausted"
          resetDate={creditsState.usage?.resetsAt ?? ''}
          onConnectProvider={() => s.handleOpenSettings('providers')}
        />
      )}

      {['completed', 'interrupted', 'failed', 'cancelled'].includes(s.currentTask?.status ?? '') &&
        !s.isConnectorAuthPause && (
          <ExecutionCompleteFooter
            taskId={s.currentTask.id}
            onStartNewTask={() => s.navigate('/')}
          />
        )}

      {s.debugModeEnabled && (
        <DebugPanel
          debugLogs={s.debugLogs}
          taskId={s.id}
          onClearLogs={() => s.setDebugLogs([])}
          onBugReport={s.handleBugReport}
          bugReporting={s.bugReporting}
          bugReportSaved={s.bugReportSaved}
          onRepeatTask={s.handleRepeatTask}
          repeatingTask={s.repeatingTask}
          isRunning={s.currentTask?.status === 'running'}
        />
      )}
    </div>
  );
}
