// ============================================================
// Public API interfaces — what factory functions return.
// These are the contracts that consumers code against.
// ============================================================

// Task Manager
export interface TaskManagerAPI {
  startTask(
    config: import('../types/task.types.js').TaskConfig,
  ): Promise<import('../types/task.types.js').Task>;
  cancelTask(taskId: string): Promise<void>;
  interruptTask(taskId: string): Promise<void>;
  getTask(taskId: string): Promise<import('../types/task.types.js').Task | null>;
  listTasks(filter?: {
    limit?: number;
    offset?: number;
    status?: import('../types/task.types.js').TaskStatus;
  }): Promise<import('../types/task.types.js').Task[]>;
  rerunFromMessage(
    taskId: string,
    messageId: string,
  ): Promise<import('../types/task.types.js').Task>;
  resumeTask(taskId: string): Promise<import('../types/task.types.js').Task>;
}

// Storage
export interface StorageAPI {
  // Tasks
  getTask(taskId: string): Promise<import('../types/task.types.js').Task | null>;
  saveTask(task: import('../types/task.types.js').Task): Promise<void>;
  updateTaskStatus(
    taskId: string,
    status: import('../types/task.types.js').TaskStatus,
  ): Promise<void>;
  addTaskMessage(
    taskId: string,
    message: import('../types/task.types.js').TaskMessage,
  ): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  clearHistory(): Promise<void>;
  searchConversations(query: string): Promise<import('../types/task.types.js').Task[]>;

  // Settings
  getSettings(): Promise<import('../types/settings.types.js').SettingsSnapshot>;
  updateSettings(
    changes: Partial<import('../types/settings.types.js').SettingsSnapshot>,
  ): Promise<void>;

  // Workspaces
  listWorkspaces(): Promise<import('../types/workspace.types.js').Workspace[]>;
  getWorkspace(id: string): Promise<import('../types/workspace.types.js').Workspace | null>;
  createWorkspace(
    input: import('../types/workspace.types.js').WorkspaceCreateInput,
  ): Promise<import('../types/workspace.types.js').Workspace>;
  updateWorkspace(
    id: string,
    input: import('../types/workspace.types.js').WorkspaceUpdateInput,
  ): Promise<import('../types/workspace.types.js').Workspace>;
  deleteWorkspace(id: string): Promise<void>;

  // Knowledge notes
  listKnowledgeNotes(
    workspaceId: string,
  ): Promise<import('../types/workspace.types.js').KnowledgeNote[]>;
  createKnowledgeNote(
    input: import('../types/workspace.types.js').KnowledgeNoteCreateInput,
  ): Promise<import('../types/workspace.types.js').KnowledgeNote>;
  updateKnowledgeNote(
    id: string,
    input: import('../types/workspace.types.js').KnowledgeNoteUpdateInput,
  ): Promise<import('../types/workspace.types.js').KnowledgeNote>;
  deleteKnowledgeNote(id: string): Promise<void>;

  // Skills
  listSkills(): Promise<import('../types/skill.types.js').Skill[]>;
  upsertSkill(skill: import('../types/skill.types.js').Skill): Promise<void>;
  deleteSkill(id: string): Promise<void>;

  // Connectors
  listConnectors(): Promise<import('../types/connector.types.js').McpConnector[]>;
  setConnectorEnabled(id: string, enabled: boolean): Promise<void>;

  // Favorites
  getFavorites(): Promise<string[]>; // task IDs
  setFavorite(taskId: string, isFavorite: boolean): Promise<void>;

  // Lifecycle
  close(): Promise<void>;
}

// Permission Handler
export interface PermissionHandlerAPI {
  requestPermission(
    request: import('../types/permission.types.js').PermissionRequest,
  ): Promise<void>;
  getPendingRequests(
    taskId: string,
  ): Promise<import('../types/permission.types.js').PermissionRequest[]>;
  respond(
    requestId: string,
    response: import('../types/permission.types.js').PermissionResponse,
  ): Promise<void>;
  cancelAll(taskId: string): Promise<void>;
}

// Log Writer
export interface LogWriterAPI {
  write(entry: import('../types/logging.types.js').LogEntry): void;
  getLogs(limit?: number): Promise<import('../types/logging.types.js').LogEntry[]>;
  clear(): Promise<void>;
}

// Skills Manager
export interface SkillsManagerAPI {
  listSkills(): Promise<import('../types/skill.types.js').Skill[]>;
  enableSkill(id: string): Promise<void>;
  disableSkill(id: string): Promise<void>;
  addSkill(path: string): Promise<import('../types/skill.types.js').Skill>;
  removeSkill(id: string): Promise<void>;
  scanDirectory(dir: string): Promise<import('../types/skill.types.js').Skill[]>;
}

// Speech Service
export interface SpeechServiceAPI {
  transcribe(audioData: ArrayBuffer): Promise<TranscriptionResult>;
  textToSpeech(text: string): Promise<ArrayBuffer>;
  isAvailable(): boolean;
}

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
}
