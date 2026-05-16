import { validate } from '@nestcafe_ai/agent-core';
import { z } from 'zod';
import { safeHandler } from './index.js';
import type { DaemonRpcServer } from '@nestcafe_ai/agent-core';
import type { SecretsService } from '../storage/index.js';

export function registerSecretsRoutes(services: {
  rpc: DaemonRpcServer;
  secretsService: SecretsService;
}): void {
  const { rpc, secretsService } = services;

  rpc.registerMethod(
    'secrets.storeApiKey',
    safeHandler((params) => {
      const v = validate(
        z.object({ provider: z.string().min(1), apiKey: z.string().min(1) }),
        params,
      );
      secretsService.storeApiKey(v.provider, v.apiKey);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'secrets.getApiKey',
    safeHandler((params) => {
      const v = validate(z.object({ provider: z.string().min(1) }), params);
      return Promise.resolve(secretsService.getApiKey(v.provider));
    }),
  );
  rpc.registerMethod(
    'secrets.deleteApiKey',
    safeHandler((params) => {
      const v = validate(z.object({ provider: z.string().min(1) }), params);
      return Promise.resolve(secretsService.deleteApiKey(v.provider));
    }),
  );
  rpc.registerMethod(
    'secrets.getAllApiKeys',
    safeHandler(() => secretsService.getAllApiKeys()),
  );
  rpc.registerMethod(
    'secrets.hasAnyApiKey',
    safeHandler(() => secretsService.hasAnyApiKey()),
  );
  rpc.registerMethod(
    'secrets.storeBedrockCredentials',
    safeHandler((params) => {
      const v = validate(z.object({ credentials: z.string().min(1) }), params);
      secretsService.storeBedrockCredentials(v.credentials);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'secrets.getBedrockCredentials',
    safeHandler(() => Promise.resolve(secretsService.getBedrockCredentials())),
  );
  rpc.registerMethod(
    'secrets.clear',
    safeHandler(() => {
      secretsService.clear();
      return Promise.resolve();
    }),
  );
}
