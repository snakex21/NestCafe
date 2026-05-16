/**
 * Shared task config resolution — the "one brain" for config assembly.
 *
 * Resolves skills, connectors (with token refresh), cloud browser config,
 * workspace knowledge notes, Google Workspace accounts, and OpenAI
 * store:false injection into a ConfigGeneratorOptions object that can be
 * passed to generateConfig().
 *
 * Used by both the desktop config-generator (bridge period) and the
 * standalone daemon's TaskService.
 */

import type { Database } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { StorageAPI } from '../types/storage.js';
import type { Skill } from '../common/types/skills.js';
import type { ConfigGeneratorOptions, ProviderConfig } from './config-generator.js';
import type { BrowserConfig } from './generator-mcp.js';
import type { NestcafeRuntime, StorageDeps } from './nestcafe-runtime.js';
import { isTokenExpired, refreshAccessToken } from '../connectors/oauth-tokens.js';
import { getFormattedKnowledgeNotes } from '../storage/repositories/knowledgeNotes.js';
import { buildProviderConfigs } from './config-builder.js';
import { prepareGwsManifest, type LogFn } from '../google-accounts/index.js';

export interface ResolveTaskConfigOptions {
  /** Storage API for reading connectors, cloud browser, sandbox, etc. */
  storage: StorageAPI;

  /** Platform info */
  platform: NodeJS.Platform;
  mcpToolsPath: string;
  userDataPath: string;
  isPackaged: boolean;
  bundledNodeBinPath?: string;

  /** API key getter (sync — reads from secure storage or DB) */
  getApiKey: (provider: string) => string | null;

  /** Optional Azure Foundry token for Entra ID auth */
  azureFoundryToken?: string;

  /** Port for the WhatsApp HTTP API. Omit to disable the MCP tool. */
  whatsappApiPort?: number;

  /** Optional auth token for daemon API endpoints */
  authToken?: string;

  /**
   * Pre-resolved enabled skills.
   * The caller provides these because skill resolution may go through
   * SkillsManager (desktop) or direct DB query (daemon).
   */
  skills?: Skill[];

  /**
   * Active workspace ID for knowledge notes injection.
   * If provided, workspace knowledge notes are loaded and injected.
   */
  workspaceId?: string;

  /**
   * Optional per-task config filename (e.g. `opencode-<taskId>.json`).
   * When concurrent tasks run simultaneously, sharing the default
   * `opencode.json` makes them race on the same file. The daemon passes
   * a taskId-scoped filename; desktop can omit to keep legacy behavior.
   */
  configFileName?: string;

  /**
   * Accomplish AI runtime adapter (noop in OSS, real impl in commercial).
   * Forwarded into `buildProviderConfigs` so the Accomplish-AI provider can
   * register itself when the runtime is available.
   */
  NestcafeRuntime?: NestcafeRuntime;

  /**
   * Accomplish AI identity storage deps (injected from the caller's
   * secure storage). Forwarded into `buildProviderConfigs`.
   */
  accomplishStorageDeps?: StorageDeps;

  /**
   * Optional SQLite handle for GWS manifest generation. The daemon passes
   * its shared database; desktop omits (its own config-generator calls
   * `prepareGwsManifest` separately with its own AccountManager).
   *
   * When provided AND the `google_accounts` table has `status='connected'`
   * rows, `resolveTaskConfig` writes per-account token files + a manifest
   * and sets `gwsAccountsManifestPath` + `gwsAccountsSummary` on the
   * returned configOptions. If the table is missing (pre-migration DB) or
   * empty, this step silently skips.
   */
  database?: Database;

  /**
   * Logger function for non-fatal warnings.
   * Defaults to console.warn if not provided.
   */
  log?: LogFn;
}

export interface ResolvedTaskConfig {
  /** Ready-to-use options for generateConfig() */
  configOptions: ConfigGeneratorOptions;
}

/**
 * Resolve all task configuration from storage and external sources.
 *
 * This is the shared "one brain" that both desktop and daemon use to
 * assemble the full ConfigGeneratorOptions before calling generateConfig().
 */
