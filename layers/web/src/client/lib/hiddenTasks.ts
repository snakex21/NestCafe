import type { Task } from '@nestcafe_ai/agent-core/common';

const HIDDEN_TASK_ID_PREFIXES = ['index_', 'memory_'];
const HIDDEN_PROMPT_MARKERS = ['<folder-indexing-file>', '<memory-manager-task>'];

export function isHiddenBackgroundTask(task: Pick<Task, 'id' | 'prompt'>): boolean {
  return (
    HIDDEN_TASK_ID_PREFIXES.some((prefix) => task.id.startsWith(prefix)) ||
    HIDDEN_PROMPT_MARKERS.some((marker) => task.prompt.includes(marker))
  );
}

export function filterVisibleTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => !isHiddenBackgroundTask(task));
}
