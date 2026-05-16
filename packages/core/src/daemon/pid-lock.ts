// ============================================================
// PID lock — prevents multiple daemon instances from
// running simultaneously on the same data directory.
// ============================================================

import fs from 'node:fs';

export interface PidLockOptions {
  lockFilePath: string;
}

/**
 * Acquire a PID lock file. Returns true if lock was acquired,
 * false if another process holds it. Removes stale locks
 * where the PID is no longer running.
 */
export function acquirePidLock(options: PidLockOptions): boolean {
  const { lockFilePath } = options;

  if (fs.existsSync(lockFilePath)) {
    try {
      const existingPid = parseInt(fs.readFileSync(lockFilePath, 'utf-8').trim(), 10);
      if (isProcessRunning(existingPid)) {
        return false; // Another daemon is running
      }
      // Stale lock — process is dead, remove it
      fs.unlinkSync(lockFilePath);
    } catch {
      // Corrupt lock file — remove and reacquire
      try {
        fs.unlinkSync(lockFilePath);
      } catch {
        /* non-fatal */
      }
    }
  }

  try {
    fs.writeFileSync(lockFilePath, String(process.pid));
    return true;
  } catch {
    return false;
  }
}

/**
 * Release the PID lock file.
 */
export function releasePidLock(lockFilePath: string): void {
  try {
    if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath);
    }
  } catch {
    // Non-fatal if cleanup fails
  }
}

/**
 * Check if a process with the given PID is currently running.
 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