export async function resolveTaskConfig(
  options: ResolveTaskConfigOptions,
): Promise<ResolvedTaskConfig> {
  const {
    storage,
    platform,
    mcpToolsPath,
    userDataPath,
    isPackaged,
    bundledNodeBinPath,
    getApiKey,
    azureFoundryToken,
    whatsappApiPort,
    authToken,
    skills,
    workspaceId,
    configFileName,
    NestcafeRuntime,
    accomplishStorageDeps,
    database,
  } = options;

  const log: LogFn = options.log ?? ((_level, msg) => console.warn(msg));

  // 1. Build provider configs. `NestcafeRuntime` + `accomplishStorageDeps`
  // forward to the Accomplish-AI provider when the optional runtime is loaded
  // (Free build); omitted on OSS so the provider stays dormant.
  const { providerConfigs, enabledProviders, modelOverride } = await buildProviderConfigs({
    getApiKey,
    azureFoundryToken,
    NestcafeRuntime,
    accomplishStorageDeps,
  });

  // 2. Inject store:false for OpenAI to prevent 403 errors with project-scoped keys
  injectOpenAiStoreFlag(providerConfigs, getApiKey);

  // 3. Resolve connectors with token refresh
  const connectors = await resolveConnectors(storage, log);

  // 4. Resolve cloud browser config
  const browser = resolveCloudBrowser(storage);

  // 5. Resolve workspace knowledge notes — split into binding instructions
  //    (rendered under a MANDATORY wrapper) and soft context (rendered under
  //    a "background info" wrapper). Per the post-review fix for Codex P2,
  //    instruction-type notes must be framed as persistent user instructions
  //    that override conversational-bypass default-concise behavior.
  let knowledgeInstructions: string | undefined;
  let knowledgeContext: string | undefined;
  if (workspaceId) {
    try {
      const formatted = getFormattedKnowledgeNotes(workspaceId);
      if (formatted.instructions) knowledgeInstructions = formatted.instructions;
      if (formatted.context) knowledgeContext = formatted.context;
    } catch (error) {
      log('WARN', '[resolveTaskConfig] Failed to load workspace knowledge notes', {
        workspaceId,
        err: String(error),
      });
    }
  }

  // 6. Resolve UI language preference for agent communication
  /** UI language preference read from app_settings; undefined if the column is absent (pre-migration DB). */

  let language: string | undefined;
  try {
    language = storage.getLanguage();
    if (typeof language === 'string' && language.trim().length === 0) {
      language = undefined;
    }
  } catch (_err) {
    // Non-critical: language column may be absent in older DBs before migration
  }

  // 7. Resolve Google Workspace accounts manifest (daemon only — desktop's
  // config-generator calls `prepareGwsManifest` separately via its own
  // `AccountManager`). When the caller omits `database`, we skip this step.
  let gwsAccountsManifestPath: string | undefined;
  let gwsAccountsSummary: Array<{ label: string; email: string; status: string }> | undefined;
  if (database) {
    try {
      const gwsResult = await prepareGwsManifest(storage, database, userDataPath, log);
      if (gwsResult?.manifestPath) {
        gwsAccountsManifestPath = gwsResult.manifestPath;
      }
      if (gwsResult?.summary && gwsResult.summary.length > 0) {
        gwsAccountsSummary = gwsResult.summary.map((s) => ({
          label: s.label,
          email: s.email,
          status: s.status,
        }));
      }
    } catch (err) {
      log('WARN', '[resolveTaskConfig] GWS manifest step failed', { err: String(err) });
    }
  }

  // 8. Resolve folder-indexing summary — read config, scan selected folders,
  //    build a directory tree (max 2 levels deep) with file counts per category.
  let folderIndexingSummary: string | undefined;
  try {
    const folderConfig = storage.getFolderIndexingConfig();
    if (folderConfig.enabled && folderConfig.selectedPaths.length > 0) {
      folderIndexingSummary = buildFolderIndexingSummary(folderConfig.selectedPaths);
    }
  } catch (err) {
    log('WARN', '[resolveTaskConfig] Folder indexing summary failed', { err: String(err) });
  }

  return {
    configOptions: {
      platform,
      mcpToolsPath,
      userDataPath,
      isPackaged,
      bundledNodeBinPath,
      skills,
      providerConfigs,
      enabledProviders,
      whatsappApiPort,
      authToken,
      model: modelOverride?.model,
      smallModel: modelOverride?.smallModel,
      connectors: connectors.length > 0 ? connectors : undefined,
      browser,
      knowledgeInstructions,
      knowledgeContext,
      language,
      configFileName,
      gwsAccountsManifestPath,
      gwsAccountsSummary,
      folderIndexingSummary,
    },
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function injectOpenAiStoreFlag(
  providerConfigs: ProviderConfig[],
  getApiKey: (provider: string) => string | null,
): void {
  const openAiApiKey = getApiKey('openai');
  if (!openAiApiKey) {
    return;
  }
  const existing = providerConfigs.find((p) => p.id === 'openai');
  if (existing) {
    existing.options.store = false;
  } else {
    providerConfigs.push({ id: 'openai', options: { store: false } });
  }
}

async function resolveConnectors(
  storage: StorageAPI,
  log: (level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: Record<string, unknown>) => void,
): Promise<Array<{ id: string; name: string; url: string; accessToken: string }>> {
  const enabledConnectors = storage.getEnabledConnectors();
  const result: Array<{ id: string; name: string; url: string; accessToken: string }> = [];

  for (const connector of enabledConnectors) {
    if (connector.status !== 'connected') {
      continue;
    }

    let tokens = storage.getConnectorTokens(connector.id);
    if (!tokens?.accessToken) {
      log('WARN', `[resolveTaskConfig] Missing access token for ${connector.name}`);
      storage.setConnectorStatus(connector.id, 'error');
      continue;
    }

    // Refresh token if expired
    if (isTokenExpired(tokens)) {
      if (tokens.refreshToken && connector.oauthMetadata && connector.clientRegistration) {
        try {
          tokens = await refreshAccessToken({
            tokenEndpoint: connector.oauthMetadata.tokenEndpoint,
            refreshToken: tokens.refreshToken,
            clientId: connector.clientRegistration.clientId,
            clientSecret: connector.clientRegistration.clientSecret,
          });
          storage.storeConnectorTokens(connector.id, tokens);
        } catch (err) {
          log('WARN', `[resolveTaskConfig] Token refresh failed for ${connector.name}`, {
            err: String(err),
          });
          storage.setConnectorStatus(connector.id, 'error');
          continue;
        }
      } else {
        log('WARN', `[resolveTaskConfig] Token expired for ${connector.name} and cannot refresh`);
        storage.setConnectorStatus(connector.id, 'error');
        continue;
      }
    }

    result.push({
      id: connector.id,
      name: connector.name,
      url: connector.url,
      accessToken: tokens.accessToken,
    });
  }

  return result;
}

function resolveCloudBrowser(storage: StorageAPI): BrowserConfig | undefined {
  const cloudBrowserConfig = storage.getCloudBrowserConfig();
  if (!cloudBrowserConfig?.activeProvider) {
    return undefined;
  }
  const providerCfg = cloudBrowserConfig.providers[cloudBrowserConfig.activeProvider];
  if (!providerCfg?.endpoint) {
    return undefined;
  }
  return {
    mode: 'remote',
    cdpEndpoint: providerCfg.endpoint,
    cdpHeaders: providerCfg.apiKey ? { 'X-CDP-Secret': providerCfg.apiKey } : undefined,
  };
}

// ── Folder-indexing summary builder ──────────────────────────────────────────

import { EXT_CATEGORY_MAP } from '../common/types/folder-indexing.js';
import type { FileCategory } from '../common/types/folder-indexing.js';

const MAX_SCAN_DEPTH = 2;
const MAX_ENTRIES_PER_DIR = 500;
const MAX_TOTAL_FILES = 2000;

/**
 * Scans selected folders (max 2 levels deep) and builds a Markdown-formatted
 * summary for injection into the agent's system prompt.
 */
function buildFolderIndexingSummary(selectedPaths: string[]): string {
  const lines: string[] = [
    '<indexed-folders>',
    'The user has selected the following folders for indexing. Their',
    'directory structure (max 2 levels deep) is available below. Use this',
    'to answer questions about files without needing to browse manually.',
    '',
  ];

  let totalFiles = 0;

  for (const folderPath of selectedPaths) {
    if (totalFiles >= MAX_TOTAL_FILES) {
      lines.push(`... (skipping remaining folders, ${MAX_TOTAL_FILES} file limit reached)`);
      break;
    }

    try {
      if (!fs.existsSync(folderPath)) {
        lines.push(`### ${folderPath}`);
        lines.push('  (folder does not exist)');
        lines.push('');
        continue;
      }

      const stat = fs.statSync(folderPath);
      if (!stat.isDirectory()) {
        continue;
      }

      lines.push(`### ${folderPath}`);
      const result = scanDirForSummary(folderPath, 0, 0);
      totalFiles += result.fileCount;
      lines.push(result.text);
      lines.push('');
    } catch {
      lines.push(`### ${folderPath}`);
      lines.push('  (could not read folder)');
      lines.push('');
    }
  }

  lines.push('</indexed-folders>');
  return lines.join('\n');
}

interface ScanResult {
  text: string;
  fileCount: number;
}

function scanDirForSummary(dir: string, depth: number, runningTotal: number): ScanResult {
  const lines: string[] = [];
  let fileCount = 0;

  if (runningTotal >= MAX_TOTAL_FILES) {
    return { text: '', fileCount: 0 };
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { text: `${indent(depth)}  (permission denied)\n`, fileCount: 0 };
  }

  // Separate dirs and files
  const dirs: fs.Dirent[] = [];
  const filesByCategory: Map<FileCategory, number> = new Map();
  const otherExts: Set<string> = new Set();

  let processed = 0;
  for (const entry of entries) {
    if (processed >= MAX_ENTRIES_PER_DIR) {
      lines.push(`${indent(depth)}  ... (${entries.length - processed} more entries skipped)`);
      break;
    }
    processed += 1;

    if (entry.isDirectory()) {
      dirs.push(entry);
    } else if (entry.isFile()) {
      fileCount += 1;
      runningTotal += 1;
      if (runningTotal > MAX_TOTAL_FILES) {
        lines.push(`${indent(depth)}  ... (file limit reached)`);
        break;
      }
      const ext = path.extname(entry.name).toLowerCase().replace(/^\./, '');
      const cat: FileCategory = EXT_CATEGORY_MAP[ext] ?? 'other';
      filesByCategory.set(cat, (filesByCategory.get(cat) ?? 0) + 1);
      if (cat === 'other' && ext) {
        otherExts.add(ext);
      }
    }
  }

  // Print file counts for this directory
  if (fileCount > 0) {
    const parts: string[] = [];
    for (const [cat, count] of filesByCategory) {
      parts.push(`${cat}:${count}`);
    }
    if (otherExts.size > 0 && (filesByCategory.get('other') ?? 0) > 0) {
      parts.push(`other(${[...otherExts].slice(0, 5).join(',')})`);
    }
    lines.push(`${indent(depth)}  ${fileCount} plików (${parts.join(', ')})`);
  }

  // Recurse into subdirectories (max depth 2)
  if (depth < MAX_SCAN_DEPTH) {
    for (const subdir of dirs) {
      const subResult = scanDirForSummary(path.join(dir, subdir.name), depth + 1, runningTotal);
      if (subResult.fileCount > 0) {
        lines.push(`${indent(depth)}  ${subdir.name}/`);
        lines.push(subResult.text);
        fileCount += subResult.fileCount;
        runningTotal += subResult.fileCount;
      } else {
        // Show empty dirs too
        lines.push(`${indent(depth)}  ${subdir.name}/ (pusty)`);
        lines.push(subResult.text);
      }
      if (runningTotal >= MAX_TOTAL_FILES) {
        break;
      }
    }
  }

  return { text: lines.join('\n') + '\n', fileCount };
}

function indent(depth: number): string {
  return '  '.repeat(depth + 1);
}
