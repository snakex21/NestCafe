/**
 * Accomplish AI IPC handlers.
 *
 * These handlers bridge the renderer's nestcafe-ai IPC calls to the daemon
 * via JSON-RPC. The daemon owns the proxy, the identity, the provider
 * settings table and the credit cache — these handlers just orchestrate.
 *
 * Milestone 5 of the daemon-only-SQLite migration
 * (plan: /Users/yanai/.claude/plans/squishy-exploring-hamster.md):
 * every `getStorage()` call is gone. Reads go through `provider.getSettings`
 * / `provider.getNestCafeAiCredits`, writes through
 * `provider.setConnected` / `provider.saveNestcafeAiCredits` /
 * `provider.removeConnected` / `provider.setActive`.
 */

import type { IpcMainInvokeEvent } from 'electron';
import type { CreditUsage, NestcafeAiCredentials } from '@nestcafe_ai/agent-core/desktop-main';

type NestcafeConnectRpcResult = { deviceFingerprint: string; usage: CreditUsage | null };
import { getDaemonClient } from '../../../daemon-bootstrap';
import { getLogCollector } from '../../../logging';

type HandleFn = <Args extends unknown[], ReturnType = unknown>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: Args) => ReturnType,
) => void;

const RUNTIME_UNAVAILABLE_MSG =
  'Free tier is not available in this build. Connect your own API key to use NestCafe.';

/** Normalize runtime-unavailable errors to a user-friendly message. */
function normalizeRuntimeError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('NESTCAFE_runtime_unavailable')) {
    throw new Error(RUNTIME_UNAVAILABLE_MSG);
  }
  throw err;
}

function log(level: 'INFO' | 'WARN' | 'ERROR', msg: string) {
  try {
    getLogCollector()?.log(level, 'main' as const, `[nestcafe-ai] ${msg}`);
  } catch {
    /* best-effort */
  }
}

/** Predicate mirror of the pre-M5 `storage.hasReadyProvider()` — any
 *  connected provider with `connection_status='connected'` and a non-null
 *  `selected_model_id`. Evaluated against the settings snapshot the caller
 *  has already fetched so we don't round-trip twice. */
function hasReadyProvider(
  settings: Awaited<ReturnType<ReturnType<typeof getDaemonClient>['call']>> extends infer _
    ? {
        connectedProviders: Record<
          string,
          { connectionStatus: string; selectedModelId: string | null } | undefined
        >;
      }
    : never,
): boolean {
  return Object.values(settings.connectedProviders).some(
    (p) => p?.connectionStatus === 'connected' && !!p.selectedModelId,
  );
}

