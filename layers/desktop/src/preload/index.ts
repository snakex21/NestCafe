/**
 * Preload Script for Local Renderer
 *
 * This preload script exposes a secure API to the local React renderer
 * for communicating with the Electron main process via IPC.
 */

import { contextBridge, webUtils } from 'electron';
import { taskApi, taskEvents } from './api/task-api.js';
import { settingsApi, settingsEvents } from './api/settings-api.js';
import { providerApi } from './api/provider-api.js';
import { workspaceApi, workspaceEvents } from './api/workspace-api.js';
import { integrationApi } from './api/integration-api.js';
import { aiToolsApi } from './api/ai-tools-api.js';
import { systemApi, systemEvents } from './api/system-api.js';

const NestCafeAPI = {
  getFilePath: (file: File): string => webUtils.getPathForFile(file),

  ...taskApi,
  ...settingsApi,
  ...providerApi,
  ...workspaceApi,
  ...integrationApi,
  ...aiToolsApi,
  ...systemApi,

  ...taskEvents,
  ...settingsEvents,
  ...workspaceEvents,
  ...systemEvents,
};

contextBridge.exposeInMainWorld('nestcafe', NestCafeAPI);

const packageVersion = process.env.npm_package_version;
if (!packageVersion) {
  throw new Error('Package version is not defined. Build is misconfigured.');
}
contextBridge.exposeInMainWorld('nestcafeShell', {
  version: packageVersion,
  platform: process.platform,
  isElectron: true,
});

export type NestCafeAPI = typeof NestCafeAPI;
