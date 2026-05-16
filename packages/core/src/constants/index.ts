// ============================================================
// Application constants — all magic values in one place.
// Import from here instead of defining inline strings/numbers.
// ============================================================

// ---- Task execution ----

/** Maximum time a task can run before forced timeout (5 minutes). */
export const TASK_EXECUTION_TIMEOUT_MS = 300_000;

/** Maximum time to wait for permission response before auto-deny. */
export const PERMISSION_TIMEOUT_MS = 60_000;

/** Maximum messages retained in task history per task. */
export const MAX_TASK_MESSAGES = 10_000;

/** Grace period for daemon drain before force-kill. */
export const DAEMON_DRAIN_TIMEOUT_MS = 30_000;

// ---- Storage ----

export const SQLITE_WAL_MODE = true;
export const SQLITE_BUSY_TIMEOUT_MS = 5000;
export const STORAGE_CURRENT_VERSION = 1;

// ---- IPC / RPC ----

export const IPC_CHANNEL_PREFIX = 'nestcafe:';
export const RPC_RECONNECT_DELAY_MS = 1000;
export const RPC_MAX_RECONNECT_ATTEMPTS = 10;

// ---- File system ----

export const DEFAULT_WORKSPACE_NAME = 'Default Workspace';
export const MAX_FILE_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50 MB

// ---- UI ----

export const SIDEBAR_WIDTH_PX = 280;
export const SETTINGS_DIALOG_WIDTH_PX = 720;
export const TOAST_DURATION_MS = 5000;

// ---- Logging ----

export const MAX_LOG_ENTRIES = 50_000;
export const LOG_FLUSH_INTERVAL_MS = 5000;

// ---- OAuth ----

export const OAUTH_CALLBACK_PORT_MIN = 18200;
export const OAUTH_CALLBACK_PORT_MAX = 18299;
export const OAUTH_TOKEN_REFRESH_BUFFER_MS = 300_000; // 5 min before expiry

// ---- Provider defaults ----

export const DEFAULT_PROVIDER_ID = 'anthropic';
export const DEFAULT_THEME = 'dark';
export const DEFAULT_LANGUAGE = 'en';
