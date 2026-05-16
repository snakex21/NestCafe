// ============================================================
// Storage factory — in-memory StorageAPI implementation.
// Provides full CRUD for all entity types (tasks, workspaces,
// settings, skills, connectors, favorites, knowledge notes).
// Uses Maps for storage; swap for SQLite-backed implementation later.
// ============================================================

import type { StorageAPI } from '../api/index.js';
import type { StorageOptions } from './index.js';
import type { Task, TaskMessage, TaskStatus } from '../types/task.types.js';
import type { SettingsSnapshot } from '../types/settings.types.js';
import type {
  Workspace,
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
  KnowledgeNote,
  KnowledgeNoteCreateInput,
  KnowledgeNoteUpdateInput,
} from '../types/workspace.types.js';
import type { Skill } from '../types/skill.types.js';
import type { McpConnector } from '../types/connector.types.js';
import { generateTypedId } from '../utils/id.js';
import { DEFAULT_SANDBOX_CONFIG } from '../types/sandbox.types.js';
import { DEFAULT_CLOUD_BROWSER_CONFIG } from '../types/cloud-browser.types.js';
import { DEFAULT_FOLDER_INDEXING_CONFIG } from '../types/folder-indexing.types.js';

const DEFAULT_SETTINGS: SettingsSnapshot = {
  theme: 'dark',
  language: 'en',
  debugMode: false,
  onboardingCompleted: false,
  connectedProviders: [],
  sandbox: { ...DEFAULT_SANDBOX_CONFIG },
  cloudBrowser: { ...DEFAULT_CLOUD_BROWSER_CONFIG },
  folderIndexing: { ...DEFAULT_FOLDER_INDEXING_CONFIG },
  messaging: [],
  closeBehavior: 'keep-daemon',
  autoUpdate: true,
  notifications: true,
};

