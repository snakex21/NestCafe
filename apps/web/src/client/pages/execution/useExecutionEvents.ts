import { useEffect } from 'react';
import type { TaskUpdateEvent } from '@nestcafe_ai/agent-core/common';
import type { DebugLogEntry } from '../../components/execution/DebugPanel';
import { getNestCafe } from '../../lib/nestcafe';
import { useTaskStore } from '../../stores/taskStore';

type Accomplish = ReturnType<typeof getNestCafe>;

interface UseExecutionEventsOptions {
  id: string | undefined;
  nestcafe: Accomplish;
  addTaskUpdate: (event: TaskUpdateEvent) => void;
  addTaskUpdateBatch: (event: {
    taskId: string;
    messages: import('@nestcafe_ai/agent-core/common').TaskMessage[];
  }) => void;
  updateTaskStatus: (
    taskId: string,
    status: import('@nestcafe_ai/agent-core/common').TaskStatus,
  ) => void;
  setPermissionRequest: (req: import('@nestcafe_ai/agent-core/common').PermissionRequest) => void;
  setCurrentTool: (tool: string | null) => void;
  setCurrentToolInput: (input: unknown) => void;
  clearStartupStage: (taskId: string) => void;
  setDebugLogs: React.Dispatch<React.SetStateAction<DebugLogEntry[]>>;
  loadTaskById: (id: string) => Promise<void>;
}

/** Registers all IPC event subscriptions for the execution page. */
export function useExecutionEvents(opts: UseExecutionEventsOptions) {
  const {
    id,
    nestcafe,
    addTaskUpdate,
    addTaskUpdateBatch,
    updateTaskStatus,
    setPermissionRequest,
    setCurrentTool,
    setCurrentToolInput,
    clearStartupStage,
    setDebugLogs,
    loadTaskById,
  } = opts;

  useEffect(() => {
    if (id) {
      loadTaskById(id);
      setDebugLogs([]);
      setCurrentTool(null);
      setCurrentToolInput(null);
      nestcafe.getTodosForTask(id).then((todos) => {
        useTaskStore.getState().setTodos(id, todos);
      });
    }

    const unsubscribeTask = nestcafe.onTaskUpdate((event) => {
      addTaskUpdate(event);
      if (event.taskId === id && event.type === 'message' && event.message?.type === 'tool') {
        const toolName =
          event.message.toolName || event.message.content?.match(/Using tool: (\w+)/)?.[1];
        if (toolName) {
          setCurrentTool(toolName);
          setCurrentToolInput(event.message.toolInput);
        }
      }
      if (event.taskId === id && event.type === 'message' && event.message?.type === 'assistant') {
        setCurrentTool(null);
        setCurrentToolInput(null);
        if (id) {
          clearStartupStage(id);
        }
      }
      if (event.taskId === id && (event.type === 'complete' || event.type === 'error')) {
        setCurrentTool(null);
        setCurrentToolInput(null);
      }
    });

    const unsubscribeTaskBatch = nestcafe.onTaskUpdateBatch?.((event) => {
      if (event.messages?.length) {
        addTaskUpdateBatch(event);
        if (event.taskId === id) {
          const lastMsg = event.messages[event.messages.length - 1];
          if (lastMsg.type === 'assistant') {
            setCurrentTool(null);
            setCurrentToolInput(null);
            if (id) {
              clearStartupStage(id);
            }
          } else if (lastMsg.type === 'tool') {
            const toolName = lastMsg.toolName || lastMsg.content?.match(/Using tool: (\w+)/)?.[1];
            if (toolName) {
              setCurrentTool(toolName);
              setCurrentToolInput(lastMsg.toolInput);
            }
          }
        }
      }
    });

    const unsubscribePermission = nestcafe.onPermissionRequest((request) => {
      setPermissionRequest(request);
    });

    const unsubscribeStatusChange = nestcafe.onTaskStatusChange?.((data) => {
      if (data.taskId === id) {
        updateTaskStatus(data.taskId, data.status);
      }
    });

    const unsubscribeDebugLog = nestcafe.onDebugLog((log) => {
      const entry = log as DebugLogEntry;
      if (entry.taskId === id) {
        setDebugLogs((prev) => [...prev, entry]);
      }
    });

    // On daemon disconnect: don't mark task as failed immediately — the daemon
    // may reconnect and the task may still be running. The global toast and
    // status dot already show "Reconnecting..." to the user.
    // On reconnect: re-fetch task to get authoritative state from daemon DB.
    // On reconnect-failed: only then mark running task as failed.
    const unsubscribeDaemonReconnected = nestcafe.onDaemonReconnected(() => {
      if (id) {
        loadTaskById(id);
      }
    });

    const unsubscribeDaemonReconnectFailed = nestcafe.onDaemonReconnectFailed?.(() => {
      if (id) {
        const state = useTaskStore.getState();
        if (state.currentTask?.id === id && state.currentTask.status === 'running') {
          updateTaskStatus(id, 'failed');
        }
      }
    });

    return () => {
      unsubscribeTask();
      unsubscribeTaskBatch?.();
      unsubscribePermission();
      unsubscribeStatusChange?.();
      unsubscribeDebugLog();
      unsubscribeDaemonReconnected();
      unsubscribeDaemonReconnectFailed?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loadTaskById, addTaskUpdate, addTaskUpdateBatch, updateTaskStatus, setPermissionRequest]);
}
