/**
 * Narrow type-only entrypoint for @nestcafe/llm-gateway-client.
 *
 * The private gateway client package imports types from agent-core for
 * the NestcafeRuntime interface. This entrypoint re-exports ONLY the
 * types needed — it does NOT pull in storage, database, or validation
 * modules that would require better-sqlite3/zod at type-resolution time.
 *
 * Usage in llm-gateway-client:
 *   import type { NestcafeRuntime } from '@nestcafe_ai/agent-core/runtime-types';
 *
 * Exposed via package.json exports:
 *   "./runtime-types": "./dist/nestcafe-runtime-types.js"
 */

export type {
  NestcafeRuntime,
  StorageDeps,
  AccomplishConnectResult,
} from './opencode/nestcafe-runtime.js';

export type { CreditUsage } from './common/types/gateway.js';

export type { ProviderBuildResult } from './opencode/config-provider-context.js';
