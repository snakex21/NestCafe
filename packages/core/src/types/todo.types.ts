// ============================================================
// Todo domain types — task-associated todo items tracked
// during AI task execution.
// ============================================================

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type TodoPriority = 'low' | 'medium' | 'high';

export interface TodoItem {
  id: string;
  taskId: string;
  content: string;
  status: TodoStatus;
  priority: TodoPriority;
  createdAt: string;
  updatedAt?: string;
}
