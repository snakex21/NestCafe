import { validate } from '@nestcafe_ai/agent-core';
import { z } from 'zod';
import { safeHandler } from './index.js';
import type { DaemonRpcServer } from '@nestcafe_ai/agent-core';
import type { GoogleAccountService } from '../google-account-service.js';
import type { GwsAccountAddInput, GwsAccountStatusChangedPayload } from '@nestcafe_ai/agent-core';

export function registerGwsRoutes(services: {
  rpc: DaemonRpcServer;
  googleAccountService: GoogleAccountService;
}): void {
  const { rpc, googleAccountService } = services;

  rpc.registerMethod(
    'gwsAccount.list',
    safeHandler(() => Promise.resolve(googleAccountService.list())),
  );
  rpc.registerMethod(
    'gwsAccount.add',
    safeHandler((params) => {
      const v = validate(
        z.object({
          input: z.object({
            googleAccountId: z.string().min(1),
            email: z.string().min(1),
            displayName: z.string(),
            pictureUrl: z.string().nullable(),
            label: z.string().min(1),
            connectedAt: z.string().min(1),
            token: z.object({
              accessToken: z.string().min(1),
              refreshToken: z.string().min(1),
              expiresAt: z.number(),
              scopes: z.array(z.string()),
            }),
          }),
        }),
        params,
      );
      googleAccountService.add(v.input as GwsAccountAddInput);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'gwsAccount.remove',
    safeHandler((params) => {
      const v = validate(z.object({ googleAccountId: z.string().min(1) }), params);
      googleAccountService.remove(v.googleAccountId);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'gwsAccount.updateLabel',
    safeHandler((params) => {
      const v = validate(
        z.object({ googleAccountId: z.string().min(1), label: z.string().min(1) }),
        params,
      );
      googleAccountService.updateLabel(v.googleAccountId, v.label);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'gwsAccount.updateToken',
    safeHandler((params) => {
      const v = validate(
        z.object({
          googleAccountId: z.string().min(1),
          token: z.object({
            accessToken: z.string().min(1),
            refreshToken: z.string().min(1),
            expiresAt: z.number(),
            scopes: z.array(z.string()),
          }),
          connectedAt: z.string().min(1),
        }),
        params,
      );
      googleAccountService.updateToken(v.googleAccountId, v.token, v.connectedAt);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'gwsAccount.getToken',
    safeHandler((params) => {
      const v = validate(z.object({ googleAccountId: z.string().min(1) }), params);
      return Promise.resolve(googleAccountService.getToken(v.googleAccountId));
    }),
  );
  rpc.registerMethod(
    'gwsAccount.refreshNow',
    safeHandler(async (params) => {
      const v = validate(z.object({ googleAccountId: z.string().min(1) }), params);
      await googleAccountService.refreshNow(v.googleAccountId);
    }),
  );

  // Forward gwsAccount.statusChanged → renderer (via main's notification
  // forwarder). Desktop sends it on as `gws:account:status-changed` IPC.
  googleAccountService.on('gwsAccount.statusChanged', (payload: GwsAccountStatusChangedPayload) => {
    rpc.notify('gwsAccount.statusChanged', payload);
  });
}
