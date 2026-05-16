// ============================================================
// Daemon RPC server — JSON-RPC 2.0 server over Unix socket
// or Windows named pipe. Handles method dispatch and
// push notifications to connected clients.
// ============================================================

import type { JsonRpcRequest, JsonRpcResponse } from '../types/daemon.types.js';

export interface DaemonRpcServerOptions {
  socketPath: string;
}

/**
 * JSON-RPC 2.0 server for daemon communication.
 * Handles request/response and push notifications.
 * Ported from agent-core when daemon migration is complete.
 */
export class DaemonRpcServer {
  // Placeholder — full implementation ported from agent-core/daemon/
  private socketPath: string;

  constructor(options: DaemonRpcServerOptions) {
    this.socketPath = options.socketPath;
  }

  async start(): Promise<void> {
    // Ported from daemon-rpc-server.ts
  }

  async stop(): Promise<void> {
    // Ported from daemon-rpc-server.ts
  }

  handleRequest(_request: JsonRpcRequest): Promise<JsonRpcResponse> {
    throw new Error('DaemonRpcServer not yet ported to core v2');
  }

  sendNotification(_method: string, _params?: unknown): void {
    // Ported from daemon-rpc-server.ts
  }
}

/**
 * Create a daemon RPC client connected to the daemon's socket.
 */
export class DaemonRpcClient {
  private socketPath: string;

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  async connect(): Promise<void> {
    // Ported from daemon-rpc-client.ts
  }

  async call(_method: string, _params?: unknown): Promise<unknown> {
    throw new Error('DaemonRpcClient not yet ported to core v2');
  }

  async disconnect(): Promise<void> {
    // Ported from daemon-rpc-client.ts
  }
}
