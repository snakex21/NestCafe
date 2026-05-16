/**
 * NestCafe API — Barrel re-export.
 *
 * All runtime functions and type definitions are now in `./api/`.
 * This file exists solely for backward compatibility; consumers should
 * keep importing from `@/lib/nestcafe`.
 */
export { getNestCafe, isRunningInElectron, getShellVersion, getShellPlatform, useNestCafe } from './api/client';
export type { NestCafeAPI, GwsAPI, BackupSectionOptions, BackupOperationResult, NestcafeShell } from './api/types';
