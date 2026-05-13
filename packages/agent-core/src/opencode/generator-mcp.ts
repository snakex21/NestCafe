/**
 * MCP server configuration builder for OpenCode config generation.
 * Extracted from config-generator.ts to keep that file focused on high-level orchestration.
 */
import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { OPENCODE_SLACK_MCP_SERVER_URL, OPENCODE_SLACK_MCP_CLIENT_ID } from './auth.js';
import { MCP_TOOL_TIMEOUT_MS } from '../common/constants.js';
import { createConsoleLogger } from '../utils/logging.js';

const log = createConsoleLogger({ prefix: 'OpenCodeMcpGenerator' });

/** Browser automation mode for task execution. */
export interface BrowserConfig {
  /** 'builtin' = dev-browser HTTP server (default), 'remote' = connect to CDP endpoint, 'none' = no browser */
  mode: 'builtin' | 'remote' | 'none';
  /** For 'remote': the CDP endpoint URL */
  cdpEndpoint?: string;
  /** For 'remote': auth headers (e.g. { 'X-CDP-Secret': '...' }) */
  cdpHeaders?: Record<string, string>;
  /** For 'builtin': run headless */
  headless?: boolean;
}

export interface McpServerConfig {
  type?: 'local' | 'remote';
  command?: string[];
  url?: string;
  headers?: Record<string, string>;
  enabled?: boolean;
  environment?: Record<string, string>;
  timeout?: number;
  oauth?:
    | false
    | {
        clientId?: string;
        clientSecret?: string;
        scope?: string;
      };
}

function resolveMcpCommand(
  mcpToolsPath: string,
  mcpName: string,
  distRelPath: string,
  nodePath: string,
): string[] {
  const mcpDir = path.join(mcpToolsPath, mcpName);
  const distPath = path.join(mcpDir, distRelPath);
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `[OpenCode Config] Missing MCP dist entry: ${distPath}. ` +
        'Run "pnpm -F @nestcafe/desktop build:mcp-tools:dev" before launching.',
    );
  }
  return [nodePath, distPath];
}

function resolveNoApiGoogleSearchCommand(): { command: string[]; environment: Record<string, string> } | null {
  // 1. Bundled Python + MCP (packaged app or dev mode)
  const bundledBase = (() => {
    const resPath = process.env.NESTCAFE_RESOURCES_PATH;
    if (resPath) {
      return path.join(resPath, 'google-search-mcp');
    }
    // Dev mode fallback: look relative to project root
    const devPath = path.resolve(__dirname, '..', '..', '..', 'apps', 'desktop', 'resources', 'google-search-mcp');
    if (fs.existsSync(devPath)) return devPath;
    return null;
  })();

  let pythonCmd: string;
  let mcpSrcDir: string | null = null;

  if (bundledBase) {
    pythonCmd = process.platform === 'win32'
      ? path.join(bundledBase, 'venv', 'Scripts', 'python.exe')
      : path.join(bundledBase, 'venv', 'bin', 'python');
    mcpSrcDir = path.join(bundledBase, 'src');
    if (!fs.existsSync(pythonCmd)) return null;
  } else {
    // 2. Env override or system Python
    const envDir = process.env.NESTCAFE_NOAPI_GOOGLE_SEARCH_MCP_DIR;
    if (envDir) {
      pythonCmd = process.platform === 'win32'
        ? path.join(envDir, 'venv', 'Scripts', 'python.exe')
        : path.join(envDir, 'venv', 'bin', 'python');
      mcpSrcDir = path.join(envDir, 'src');
    } else {
      pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    }
  }

  // Quick check if python + MCP is available
  try {
    const result = spawnSync(pythonCmd, ['-m', 'google_search_mcp', '--help'], {
      timeout: 5000,
      stdio: 'pipe',
    });
    if (result.status !== 0 && result.error) return null;
  } catch {
    return null;
  }

  return {
    command: [pythonCmd, '-m', 'google_search_mcp'],
    environment: {
      PYTHONUNBUFFERED: '1',
      ...(mcpSrcDir ? { PYTHONPATH: mcpSrcDir } : {}),
    },
  };
}

export interface BuildMcpServersOptions {
  mcpToolsPath: string;
  nodeExe: string;
  /** Port for the WhatsApp HTTP API (daemon). Omit to disable the tool. */
  whatsappApiPort?: number;
  browserConfig: BrowserConfig;
  /** Auth token for daemon HTTP APIs. MCP tools send this as Authorization header. */
  authToken?: string;
  connectors?: Array<{
    id: string;
    name: string;
    url: string;
    accessToken: string;
  }>;
  /**
   * Path to GWS accounts manifest JSON. When set, gmail-mcp, calendar-mcp,
   * and gws-mcp are registered and receive this path via GWS_ACCOUNTS_MANIFEST.
   */
  gwsAccountsManifestPath?: string;
}

/**
 * Builds the MCP server configuration map for OpenCode.
 * Includes built-in tools, browser config, and connected remote MCP connectors.
 */
