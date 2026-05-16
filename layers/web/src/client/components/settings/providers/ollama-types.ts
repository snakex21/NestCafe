import type { ToolSupportStatus } from '@nestcafe_ai/agent-core';

export interface OllamaModel {
  id: string;
  name: string;
  toolSupport?: ToolSupportStatus;
}
