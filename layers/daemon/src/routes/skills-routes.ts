import { validate } from '@nestcafe_ai/agent-core';
import { z } from 'zod';
import { safeHandler } from './index.js';
import type { DaemonRpcServer } from '@nestcafe_ai/agent-core';
import type { SkillsService } from '../skills-service.js';
import type { SkillsChangedPayload } from '@nestcafe_ai/agent-core';

export function registerSkillsRoutes(services: {
  rpc: DaemonRpcServer;
  skillsService: SkillsService;
}): void {
  const { rpc, skillsService } = services;

  rpc.registerMethod(
    'skills.list',
    safeHandler(() => Promise.resolve(skillsService.list())),
  );
  rpc.registerMethod(
    'skills.listEnabled',
    safeHandler(() => Promise.resolve(skillsService.listEnabled())),
  );
  rpc.registerMethod(
    'skills.setEnabled',
    safeHandler((params) => {
      const v = validate(z.object({ skillId: z.string().min(1), enabled: z.boolean() }), params);
      skillsService.setEnabled(v.skillId, v.enabled);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'skills.getContent',
    safeHandler((params) => {
      const v = validate(z.object({ skillId: z.string().min(1) }), params);
      return Promise.resolve(skillsService.getContent(v.skillId));
    }),
  );
  rpc.registerMethod(
    'skills.addFromPath',
    safeHandler(async (params) => {
      const v = validate(z.object({ sourcePath: z.string().min(1) }), params);
      return await skillsService.addFromPath(v.sourcePath);
    }),
  );
  rpc.registerMethod(
    'skills.delete',
    safeHandler((params) => {
      const v = validate(z.object({ skillId: z.string().min(1) }), params);
      skillsService.delete(v.skillId);
      return Promise.resolve();
    }),
  );
  rpc.registerMethod(
    'skills.resync',
    safeHandler(async () => await skillsService.resync()),
  );
  rpc.registerMethod(
    'skills.getUserSkillsPath',
    safeHandler(() => Promise.resolve(skillsService.getUserSkillsPath())),
  );

  skillsService.on('skills.changed', (payload: SkillsChangedPayload) => {
    rpc.notify('skills.changed', payload);
  });
}
