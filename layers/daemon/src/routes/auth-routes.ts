import {
  validate,
  authOpenAiAwaitCompletionSchema,
} from '@nestcafe_ai/agent-core';
import { safeHandler } from './index.js';
import type { DaemonRpcServer } from '@nestcafe_ai/agent-core';
import type { OpenAiOauthManager } from '../opencode/auth-openai.js';

export function registerAuthRoutes(services: {
  rpc: DaemonRpcServer;
  openAiOauthManager: OpenAiOauthManager;
}): void {
  const { rpc, openAiOauthManager } = services;

  // ---------------------------------------------------------------------------
  // OpenAI ChatGPT OAuth (Phase 4a of the SDK cutover port, commercial PR #720)
  //
  // Four-method protocol. Desktop IPC handler runs:
  //   startLogin → shell.openExternal(authorizeUrl) → awaitCompletion.
  // `status` and `getAccessToken` are non-flow reads used by settings UI
  // and model-discovery respectively.
  // ---------------------------------------------------------------------------
  rpc.registerMethod(
    'auth.openai.startLogin',
    safeHandler(async () => {
      return openAiOauthManager.startLogin();
    }),
  );
  rpc.registerMethod(
    'auth.openai.awaitCompletion',
    safeHandler(async (params) => {
      const validated = validate(authOpenAiAwaitCompletionSchema, params);
      return openAiOauthManager.awaitCompletion(validated);
    }),
  );
  rpc.registerMethod(
    'auth.openai.status',
    safeHandler(() => Promise.resolve(openAiOauthManager.status())),
  );
  rpc.registerMethod(
    'auth.openai.getAccessToken',
    safeHandler(() => Promise.resolve(openAiOauthManager.getAccessToken())),
  );
}
