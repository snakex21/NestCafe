import { validate } from '@nestcafe_ai/agent-core';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import { safeHandler } from './index.js';
import type { DaemonRpcServer } from '@nestcafe_ai/agent-core';

export function registerMemoryRoutes(services: {
  rpc: DaemonRpcServer;
}): void {
  const { rpc } = services;

  const memoryDir = process.env.NESTCAFE_MEMORY_DIR || path.join(process.cwd(), 'memory');

  rpc.registerMethod(
    'memory.listPages',
    safeHandler(async () => {
      const pages: Array<{
        name: string;
        size: number;
        lines: number;
        mtime: string;
      }> = [];
      const files = await fs.promises.readdir(memoryDir).catch(() => [] as string[]);
      for (const name of files.sort()) {
        if (!name.endsWith('.md')) continue;
        const filePath = path.join(memoryDir, name);
        try {
          const stat = await fs.promises.stat(filePath);
          const raw = await fs.promises.readFile(filePath, 'utf8');
          pages.push({
            name: name.replace(/\.md$/, ''),
            size: stat.size,
            lines: raw.split(/\r?\n/).length,
            mtime: stat.mtime.toISOString(),
          });
        } catch {
          // skip unreadable files
        }
      }
      return Promise.resolve(pages);
    }),
  );

  rpc.registerMethod(
    'memory.readPage',
    safeHandler(async (params) => {
      const v = validate(z.object({ page: z.string().min(1) }), params);
      const safeName = v.page.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120);
      const filePath = path.join(memoryDir, `${safeName}.md`);
      const content = await fs.promises.readFile(filePath, 'utf8').catch(() => '');
      return Promise.resolve({ content });
    }),
  );

  rpc.registerMethod(
    'memory.writePage',
    safeHandler(async (params) => {
      const v = validate(z.object({ page: z.string().min(1), content: z.string() }), params);
      const safeName = v.page.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120);
      const filePath = path.join(memoryDir, `${safeName}.md`);
      await fs.promises.mkdir(memoryDir, { recursive: true });
      await fs.promises.writeFile(filePath, v.content, 'utf8');
      return Promise.resolve();
    }),
  );

  rpc.registerMethod(
    'memory.deletePage',
    safeHandler(async (params) => {
      const v = validate(z.object({ page: z.string().min(1) }), params);
      const safeName = v.page.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120);
      const filePath = path.join(memoryDir, `${safeName}.md`);
      await fs.promises.unlink(filePath).catch(() => {});
      return Promise.resolve();
    }),
  );
}
