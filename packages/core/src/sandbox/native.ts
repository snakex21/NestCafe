// ============================================================
// Native sandbox provider — OS-level process isolation.
// Uses platform-specific mechanisms for sandboxing.
// ============================================================

import type { SpawnArgs } from '../types/sandbox.types.js';

export class NativeSandboxProvider {
  readonly mode = 'native' as const;

  async spawn(_args: SpawnArgs): Promise<{ pid: number; exitCode: Promise<number> }> {
    throw new Error('NativeSandboxProvider.spawn not yet ported');
  }

  async cleanup(): Promise<void> {
    // Kill sandboxed processes
  }
}
