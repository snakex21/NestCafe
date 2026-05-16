import { validate } from '@nestcafe_ai/agent-core';
import { z } from 'zod';
import { safeHandler, taskIdSchema } from './index.js';
import type { DaemonRpcServer, StorageAPI } from '@nestcafe_ai/agent-core';

export function registerFavoritesRoutes(services: {
  rpc: DaemonRpcServer;
  storage: StorageAPI;
}): void {
  const { rpc, storage } = services;

  rpc.registerMethod(
    'favorites.list',
    safeHandler(() => Promise.resolve(storage.getFavorites())),
  );
  rpc.registerMethod(
    'favorites.add',
    safeHandler((params) => {
      const v = validate(
        z.object({
          taskId: z.string().min(1),
          prompt: z.string(),
          summary: z.string().optional(),
        }),
        params,
      );
      storage.addFavorite(v.taskId, v.prompt, v.summary);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'favorites.remove',
    safeHandler((params) => {
      const v = validate(taskIdSchema, params);
      storage.removeFavorite(v.taskId);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'favorites.isFavorite',
    safeHandler((params) => {
      const v = validate(taskIdSchema, params);
      return Promise.resolve(storage.isFavorite(v.taskId));
    }),
  );
}
