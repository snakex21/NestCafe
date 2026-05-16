import { ipcRenderer } from 'electron';
import type { Skill } from '@nestcafe_ai/agent-core/desktop-main';

export const aiToolsApi = {
  getSkills: (): Promise<Skill[]> => ipcRenderer.invoke('skills:list'),
  getEnabledSkills: (): Promise<Skill[]> => ipcRenderer.invoke('skills:list-enabled'),
  setSkillEnabled: (id: string, enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('skills:set-enabled', id, enabled),
  getSkillContent: (id: string): Promise<string | null> =>
    ipcRenderer.invoke('skills:get-content', id),
  getUserSkillsPath: (): Promise<string> => ipcRenderer.invoke('skills:get-user-skills-path'),
  pickSkillFolder: (): Promise<string | null> => ipcRenderer.invoke('skills:pick-folder'),
  addSkillFromFolder: (folderPath: string): Promise<Skill | null> =>
    ipcRenderer.invoke('skills:add-from-folder', folderPath),
  addSkillFromGitHub: (rawUrl: string): Promise<Skill> =>
    ipcRenderer.invoke('skills:add-from-github', rawUrl),
  deleteSkill: (id: string): Promise<void> => ipcRenderer.invoke('skills:delete', id),
  resyncSkills: (): Promise<Skill[]> => ipcRenderer.invoke('skills:resync'),
  openSkillInEditor: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('skills:open-in-editor', filePath),
  showSkillInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('skills:show-in-folder', filePath),
  listModules: (): Promise<unknown[]> => ipcRenderer.invoke('module:list'),
  getModule: (id: string): Promise<unknown> => ipcRenderer.invoke('module:get', id),
  installModule: (sourcePath: string): Promise<unknown> =>
    ipcRenderer.invoke('module:install', sourcePath),
  enableModule: (id: string, enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('module:enable', id, enabled),
  uninstallModule: (id: string): Promise<void> => ipcRenderer.invoke('module:uninstall', id),
  getModuleSettings: (moduleId: string): Promise<Record<string, string>> =>
    ipcRenderer.invoke('module:getSettings', moduleId),
  getModuleSetting: (moduleId: string, key: string): Promise<string | null> =>
    ipcRenderer.invoke('module:getSetting', moduleId, key),
  setModuleSetting: (moduleId: string, key: string, value: string): Promise<void> =>
    ipcRenderer.invoke('module:setSetting', moduleId, key, value),
  getModuleSource: (id: string): Promise<{ source: string }> =>
    ipcRenderer.invoke('module:getSource', id),
  discoverModules: (): Promise<unknown[]> => ipcRenderer.invoke('module:discover'),
  speechIsConfigured: (): Promise<boolean> => ipcRenderer.invoke('speech:is-configured'),
  speechGetConfig: (): Promise<{ enabled: boolean; hasApiKey: boolean; apiKeyPrefix?: string }> =>
    ipcRenderer.invoke('speech:get-config'),
  speechValidate: (apiKey?: string): Promise<{ valid: boolean; error?: string }> =>
    ipcRenderer.invoke('speech:validate', apiKey),
  speechTranscribe: (
    audioData: ArrayBuffer,
    mimeType?: string,
    provider?: 'local-whisper' | 'elevenlabs' | 'cohere',
    whisperModel?: string,
  ): Promise<
    | {
        success: true;
        result: { text: string; confidence?: number; duration: number; timestamp: number };
      }
    | {
        success: false;
        error: { code: string; message: string };
      }
  > => ipcRenderer.invoke('speech:transcribe', audioData, mimeType, provider, whisperModel),
  visionTranscribe: (
    imageBase64: string,
    mimeType?: string,
    prompt?: string,
    providerId?: string,
    modelId?: string,
  ): Promise<{ text: string }> =>
    ipcRenderer.invoke('vision:transcribe', imageBase64, mimeType, prompt, providerId, modelId),
  aiComplete: (prompt: string): Promise<{ text: string }> =>
    ipcRenderer.invoke('ai:complete', prompt),
  startHuggingFaceServer: (
    modelId: string,
  ): Promise<{ success: boolean; port?: number; error?: string }> =>
    ipcRenderer.invoke('huggingface-local:start-server', modelId),
  stopHuggingFaceServer: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('huggingface-local:stop-server'),
  getHuggingFaceServerStatus: (): Promise<{
    running: boolean;
    port: number | null;
    loadedModel: string | null;
    isLoading: boolean;
  }> => ipcRenderer.invoke('huggingface-local:server-status'),
  getHuggingFaceLocalConfig: (): Promise<{
    selectedModelId: string | null;
    serverPort: number | null;
    enabled: boolean;
  } | null> => ipcRenderer.invoke('huggingface-local:get-config'),
  setHuggingFaceLocalConfig: (
    config: {
      selectedModelId: string | null;
      serverPort: number | null;
      enabled: boolean;
    } | null,
  ): Promise<void> => ipcRenderer.invoke('huggingface-local:set-config', config),
  testHuggingFaceConnection: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('huggingface-local:test-connection'),
  downloadHuggingFaceModel: (modelId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('huggingface-local:download-model', modelId),
  listHuggingFaceModels: (): Promise<{
    cached: Array<{ id: string; displayName: string; sizeBytes?: number; downloaded: boolean }>;
    suggested: Array<{ id: string; displayName: string; sizeBytes?: number; downloaded: boolean }>;
  }> => ipcRenderer.invoke('huggingface-local:list-models'),
  deleteHuggingFaceModel: (modelId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('huggingface-local:delete-model', modelId),
  onHuggingFaceDownloadProgress: (
    callback: (progress: {
      modelId: string;
      status: 'downloading' | 'complete' | 'error';
      progress: number;
      error?: string;
    }) => void,
  ) => {
    const listener = (
      _: unknown,
      progress: {
        modelId: string;
        status: 'downloading' | 'complete' | 'error';
        progress: number;
        error?: string;
      },
    ) => callback(progress);
    ipcRenderer.on('huggingface-local:download-progress', listener);
    return () => {
      ipcRenderer.removeListener('huggingface-local:download-progress', listener);
    };
  },
  onBrowserFrame: (
    callback: (event: {
      taskId: string;
      pageName: string;
      frame: string;
      timestamp: number;
    }) => void,
  ) => {
    const listener = (_: unknown, event: unknown) =>
      callback(
        event as {
          taskId: string;
          pageName: string;
          frame: string;
          timestamp: number;
        },
      );
    ipcRenderer.on('browser:frame', listener);
    return () => ipcRenderer.removeListener('browser:frame', listener);
  },
  onBrowserNavigate: (
    callback: (event: { taskId: string; pageName: string; url: string }) => void,
  ) => {
    const listener = (_: unknown, event: unknown) =>
      callback(event as { taskId: string; pageName: string; url: string });
    ipcRenderer.on('browser:navigate', listener);
    return () => ipcRenderer.removeListener('browser:navigate', listener);
  },
  onBrowserStatus: (
    callback: (event: {
      taskId: string;
      pageName: string;
      status: string;
      message?: string;
    }) => void,
  ) => {
    const listener = (_: unknown, event: unknown) =>
      callback(
        event as {
          taskId: string;
          pageName: string;
          status: string;
          message?: string;
        },
      );
    ipcRenderer.on('browser:status', listener);
    return () => ipcRenderer.removeListener('browser:status', listener);
  },
  startBrowserPreview: (taskId: string, pageName?: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('browser-preview:start', taskId, pageName),
  stopBrowserPreview: (taskId: string): Promise<{ stopped: boolean }> =>
    ipcRenderer.invoke('browser-preview:stop', taskId),
  getBrowserPreviewStatus: (): Promise<{ active: boolean }> =>
    ipcRenderer.invoke('browser-preview:status'),
};
