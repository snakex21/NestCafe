import { ipcRenderer } from 'electron';
import type {
  Workspace,
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
  KnowledgeNote,
  KnowledgeNoteCreateInput,
  KnowledgeNoteUpdateInput,
} from '@nestcafe_ai/agent-core/desktop-main';
import type { FileAttachmentInfo, FolderScanResult, FolderIndexingConfig } from '@nestcafe_ai/agent-core/common';

export const workspaceApi = {
  listWorkspaces: (): Promise<Workspace[]> => ipcRenderer.invoke('workspace:list'),
  getActiveWorkspaceId: (): Promise<string | null> => ipcRenderer.invoke('workspace:get-active'),
  switchWorkspace: (workspaceId: string): Promise<{ success: boolean; reason?: string }> =>
    ipcRenderer.invoke('workspace:switch', workspaceId),
  createWorkspace: (input: WorkspaceCreateInput): Promise<Workspace> =>
    ipcRenderer.invoke('workspace:create', input),
  updateWorkspace: (id: string, input: WorkspaceUpdateInput): Promise<Workspace | null> =>
    ipcRenderer.invoke('workspace:update', id, input),
  deleteWorkspace: (id: string): Promise<boolean> => ipcRenderer.invoke('workspace:delete', id),
  listKnowledgeNotes: (workspaceId: string): Promise<KnowledgeNote[]> =>
    ipcRenderer.invoke('knowledge-notes:list', workspaceId),
  createKnowledgeNote: (input: KnowledgeNoteCreateInput): Promise<KnowledgeNote> =>
    ipcRenderer.invoke('knowledge-notes:create', input),
  updateKnowledgeNote: (
    id: string,
    workspaceId: string,
    input: KnowledgeNoteUpdateInput,
  ): Promise<KnowledgeNote | null> =>
    ipcRenderer.invoke('knowledge-notes:update', id, workspaceId, input),
  deleteKnowledgeNote: (id: string, workspaceId: string): Promise<boolean> =>
    ipcRenderer.invoke('knowledge-notes:delete', id, workspaceId),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('files:pick-folder'),
  pickFiles: (): Promise<FileAttachmentInfo[]> => ipcRenderer.invoke('files:pick'),
  processDroppedFiles: (paths: string[]): Promise<FileAttachmentInfo[]> =>
    ipcRenderer.invoke('files:process-dropped', paths),
  folderIndexing: {
    scanFolders: (folderPaths: string[]): Promise<FolderScanResult[]> =>
      ipcRenderer.invoke('folder-indexing:scan-folders', folderPaths),
    getConfig: (): Promise<FolderIndexingConfig> =>
      ipcRenderer.invoke('folder-indexing:get-config'),
    setConfig: (config: FolderIndexingConfig): Promise<void> =>
      ipcRenderer.invoke('folder-indexing:set-config', config),
    getSystemPath: (kind: string): Promise<string> =>
      ipcRenderer.invoke('folder-indexing:get-system-path', kind),
  },
};

export const workspaceEvents = {
  onWorkspaceChanged: (callback: (data: { workspaceId: string }) => void) => {
    const listener = (_: unknown, data: { workspaceId: string }) => callback(data);
    ipcRenderer.on('workspace:changed', listener);
    return () => ipcRenderer.removeListener('workspace:changed', listener);
  },
  onWorkspaceDeleted: (callback: (data: { workspaceId: string }) => void) => {
    const listener = (_: unknown, data: { workspaceId: string }) => callback(data);
    ipcRenderer.on('workspace:deleted', listener);
    return () => ipcRenderer.removeListener('workspace:deleted', listener);
  },
};
