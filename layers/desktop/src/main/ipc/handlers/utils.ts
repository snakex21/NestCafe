import { ipcMain, BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { normalizeIpcError } from '../../ipc/validation';
import { getLogCollector } from '../../logging';

export const API_KEY_VALIDATION_TIMEOUT_MS = 15000;
export const MAX_ATTACHMENT_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function assertTrustedWindow(window: BrowserWindow | null): BrowserWindow {
  if (!window || window.isDestroyed()) {
    throw new Error('Untrusted window');
  }

  const focused = BrowserWindow.getFocusedWindow();
  if (BrowserWindow.getAllWindows().length > 1 && focused && focused.id !== window.id) {
    throw new Error('IPC request must originate from the focused window');
  }

  return window;
}

export function isE2ESkipAuthEnabled(): boolean {
  return (
    (global as Record<string, unknown>).E2E_SKIP_AUTH === true ||
    process.argv.includes('--e2e-skip-auth') ||
    process.env.E2E_SKIP_AUTH === '1'
  );
}

export function handle<Args extends unknown[], ReturnType = unknown>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: Args) => ReturnType,
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...(args as Args));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // During shutdown, the daemon client is torn down before pending IPC
      // handlers resolve. These races are benign — the renderer is closing
      // anyway. Do NOT re-throw: Electron would log a scary console error
      // for every handler that fires during the shutdown window.
      if (message === 'Client closed' || message === 'Daemon not bootstrapped') {
        try {
          const l = getLogCollector();
          if (l?.log) {
            l.log('INFO', 'ipc', `IPC handler ${channel} skipped during shutdown`, {
              reason: message,
            });
          }
        } catch {
          /* best-effort logging */
        }
        return undefined as unknown as ReturnType;
      }

      try {
        const l = getLogCollector();
        if (l?.log) {
          l.log('ERROR', 'ipc', `IPC handler ${channel} failed`, { error: message });
        }
      } catch {
        /* best-effort logging */
      }
      throw normalizeIpcError(error);
    }
  });
}
