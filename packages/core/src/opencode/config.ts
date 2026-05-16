// ============================================================
// OpenCode CLI integration — generates OpenCode configuration
// files, resolves CLI paths, sets up auth, builds environment.
// ============================================================

import type { ProviderType } from '../types/provider.types.js';

export const NESTCAFE_AGENT_NAME = 'nestcafe';

/**
 * Generate an OpenCode configuration object for a task.
 */
export function generateOpenCodeConfig(params: {
  workingDirectory: string;
  provider?: ProviderType;
  modelId?: string;
  systemPromptAppend?: string;
  allowedTools?: string[];
}): Record<string, unknown> {
  return {
    workingDirectory: params.workingDirectory,
    model: params.modelId,
    provider: params.provider,
    systemPromptAppend: params.systemPromptAppend,
    allowedTools: params.allowedTools,
    agent: NESTCAFE_AGENT_NAME,
  };
}

/**
 * Resolve the OpenCode CLI binary path.
 */
export async function resolveOpenCodeCli(): Promise<string | null> {
  // Ported from opencode/cli.ts when needed
  return null;
}

/**
 * Check if OpenCode CLI is available on the system.
 */
export async function isOpenCodeAvailable(): Promise<boolean> {
  const cliPath = await resolveOpenCodeCli();
  return cliPath !== null;
}