export function createStorage(_options: StorageOptions): StorageAPI {
  const tasks = new Map<string, Task>();
  const settings: SettingsSnapshot = { ...DEFAULT_SETTINGS };
  const workspaces = new Map<string, Workspace>();
  const knowledgeNotes = new Map<string, KnowledgeNote>();
  const skills = new Map<string, Skill>();
  const connectors = new Map<string, McpConnector>();
  const favorites = new Set<string>();
  let closed = false;

  function ensureOpen(): void {
    if (closed) {
      throw new Error('Storage is closed');
    }
  }

  const api: StorageAPI = {
    // ---- Tasks ----

    async getTask(taskId: string): Promise<Task | null> {
      ensureOpen();
      return tasks.get(taskId) ?? null;
    },

    async saveTask(task: Task): Promise<void> {
      ensureOpen();
      tasks.set(task.id, task);
    },

    async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
      ensureOpen();
      const task = tasks.get(taskId);
      if (!task) {
        return;
      }
      task.status = status;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        task.completedAt = new Date().toISOString();
      }
    },

    async addTaskMessage(taskId: string, message: TaskMessage): Promise<void> {
      ensureOpen();
      const task = tasks.get(taskId);
      if (!task) {
        return;
      }
      if (!message.id) {
        message.id = generateTypedId('msg');
      }
      if (!message.timestamp) {
        message.timestamp = new Date().toISOString();
      }
      task.messages.push(message);
    },

    async deleteTask(taskId: string): Promise<void> {
      ensureOpen();
      tasks.delete(taskId);
      favorites.delete(taskId);
    },

    async clearHistory(): Promise<void> {
      ensureOpen();
      tasks.clear();
      favorites.clear();
    },

    async searchConversations(query: string): Promise<Task[]> {
      ensureOpen();
      const q = query.toLowerCase();
      const results: Task[] = [];
      for (const task of tasks.values()) {
        if (
          task.prompt.toLowerCase().includes(q) ||
          task.summary?.toLowerCase().includes(q) ||
          task.messages.some((m) => m.content.toLowerCase().includes(q))
        ) {
          results.push(task);
        }
      }
      return results;
    },

    // ---- Settings ----

    async getSettings(): Promise<SettingsSnapshot> {
      ensureOpen();
      return { ...settings };
    },

    async updateSettings(changes: Partial<SettingsSnapshot>): Promise<void> {
      ensureOpen();
      Object.assign(settings, changes);
    },

    // ---- Workspaces ----

    async listWorkspaces(): Promise<Workspace[]> {
      ensureOpen();
      return [...workspaces.values()];
    },

    async getWorkspace(id: string): Promise<Workspace | null> {
      ensureOpen();
      return workspaces.get(id) ?? null;
    },

    async createWorkspace(input: WorkspaceCreateInput): Promise<Workspace> {
      ensureOpen();
      const now = new Date().toISOString();
      const workspace: Workspace = {
        id: generateTypedId('ws'),
        name: input.name,
        path: input.path,
        description: input.description,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      };
      workspaces.set(workspace.id, workspace);
      return workspace;
    },

    async updateWorkspace(id: string, input: WorkspaceUpdateInput): Promise<Workspace> {
      ensureOpen();
      const ws = workspaces.get(id);
      if (!ws) {
        throw new Error(`Workspace ${id} not found`);
      }
      if (input.name !== undefined) {
        ws.name = input.name;
      }
      if (input.path !== undefined) {
        ws.path = input.path;
      }
      if (input.description !== undefined) {
        ws.description = input.description;
      }
      if (input.isActive !== undefined) {
        ws.isActive = input.isActive;
      }
      ws.updatedAt = new Date().toISOString();
      return ws;
    },

    async deleteWorkspace(id: string): Promise<void> {
      ensureOpen();
      workspaces.delete(id);
    },

    // ---- Knowledge notes ----

    async listKnowledgeNotes(workspaceId: string): Promise<KnowledgeNote[]> {
      ensureOpen();
      return [...knowledgeNotes.values()].filter((n) => n.workspaceId === workspaceId);
    },

    async createKnowledgeNote(input: KnowledgeNoteCreateInput): Promise<KnowledgeNote> {
      ensureOpen();
      const now = new Date().toISOString();
      const note: KnowledgeNote = {
        id: generateTypedId('kn'),
        workspaceId: input.workspaceId,
        type: input.type,
        title: input.title,
        content: input.content,
        createdAt: now,
        updatedAt: now,
      };
      knowledgeNotes.set(note.id, note);
      return note;
    },

    async updateKnowledgeNote(id: string, input: KnowledgeNoteUpdateInput): Promise<KnowledgeNote> {
      ensureOpen();
      const note = knowledgeNotes.get(id);
      if (!note) {
        throw new Error(`Knowledge note ${id} not found`);
      }
      if (input.type !== undefined) {
        note.type = input.type;
      }
      if (input.title !== undefined) {
        note.title = input.title;
      }
      if (input.content !== undefined) {
        note.content = input.content;
      }
      note.updatedAt = new Date().toISOString();
      return note;
    },

    async deleteKnowledgeNote(id: string): Promise<void> {
      ensureOpen();
      knowledgeNotes.delete(id);
    },

    // ---- Skills ----

    async listSkills(): Promise<Skill[]> {
      ensureOpen();
      return [...skills.values()];
    },

    async upsertSkill(skill: Skill): Promise<void> {
      ensureOpen();
      skills.set(skill.id, skill);
    },

    async deleteSkill(id: string): Promise<void> {
      ensureOpen();
      skills.delete(id);
    },

    // ---- Connectors ----

    async listConnectors(): Promise<McpConnector[]> {
      ensureOpen();
      return [...connectors.values()];
    },

    async setConnectorEnabled(id: string, enabled: boolean): Promise<void> {
      ensureOpen();
      const connector = connectors.get(id);
      if (connector) {
        connector.enabled = enabled;
      }
    },

    // ---- Favorites ----

    async getFavorites(): Promise<string[]> {
      ensureOpen();
      return [...favorites];
    },

    async setFavorite(taskId: string, isFavorite: boolean): Promise<void> {
      ensureOpen();
      if (isFavorite) {
        favorites.add(taskId);
      } else {
        favorites.delete(taskId);
      }
    },

    // ---- Lifecycle ----

    async close(): Promise<void> {
      tasks.clear();
      workspaces.clear();
      knowledgeNotes.clear();
      skills.clear();
      connectors.clear();
      favorites.clear();
      closed = true;
    },
  };

  return api;
}
