// ============================================================
// OpenCode domain types — message structures from the
// OpenCode AI agent runtime (SDK messages).
// ============================================================

export interface OpenCodeMessageBase {
  id: string;
  sessionId: string;
  timestamp: string;
}

export interface OpenCodeStepStartMessage extends OpenCodeMessageBase {
  type: 'step-start';
  stepNumber: number;
}

export interface OpenCodeTextMessage extends OpenCodeMessageBase {
  type: 'text';
  content: string;
  modelId?: string;
}

export interface OpenCodeToolCallMessage extends OpenCodeMessageBase {
  type: 'tool-call';
  toolName: string;
  toolInput: unknown;
}

export interface OpenCodeToolUseMessage extends OpenCodeMessageBase {
  type: 'tool-use';
  toolName: string;
  toolInput: unknown;
  toolStatus?: 'running' | 'completed' | 'error';
}

export interface OpenCodeToolResultMessage extends OpenCodeMessageBase {
  type: 'tool-result';
  toolName: string;
  content: string;
  isError?: boolean;
}

export interface OpenCodeStepFinishMessage extends OpenCodeMessageBase {
  type: 'step-finish';
  stepNumber: number;
  tokenUsage?: {
    input: number;
    output: number;
  };
}

export interface OpenCodeErrorMessage extends OpenCodeMessageBase {
  type: 'error';
  error: string;
}

export type OpenCodeMessage =
  | OpenCodeStepStartMessage
  | OpenCodeTextMessage
  | OpenCodeToolCallMessage
  | OpenCodeToolUseMessage
  | OpenCodeToolResultMessage
  | OpenCodeStepFinishMessage
  | OpenCodeErrorMessage;