export function buildMcpServers(options: BuildMcpServersOptions): Record<string, McpServerConfig> {
  const {
    mcpToolsPath,
    nodeExe,
    whatsappApiPort,
    browserConfig,
    authToken,
    connectors,
    gwsAccountsManifestPath,
  } = options;

  // Auth env for daemon HTTP APIs — MCP tools send this as Authorization header
  const authEnv: Record<string, string> = authToken
    ? { NESTCAFE_DAEMON_AUTH_TOKEN: authToken }
    : {};

  const mcpServers: Record<string, McpServerConfig> = {
    slack: {
      type: 'remote',
      url: OPENCODE_SLACK_MCP_SERVER_URL,
      oauth: { clientId: OPENCODE_SLACK_MCP_CLIENT_ID },
    },
    'request-connector-auth': {
      type: 'local',
      command: resolveMcpCommand(mcpToolsPath, 'request-connector-auth', 'dist/index.mjs', nodeExe),
      enabled: true,
      environment: { ...authEnv },
      timeout: MCP_TOOL_TIMEOUT_MS,
    },
    'complete-task': {
      type: 'local',
      command: resolveMcpCommand(mcpToolsPath, 'complete-task', 'dist/index.mjs', nodeExe),
      enabled: true,
      timeout: 30000,
    },
    'start-task': {
      type: 'local',
      command: resolveMcpCommand(mcpToolsPath, 'start-task', 'dist/index.mjs', nodeExe),
      enabled: true,
      timeout: 30000,
    },
    'wiki-memory': {
      type: 'local',
      command: resolveMcpCommand(mcpToolsPath, 'wiki-memory', 'dist/index.mjs', nodeExe),
      enabled: true,
      environment: {
        NESTCAFE_MEMORY_DIR:
          process.env.NESTCAFE_MEMORY_DIR || path.join(process.cwd(), 'memory'),
      },
      timeout: 30000,
    },
    'search-conversations': {
      type: 'local',
      command: resolveMcpCommand(mcpToolsPath, 'search-conversations', 'dist/index.mjs', nodeExe),
      enabled: true,
      environment: {
        NESTCAFE_DB_PATH: process.env.NESTCAFE_DB_PATH || '',
      },
      timeout: 30000,
    },
  };

  if (whatsappApiPort) {
    mcpServers['whatsapp'] = {
      type: 'local',
      command: resolveMcpCommand(mcpToolsPath, 'whatsapp', 'dist/index.mjs', nodeExe),
      enabled: true,
      environment: {
        NESTCAFE_WHATSAPP_API_PORT: String(whatsappApiPort),
        ...authEnv,
      },
      timeout: 30000,
    };
  }

  if (browserConfig.mode !== 'none') {
    const browserEnv: Record<string, string> = {};
    if (browserConfig.mode === 'remote') {
      if (browserConfig.cdpEndpoint) {
        browserEnv.CDP_ENDPOINT = browserConfig.cdpEndpoint;
      }
      if (browserConfig.cdpHeaders) {
        for (const [key, value] of Object.entries(browserConfig.cdpHeaders)) {
          if (key.toLowerCase() === 'x-cdp-secret') {
            browserEnv.CDP_SECRET = value;
          }
        }
      }
    }
    mcpServers['dev-browser-mcp'] = {
      type: 'local',
      command: resolveMcpCommand(mcpToolsPath, 'dev-browser-mcp', 'dist/index.mjs', nodeExe),
      enabled: true,
      ...(Object.keys(browserEnv).length > 0 && { environment: browserEnv }),
      timeout: 30000,
    };
  }

  const noApiGoogleSearch = resolveNoApiGoogleSearchCommand();
  if (noApiGoogleSearch) {
    mcpServers['noapi-google-search'] = {
      type: 'local',
      command: noApiGoogleSearch.command,
      enabled: true,
      environment: noApiGoogleSearch.environment,
      timeout: 120000,
    };
  }

  if (gwsAccountsManifestPath) {
    const gwsEnv = { GWS_ACCOUNTS_MANIFEST: gwsAccountsManifestPath };
    try {
      mcpServers['gmail-mcp'] = {
        type: 'local',
        command: resolveMcpCommand(mcpToolsPath, 'gmail-mcp', 'dist/index.mjs', nodeExe),
        enabled: true,
        environment: gwsEnv,
        timeout: 60000,
      };
    } catch (err) {
      log.warn(`[OpenCode MCP] gmail-mcp not registered: ${err}`);
    }
    try {
      mcpServers['calendar-mcp'] = {
        type: 'local',
        command: resolveMcpCommand(mcpToolsPath, 'calendar-mcp', 'dist/index.mjs', nodeExe),
        enabled: true,
        environment: gwsEnv,
        timeout: 60000,
      };
    } catch (err) {
      log.warn(`[OpenCode MCP] calendar-mcp not registered: ${err}`);
    }
    try {
      mcpServers['gws-mcp'] = {
        type: 'local',
        command: resolveMcpCommand(mcpToolsPath, 'gws-mcp', 'dist/index.mjs', nodeExe),
        enabled: true,
        environment: gwsEnv,
        timeout: 60000,
      };
    } catch (err) {
      log.warn(`[OpenCode MCP] gws-mcp not registered: ${err}`);
    }
    try {
      mcpServers['request-google-file-picker'] = {
        type: 'local',
        command: resolveMcpCommand(
          mcpToolsPath,
          'request-google-file-picker',
          'dist/index.mjs',
          nodeExe,
        ),
        enabled: true,
        environment: gwsEnv,
        timeout: 30000,
      };
    } catch (err) {
      log.warn(`[OpenCode MCP] request-google-file-picker not registered: ${err}`);
    }
  }

  if (connectors) {
    for (const connector of connectors) {
      const sanitized = connector.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 20);
      const baseName = sanitized || 'mcp-remote';
      const idSuffix = connector.id.slice(0, 6);
      let key = `connector-${baseName}-${idSuffix}`;
      if (mcpServers[key]) {
        let i = 1;
        while (mcpServers[`${key}-${i}`]) {
          i += 1;
        }
        key = `${key}-${i}`;
      }
      mcpServers[key] = {
        type: 'remote',
        url: connector.url,
        headers: { Authorization: `Bearer ${connector.accessToken}` },
        enabled: true,
      };
    }
  }

  return mcpServers;
}
