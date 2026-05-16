/**
 * TokenUsage — subtle context-window indicator shown during task execution.
 * Displays cumulative input tokens from step-finish events.
 * Persisted via localStorage so the count survives page reloads.
 */
import { useTaskStore } from '@/stores/taskStore';
import { cn } from '@/lib/utils';

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toString();
}

interface TokenUsageProps {
  taskId: string;
  /** Whether a task is currently running — shows "0 tok." even before first step-finish */
  isRunning?: boolean;
  className?: string;
}

export function TokenUsage({ taskId, isRunning, className }: TokenUsageProps) {
  const tokenCount = useTaskStore((s) => s.taskTokens[taskId]);
  const displayCount = tokenCount ?? 0;

  if (!isRunning && displayCount <= 0) {
    return null;
  }

  return (
    <span
      className={cn('text-[11px] text-muted-foreground/50 tabular-nums select-none', className)}
      title={`${displayCount.toLocaleString()} tokens used`}
    >
      {formatTokens(displayCount)} tok.
    </span>
  );
}