export function registerNestcafeAiHandlers(handle: HandleFn): void {
  handle('nestcafe-ai:connect', async () => {
    let result: NestcafeConnectRpcResult;
    try {
      const client = getDaemonClient();
      result = await client.call('nestcafe-ai.connect');
    } catch (err) {
      normalizeRuntimeError(err);
    }

    const client = getDaemonClient();
    const credentials: NestcafeAiCredentials = {
      type: 'nestcafe-ai',
      deviceFingerprint: result.deviceFingerprint,
    };

    await client.call('provider.setConnected', {
      providerId: 'nestcafe-ai',
      provider: {
        providerId: 'nestcafe-ai',
        connectionStatus: 'connected',
        selectedModelId: 'nestcafe-ai/nestcafe-free',
        credentials,
        lastConnectedAt: new Date().toISOString(),
      },
    });

    // Cache credits if available
    if (result.usage) {
      await client.call('provider.saveNestcafeAiCredits', { usage: result.usage });
    }

    log('INFO', `Connected with fingerprint ${result.deviceFingerprint.substring(0, 8)}...`);

    return {
      deviceFingerprint: result.deviceFingerprint,
      ...(result.usage ?? { spentCredits: 0, remainingCredits: 0, totalCredits: 0, resetsAt: '' }),
    };
  });

  handle('nestcafe-ai:ensure-ready', async () => {
    const client = getDaemonClient();
    const settings = await client.call('provider.getSettings');
    const existing = settings.connectedProviders['nestcafe-ai'];
    if (existing?.connectionStatus === 'connected') {
      return {
        deviceFingerprint: (existing.credentials as NestcafeAiCredentials).deviceFingerprint,
      };
    }

    // Not connected yet — connect without stealing active model
    let result: NestcafeConnectRpcResult;
    try {
      result = await client.call('nestcafe-ai.connect');
    } catch (err) {
      normalizeRuntimeError(err);
    }

    const credentials: NestcafeAiCredentials = {
      type: 'nestcafe-ai',
      deviceFingerprint: result.deviceFingerprint,
    };

    await client.call('provider.setConnected', {
      providerId: 'nestcafe-ai',
      provider: {
        providerId: 'nestcafe-ai',
        connectionStatus: 'connected',
        selectedModelId: 'nestcafe-ai/nestcafe-free',
        credentials,
        lastConnectedAt: new Date().toISOString(),
      },
    });

    // Don't steal active if the user already has a ready provider. Reuse
    // the snapshot we already fetched above; a second RPC round-trip
    // here would introduce a race where another flow could connect a
    // provider between the two reads.
    if (!hasReadyProvider(settings)) {
      await client.call('provider.setActive', { providerId: 'nestcafe-ai' });
    }

    if (result.usage) {
      await client.call('provider.saveNestcafeAiCredits', { usage: result.usage });
    }

    return { deviceFingerprint: result.deviceFingerprint };
  });

  handle('nestcafe-ai:disconnect', async () => {
    const client = getDaemonClient();
    try {
      await client.call('nestcafe-ai.disconnect');
    } catch (err) {
      log('WARN', `Daemon disconnect failed: ${String(err)}`);
    }

    // Credits are cleared automatically by removeConnectedProvider
    // (per the daemon-side SettingsService — same invariant pre-M5).
    await client.call('provider.removeConnected', { providerId: 'nestcafe-ai' });
  });

  handle('nestcafe-ai:get-usage', async () => {
    const client = getDaemonClient();

    /** Attempt to fetch live usage. */
    async function fetchLiveUsage(): Promise<CreditUsage> {
      return client.call('nestcafe-ai.get-usage');
    }

    /** Reconnect daemon identity if it was lost (daemon restart) */
    async function reconnectAndRetry(): Promise<CreditUsage | null> {
      const settings = await client.call('provider.getSettings');
      const provider = settings.connectedProviders['nestcafe-ai'];
      if (provider?.connectionStatus !== 'connected') {
        return null;
      }

      try {
        log('INFO', 'Daemon identity lost — reconnecting');
        const connectResult = await client.call('nestcafe-ai.connect');

        // If connect returned usage (including exhausted state), use it directly
        if (connectResult.usage) {
          return connectResult.usage;
        }

        // Otherwise try live fetch
        return await fetchLiveUsage();
      } catch {
        return null;
      }
    }

    try {
      const live = await fetchLiveUsage();
      // If proxy hasn't connected yet (all zeros), fall back to cache
      if (live.totalCredits === 0) {
        return (await client.call('provider.getNestCafeAiCredits')) ?? live;
      }
      await client.call('provider.saveNestcafeAiCredits', { usage: live });
      return live;
    } catch {
      // First failure — try reconnecting (daemon may have restarted)
      const retried = await reconnectAndRetry();
      if (retried) {
        if (retried.totalCredits > 0) {
          await client.call('provider.saveNestcafeAiCredits', { usage: retried });
        }
        return retried;
      }

      // All attempts failed — return cached
      return (
        (await client.call('provider.getNestCafeAiCredits')) ?? {
          spentCredits: 0,
          remainingCredits: 0,
          totalCredits: 0,
          resetsAt: '',
        }
      );
    }
  });

  handle('nestcafe-ai:get-status', async () => {
    const client = getDaemonClient();
    const settings = await client.call('provider.getSettings');
    const provider = settings.connectedProviders['nestcafe-ai'];
    return { connected: provider?.connectionStatus === 'connected' };
  });
}
