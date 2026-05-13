import { useState, useEffect, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { springs } from '../../lib/animations';
import type { TaskMessage } from '@nestcafe_ai/agent-core/common';
import {
  ArrowClockwise,
  Brain,
  CaretDown,
  Check,
  PencilSimple,
  Terminal,
  Wrench,
  X,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StreamingText } from '../ui/streaming-text';
import { BrowserScriptCard } from '../BrowserScriptCard';
import { getToolDisplayInfo } from '../../constants/tool-mappings';
import { SpinningIcon } from './SpinningIcon';
import { markdownComponents, proseClasses } from './message-markdown-config';
import { MessageTaskAction } from './MessageTaskAction';
import { MessageCopyButton } from './MessageCopyButton';

interface ContentSegment {
  type: 'think' | 'text';
  text: string;
}

const THINK_RE = /<(thinking|think)>/gi;
const THINK_CLOSE_RE = /<\/(thinking|think)>/gi;

/** Splits content into alternating text and thinking segments. */
function parseThinkingBlocks(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let cursor = 0;

  const openRe = new RegExp(THINK_RE.source, 'gi');
  let openMatch: RegExpExecArray | null;
  while ((openMatch = openRe.exec(content)) !== null) {
    if (openMatch.index > cursor) {
      segments.push({ type: 'text', text: content.slice(cursor, openMatch.index) });
    }

    const closeRe = new RegExp(THINK_CLOSE_RE.source, 'gi');
    closeRe.lastIndex = openRe.lastIndex;
    const closeMatch = closeRe.exec(content);
    const thinkEnd = closeMatch?.index ?? content.length;
    const afterThink = closeMatch ? closeRe.lastIndex : content.length;
    segments.push({ type: 'think', text: content.slice(openRe.lastIndex, thinkEnd).trim() });
    cursor = afterThink;
    openRe.lastIndex = afterThink;
  }

  if (cursor < content.length) {
    segments.push({ type: 'text', text: content.slice(cursor) });
  }

  return segments;
}

function ThinkingBlock({ content }: { content: string }) {
  const { t } = useTranslation('execution');
  const [open, setOpen] = useState(false);

  return (
    <div className="my-2 rounded-lg border border-amber-500/20 bg-amber-500/5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-600 hover:text-amber-700"
      >
        <Brain className="h-3.5 w-3.5" />
        {t('thinkingBlock')}
        <CaretDown className={cn('h-3 w-3 ml-auto transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-amber-500/10 px-3 py-2 text-xs text-amber-700/80 whitespace-pre-wrap break-words">
          {content}
        </div>
      )}
    </div>
  );
}

export interface MessageBubbleProps {
  message: TaskMessage;
  shouldStream?: boolean;
  isLastMessage?: boolean;
  isRunning?: boolean;
  showTaskActionButton?: boolean;
  taskActionLabel?: string;
  taskActionPendingLabel?: string;
  onTaskAction?: () => void;
  isTaskActionRunning?: boolean;
  taskActionError?: string | null;
  isLoading?: boolean;
  canEditUserMessage?: boolean;
  onEditUserMessage?: (message: TaskMessage, content: string) => Promise<void> | void;
}

export const MessageBubble = memo(
  function MessageBubble({
    message,
    shouldStream = false,
    isLastMessage = false,
    isRunning = false,
    showTaskActionButton = false,
    taskActionLabel,
    taskActionPendingLabel,
    onTaskAction,
    isTaskActionRunning = false,
    taskActionError,
    isLoading = false,
    canEditUserMessage = false,
    onEditUserMessage,
  }: MessageBubbleProps) {
    const [streamComplete, setStreamComplete] = useState(!shouldStream);
    const [isEditing, setIsEditing] = useState(false);
    const [draftContent, setDraftContent] = useState(message.content);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const isUser = message.type === 'user';
    const isTool = message.type === 'tool';
    const isSystem = message.type === 'system';
    const isAssistant = message.type === 'assistant';

    const toolName = message.toolName || message.content?.match(/Using tool: (\w+)/)?.[1];
    const toolDisplayInfo = toolName ? getToolDisplayInfo(toolName) : undefined;
    const ToolIcon = toolDisplayInfo?.icon;

    useEffect(() => {
      if (!shouldStream) {
        setStreamComplete(true);
      }
    }, [shouldStream]);

    if (isTool && message.toolName === 'todowrite') {
      return null;
    }

    if (isTool && message.toolName?.endsWith('complete_task')) {
      return null;
    }

    const showCopyButton = !isTool && !!message.content?.trim();
    const showUserActions = isUser && canEditUserMessage && !!onEditUserMessage;

    const handleStartEdit = () => {
      setDraftContent(message.content);
      setIsEditing(true);
    };

    const handleRerun = async () => {
      if (!onEditUserMessage) {
        return;
      }
      setIsSavingEdit(true);
      try {
        await onEditUserMessage(message, message.content.trim());
      } finally {
        setIsSavingEdit(false);
      }
    };

    const handleCancelEdit = () => {
      setDraftContent(message.content);
      setIsEditing(false);
    };

    const handleSaveEdit = async () => {
      const trimmed = draftContent.trim();
      if (!trimmed || trimmed === message.content.trim() || !onEditUserMessage) {
        setIsEditing(false);
        return;
      }
      setIsSavingEdit(true);
      try {
        await onEditUserMessage(message, trimmed);
        setIsEditing(false);
      } finally {
        setIsSavingEdit(false);
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
        className={cn('flex flex-col group', isUser ? 'items-end' : 'items-start')}
      >
        {isTool &&
        toolName?.endsWith('browser_script') &&
        Array.isArray((message.toolInput as { actions?: unknown })?.actions) ? (
          <BrowserScriptCard
            actions={
              (
                message.toolInput as {
                  actions: Array<{
                    action: string;
                    url?: string;
                    selector?: string;
                    ref?: string;
                    text?: string;
                    key?: string;
                  }>;
                }
              ).actions
            }
            isRunning={isLastMessage && isRunning}
          />
        ) : (
          <div
            className={cn(
              'max-w-[85%] rounded-2xl px-4 py-3 transition-all duration-150 relative',
              isEditing && 'w-[min(720px,85vw)]',
              isUser
                ? 'bg-primary text-primary-foreground'
                : isTool
                  ? 'bg-muted border border-border'
                  : isSystem
                    ? 'bg-muted/50 border border-border'
                    : 'bg-card border border-border',
            )}
          >
            {isTool ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                {ToolIcon ? <ToolIcon className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                <span>{toolDisplayInfo?.label || toolName || 'Processing'}</span>
                {(message.toolStatus === 'running' ||
                  (message.toolStatus === undefined && isLastMessage && isRunning)) && (
                  <SpinningIcon className="h-3.5 w-3.5 ml-1" />
                )}
              </div>
            ) : (
              <>
                {isSystem && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5 font-medium">
                    <Terminal className="h-3.5 w-3.5" />
                    System
                  </div>
                )}
                {isUser ? (
                  isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={draftContent}
                        onChange={(event) => setDraftContent(event.target.value)}
                        className="min-h-36 w-full resize-y rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-2 text-sm leading-relaxed text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary-foreground/40"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={isSavingEdit}
                          className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-primary-foreground/80 hover:bg-primary-foreground/10 disabled:opacity-60"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit()}
                          disabled={isSavingEdit || !draftContent.trim()}
                          className="flex h-7 items-center gap-1 rounded-md bg-primary-foreground px-2 text-xs font-medium text-primary hover:bg-primary-foreground/90 disabled:opacity-60"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Save & rerun
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p
                      className={cn(
                        'text-sm whitespace-pre-wrap break-words',
                        'text-primary-foreground',
                      )}
                    >
                      {message.content}
                    </p>
                  )
                ) : shouldStream && !streamComplete ? (
                  <StreamingText
                    text={message.content}
                    speed={120}
                    isComplete={streamComplete}
                    onComplete={() => setStreamComplete(true)}
                  >
                    {(streamedText) => <RenderedAssistantContent text={streamedText} />}
                  </StreamingText>
                ) : isAssistant || isSystem ? (
                  <RenderedAssistantContent text={message.content} />
                ) : (
                  <div className={proseClasses}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )}
                <p
                  className={cn(
                    'text-xs mt-1.5',
                    isUser ? 'text-primary-foreground/70' : 'text-muted-foreground',
                  )}
                >
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
                {isAssistant && showTaskActionButton && onTaskAction && (
                  <MessageTaskAction
                    onTaskAction={onTaskAction}
                    isLoading={isLoading}
                    isTaskActionRunning={isTaskActionRunning}
                    taskActionLabel={taskActionLabel}
                    taskActionPendingLabel={taskActionPendingLabel}
                    taskActionError={taskActionError}
                  />
                )}
              </>
            )}
            {showUserActions && !isEditing && (
              <div className="absolute -left-16 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => void handleRerun()}
                  disabled={isLoading || isSavingEdit}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border hover:text-foreground disabled:opacity-40"
                  title="Rerun this message"
                >
                  <ArrowClockwise className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleStartEdit}
                  disabled={isLoading || isSavingEdit}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border hover:text-foreground disabled:opacity-40"
                  title="Edit and rerun from here"
                >
                  <PencilSimple className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {showCopyButton && !isEditing && (
              <MessageCopyButton content={message.content} isUser={isUser} />
            )}
          </div>
        )}
      </motion.div>
    );
  },
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.shouldStream === next.shouldStream &&
    prev.isLastMessage === next.isLastMessage &&
    prev.isRunning === next.isRunning &&
    prev.showTaskActionButton === next.showTaskActionButton &&
    prev.taskActionLabel === next.taskActionLabel &&
    prev.taskActionPendingLabel === next.taskActionPendingLabel &&
    prev.isTaskActionRunning === next.isTaskActionRunning &&
    prev.taskActionError === next.taskActionError &&
    prev.isLoading === next.isLoading &&
    prev.canEditUserMessage === next.canEditUserMessage &&
    prev.onEditUserMessage === next.onEditUserMessage,
);

function RenderedAssistantContent({ text }: { text: string }) {
  const segments = useMemo(() => parseThinkingBlocks(text), [text]);

  return (
    <div className="space-y-1">
      {segments.map((seg, i) =>
        seg.type === 'think' ? (
          <ThinkingBlock key={i} content={seg.text} />
        ) : (
          <div key={i} className={proseClasses}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {seg.text}
            </ReactMarkdown>
          </div>
        ),
      )}
    </div>
  );
}
