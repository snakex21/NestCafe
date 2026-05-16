// ============================================================
// Log writer factory — structured, in-memory append-only log
// with circular buffer and configurable retention.
// ============================================================

import type { LogWriterAPI } from '../api/index.js';
import type { LogEntry } from '../types/logging.types.js';
import { MAX_LOG_ENTRIES } from '../constants/index.js';

export function createLogWriter(_dataDir: string): LogWriterAPI {
  const entries: LogEntry[] = [];
  const maxEntries = MAX_LOG_ENTRIES;

  function prune(): void {
    while (entries.length > maxEntries) {
      entries.shift();
    }
  }

  const api: LogWriterAPI = {
    write(entry: LogEntry): void {
      if (!entry.timestamp) {
        entry.timestamp = new Date().toISOString();
      }
      entries.push(entry);
      prune();
    },

    async getLogs(limit?: number): Promise<LogEntry[]> {
      const count = limit ?? entries.length;
      return entries.slice(-count);
    },

    async clear(): Promise<void> {
      entries.length = 0;
    },
  };

  return api;
}
