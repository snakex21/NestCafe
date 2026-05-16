import { validate } from '@nestcafe_ai/agent-core';
import { z } from 'zod';
import { safeHandler } from './index.js';
import type { DaemonRpcServer } from '@nestcafe_ai/agent-core';
import type { WhatsAppDaemonService } from '../whatsapp-service.js';

export function registerWhatsappDaemonRoutes(services: {
  rpc: DaemonRpcServer;
  whatsappService: WhatsAppDaemonService;
}): void {
  const { rpc, whatsappService } = services;

  rpc.registerMethod(
    'whatsapp.connect',
    safeHandler(() => whatsappService.connect()),
  );
  rpc.registerMethod(
    'whatsapp.disconnect',
    safeHandler(() => whatsappService.disconnect()),
  );
  rpc.registerMethod(
    'whatsapp.getConfig',
    safeHandler(() => Promise.resolve(whatsappService.getConfig())),
  );
  rpc.registerMethod(
    'whatsapp.setEnabled',
    safeHandler((params) => {
      const validated = validate(z.object({ enabled: z.boolean() }), params);
      whatsappService.setEnabled(validated.enabled);
      return Promise.resolve();
    }),
  );
}
