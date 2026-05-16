// ============================================================
// Workspace domain types — project workspaces, knowledge
// notes (context/instructions/references for AI tasks).
// ============================================================

export interface Workspace {
  id: string;
  name: string;
  path: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceCreateInput {
  name: string;
  path: string;
  description?: string;
}

export interface WorkspaceUpdateInput {
  name?: string;
  path?: string;
  description?: string;
  isActive?: boolean;
}

// ---- Knowledge Notes ----

export type KnowledgeNoteType = 'context' | 'instruction' | 'reference';

export interface KnowledgeNote {
  id: string;
  workspaceId: string;
  type: KnowledgeNoteType;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeNoteCreateInput {
  workspaceId: string;
  type: KnowledgeNoteType;
  title: string;
  content: string;
}

export interface KnowledgeNoteUpdateInput {
  type?: KnowledgeNoteType;
  title?: string;
  content?: string;
}
