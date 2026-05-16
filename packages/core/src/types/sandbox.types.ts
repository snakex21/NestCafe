// ============================================================
// Sandbox domain types — execution environment isolation
// (disabled, native OS, or Docker container).
// ============================================================

export type SandboxMode = 'disabled' | 'native' | 'docker';

export type SandboxNetworkPolicy = 'allow-all' | 'allow-known' | 'block-all';

export interface SandboxPaths {
  workspace: string;
  home: string;
  tmp: string;
}

export interface SandboxConfig {
  mode: SandboxMode;
  networkPolicy: SandboxNetworkPolicy;
  paths?: SandboxPaths;
  dockerImage?: string;
  timeoutMs?: number;
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  mode: 'disabled',
  networkPolicy: 'allow-all',
  timeoutMs: 300_000,
};

export interface SpawnArgs {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
}
