// ============================================================
// Factories barrel — re-exports all factory functions.
// Factories create instances of public API interfaces.
// ============================================================

// ---- Options interfaces ----

export interface TaskManagerOptions {
  dataDir: string;
  onTaskUpdate?: (event: unknown) => void;
}

export interface StorageOptions {
  dataDir: string;
  appId: string;
}

// ---- Task Manager ----

export { createTaskManager } from './task-manager-factory.js';

// ---- Storage ----

export { createStorage } from './storage-factory.js';

// ---- Permission Handler ----

export { createPermissionHandler } from './permission-handler-factory.js';

// ---- Log Writer ----

export { createLogWriter } from './log-writer-factory.js';

// ---- Skills Manager ----

export { createSkillsManager } from './skills-manager-factory.js';

// ---- Speech Service ----

export { createSpeechService } from './speech-service-factory.js';
