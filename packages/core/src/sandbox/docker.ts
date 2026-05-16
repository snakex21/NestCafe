// ============================================================
// Docker sandbox provider — container-based isolation.
// Spawns processes inside a Docker container.
// ============================================================

import type { SpawnArgs } from '../types/sandbox.types.js';

export class DockerSandboxProvider {
  readonly mode = 'docker' as const;

  constructor(private readonly _image: string) {}

  async spawn(_args: SpawnArgs): Promise<{ pid: number; exitCode: Promise<number> }> {
    throw new Error('DockerSandboxProvider.spawn not yet ported');
  }

  async cleanup(): Promise<void> {
    // Stop and remove container
  }
}
