// ============================================================
// Disabled sandbox provider — no isolation, direct execution.
// ============================================================

import type { SandboxConfig, SpawnArgs } from '../types/sandbox.types.js';

export class DisabledSandboxProvider {
  readonly mode = 'disabled' as const;

  async spawn(args: SpawnArgs): Promise<{ pid: number; exitCode: Promise<number> }> {
    // Direct execution without sandboxing
    throw new Error('DisabledSandboxProvider.spawn not yet ported');
  }

  async cleanup(): Promise<void> {
    // No-op for disabled sandbox
  }
}
