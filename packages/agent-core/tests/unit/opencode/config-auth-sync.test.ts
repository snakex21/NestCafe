import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { syncApiKeysToOpenCodeAuth } from '../../../src/opencode/config-auth-sync.js';

const tempDirs: string[] = [];

function makeAuthPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-auth-sync-'));
  tempDirs.push(dir);
  return path.join(dir, 'auth.json');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('syncApiKeysToOpenCodeAuth', () => {
  it('syncs custom provider keys under their OpenCode provider id', async () => {
    const authPath = makeAuthPath();

    await syncApiKeysToOpenCodeAuth(authPath, {
      'custom:morlrwc6': 'sk-custom',
      minimax: 'sk-minimax',
    });

    const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    expect(auth['custom-morlrwc6']).toEqual({ type: 'api', key: 'sk-custom' });
    expect(auth.minimax).toEqual({ type: 'api', key: 'sk-minimax' });
  });
});
