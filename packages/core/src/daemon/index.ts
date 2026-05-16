// ============================================================
// Daemon barrel exports.
// ============================================================

export { DaemonRpcServer, DaemonRpcClient } from './rpc-server.js';
export type { DaemonRpcServerOptions } from './rpc-server.js';

export { acquirePidLock, releasePidLock } from './pid-lock.js';
export type { PidLockOptions } from './pid-lock.js';
