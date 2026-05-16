// ============================================================
// Logging domain types — structured log entries from all
// system components (main, daemon, opencode, browser, etc.).
// ============================================================

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type LogSource = 'main' | 'mcp' | 'browser' | 'opencode' | 'env' | 'ipc' | 'daemon';

export interface LogEntry {
  level: LogLevel;
  source: LogSource;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
