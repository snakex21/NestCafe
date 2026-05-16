import { validate } from '@nestcafe_ai/agent-core';
import { z } from 'zod';
import { safeHandler } from './index.js';
import type { DaemonRpcServer } from '@nestcafe_ai/agent-core';
import type { ConnectorService } from '../storage/index.js';

export function registerConnectorRoutes(services: {
  rpc: DaemonRpcServer;
  connectorService: ConnectorService;
}): void {
  const { rpc, connectorService } = services;

  rpc.registerMethod(
    'connectors.list',
    safeHandler(() => Promise.resolve(connectorService.list())),
  );
  rpc.registerMethod(
    'connectors.getEnabled',
    safeHandler(() => Promise.resolve(connectorService.getEnabled())),
  );
  rpc.registerMethod(
    'connectors.getById',
    safeHandler((params) => {
      const v = validate(z.object({ id: z.string().min(1) }), params);
      return Promise.resolve(connectorService.getById(v.id));
    }),
  );
  rpc.registerMethod(
    'connectors.upsert',
    safeHandler((params) => {
      const v = validate(z.object({ connector: z.unknown() }), params);
      connectorService.upsert(v.connector as Parameters<typeof connectorService.upsert>[0]);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'connectors.setEnabled',
    safeHandler((params) => {
      const v = validate(z.object({ id: z.string().min(1), enabled: z.boolean() }), params);
      connectorService.setEnabled(v.id, v.enabled);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'connectors.setStatus',
    safeHandler((params) => {
      const v = validate(z.object({ id: z.string().min(1), status: z.unknown() }), params);
      connectorService.setStatus(
        v.id,
        v.status as Parameters<typeof connectorService.setStatus>[1],
      );
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'connectors.delete',
    safeHandler((params) => {
      const v = validate(z.object({ id: z.string().min(1) }), params);
      connectorService.delete(v.id);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'connectors.storeTokens',
    safeHandler((params) => {
      const v = validate(z.object({ connectorId: z.string().min(1), tokens: z.unknown() }), params);
      connectorService.storeTokens(
        v.connectorId,
        v.tokens as Parameters<typeof connectorService.storeTokens>[1],
      );
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'connectors.getTokens',
    safeHandler((params) => {
      const v = validate(z.object({ connectorId: z.string().min(1) }), params);
      return Promise.resolve(connectorService.getTokens(v.connectorId));
    }),
  );
  rpc.registerMethod(
    'connectors.deleteTokens',
    safeHandler((params) => {
      const v = validate(z.object({ connectorId: z.string().min(1) }), params);
      connectorService.deleteTokens(v.connectorId);
      return Promise.resolve();
    }),
  );

  // Built-in connector auth-store surface (`connector-auth:<key>` prefix).
  // Full `StoredAuthEntry` reads/writes for Slack, Jira, Lightdash, Datadog,
  // monday, Notion, GitHub, Google flows so M3 can repoint
  // `connector-auth-entry.ts` without regressing DCR / PKCE / serverUrl state.
  const connectorKeyParam = z.object({ connectorKey: z.string().min(1) });
  rpc.registerMethod(
    'connectors.authEntry.read',
    safeHandler((params) => {
      const v = validate(connectorKeyParam, params);
      return Promise.resolve(connectorService.readAuthEntry(v.connectorKey));
    }),
  );
  rpc.registerMethod(
    'connectors.authEntry.write',
    safeHandler((params) => {
      const v = validate(z.object({ connectorKey: z.string().min(1), entry: z.unknown() }), params);
      connectorService.writeAuthEntry(
        v.connectorKey,
        v.entry as Parameters<typeof connectorService.writeAuthEntry>[1],
      );
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'connectors.authEntry.delete',
    safeHandler((params) => {
      const v = validate(connectorKeyParam, params);
      connectorService.deleteAuthEntry(v.connectorKey);
      return Promise.resolve();
    }),
  );
}
