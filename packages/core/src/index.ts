// ============================================================
// @nestcafe/core — Public API
//
// This is the main entry point for Node.js consumers (daemon,
// desktop main process). Import from here for all core functionality.
//
// For browser-safe types/constants only, use `@nestcafe/core/common`.
// ============================================================

// ---- Domain Types ----
export type {
  // Task
  TaskStatus,
  TaskSource,
  TaskConfig,
  FileAttachmentInfo,
  TaskAttachment,
  Task,
  TaskMessage,
  TaskPauseAction,
  TaskResult,
  TaskProgress,
  TaskUpdateEvent,
  StartupStage,
  // Provider
  ProviderType,
  ApiKeyProvider,
  ModelsEndpointConfig,
  ProviderConfig,
  ModelConfig,
  SelectedModel,
  OllamaModelInfo,
  OllamaConfig,
  LiteLLMModel,
  LiteLLMConfig,
  LMStudioModel,
  LMStudioConfig,
  HuggingFaceLocalModelInfo,
  HuggingFaceLocalConfig,
  AzureFoundryConfig,
  NimModel,
  NimConfig,
  // Permission
  FileOperation,
  PermissionRequest,
  PermissionOption,
  PermissionResponse,
  // Auth
  ApiKeyConfig,
  BedrockAccessKeyCredentials,
  BedrockProfileCredentials,
  BedrockApiKeyCredentials,
  BedrockCredentials,
  VertexServiceAccountCredentials,
  VertexAdcCredentials,
  VertexCredentials,
  // Logging
  LogLevel,
  LogSource,
  LogEntry,
  // OpenCode
  OpenCodeMessageBase,
  OpenCodeStepStartMessage,
  OpenCodeTextMessage,
  OpenCodeToolCallMessage,
  OpenCodeToolUseMessage,
  OpenCodeToolResultMessage,
  OpenCodeStepFinishMessage,
  OpenCodeErrorMessage,
  OpenCodeMessage,
  // Workspace
  Workspace,
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
  KnowledgeNoteType,
  KnowledgeNote,
  KnowledgeNoteCreateInput,
  KnowledgeNoteUpdateInput,
  // Skills
  SkillSource,
  Skill,
  SkillFrontmatter,
  // Connectors
  OAuthProviderId,
  ConnectorStatus,
  OAuthTokens,
  OAuthMetadata,
  OAuthClientRegistration,
  McpConnector,
  // To-dos
  TodoItem,
  TodoStatus,
  TodoPriority,
  // Modules
  ModuleManifest,
  ModuleInstance,
  // Settings
  ProviderId,
  ProviderCategory,
  ProviderMeta,
  ConnectionStatus,
  ApiKeyCredentials,
  BedrockProviderCredentials,
  OllamaCredentials,
  OpenRouterCredentials,
  LiteLLMCredentials,
  LMStudioCredentials,
  VertexProviderCredentials,
  AzureFoundryCredentials,
  OAuthCredentials,
  ProviderCredentials,
  ToolSupportStatus,
  ConnectedProvider,
  SettingsSnapshot,
  // Folder indexing
  FileCategory,
  ExtensionCategoryMap,
  FileTypeCounts,
  FolderIndexEntry,
  FolderIndexingConfig,
  FolderScanResult,
  // Sandbox
  SandboxMode,
  SandboxNetworkPolicy,
  SandboxPaths,
  SandboxConfig,
  SpawnArgs,
  // Cloud browser
  CloudBrowserProvider,
  CloudBrowserProviderConfig,
  CloudBrowserConfig,
  // Messaging
  MessagingPlatform,
  MessagingConnectionStatus,
  MessagingIntegrationConfig,
  MessagingConfig,
  MessagingQRCode,
  IncomingMessage,
  // Google accounts
  GoogleAccountStatus,
  GoogleAccount,
  GoogleAccountToken,
  // Gateway
  CreditUsage,
  // Browser view
  BrowserFramePayload,
  BrowserStatusPayload,
  BrowserNavigatePayload,
  // Daemon
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  TaskStartParams,
  HealthCheckResult,
  SettingsChangePayload,
  WorkspaceChangePayload,
  DaemonMethodMap,
  DaemonNotificationMap,
  DaemonMethod,
} from './types/index.js';

// ---- Constants (values) ----
export {
  STARTUP_STAGES,
  ALLOWED_API_KEY_PROVIDERS,
  STANDARD_VALIDATION_PROVIDERS,
  DEFAULT_PROVIDERS,
  DEFAULT_MODEL,
  COPILOT_MODELS,
  NIM_DEFAULT_BASE_URL,
  MINIMAX_DEFAULT_BASE_URL,
  FILE_OPERATIONS,
  FILE_PERMISSION_REQUEST_PREFIX,
  QUESTION_REQUEST_PREFIX,
  EXT_CATEGORY_MAP,
  DEFAULT_FOLDER_INDEXING_CONFIG,
  DEFAULT_SANDBOX_CONFIG,
  DEFAULT_CLOUD_BROWSER_CONFIG,
  PROVIDER_META,
  DEFAULT_MODELS,
  PROVIDER_ID_TO_OPENCODE,
  JSON_RPC_ERRORS,
} from './types/index.js';

// ---- API Interfaces ----
export type {
  TaskManagerAPI,
  StorageAPI,
  PermissionHandlerAPI,
  LogWriterAPI,
  SkillsManagerAPI,
  SpeechServiceAPI,
  TranscriptionResult,
} from './api/index.js';

// ---- Application Constants ----
export {
  TASK_EXECUTION_TIMEOUT_MS,
  PERMISSION_TIMEOUT_MS,
  MAX_TASK_MESSAGES,
  DAEMON_DRAIN_TIMEOUT_MS,
  SQLITE_BUSY_TIMEOUT_MS,
  STORAGE_CURRENT_VERSION,
  IPC_CHANNEL_PREFIX,
  RPC_RECONNECT_DELAY_MS,
  RPC_MAX_RECONNECT_ATTEMPTS,
  DEFAULT_WORKSPACE_NAME,
  MAX_FILE_ATTACHMENT_SIZE,
  SIDEBAR_WIDTH_PX,
  SETTINGS_DIALOG_WIDTH_PX,
  TOAST_DURATION_MS,
  MAX_LOG_ENTRIES,
  LOG_FLUSH_INTERVAL_MS,
  OAUTH_CALLBACK_PORT_MIN,
  OAUTH_CALLBACK_PORT_MAX,
  OAUTH_TOKEN_REFRESH_BUFFER_MS,
  DEFAULT_PROVIDER_ID,
  DEFAULT_THEME,
  DEFAULT_LANGUAGE,
} from './constants/index.js';

// ---- Utils ----
export { generateId, generateTypedId } from './utils/id.js';
export { safeJsonParse, safeJsonStringify } from './utils/json.js';

// ---- Storage ----
export {
  getDatabase,
  initializeDatabase,
  closeDatabase,
  isDatabaseInitialized,
  getDatabasePath,
  resetDatabase,
  databaseExists,
} from './storage/database.js';
export type { DatabaseOptions } from './storage/database.js';

export { SecureStorage } from './storage/secure-storage.js';
export type { SecureStorageOptions } from './storage/secure-storage.js';

export {
  runMigrations,
  registerMigration,
  getStoredVersion,
  setStoredVersion,
  CURRENT_VERSION,
} from './storage/migrations/index.js';
export type { Migration } from './storage/migrations/index.js';

export {
  FutureSchemaError,
  MigrationError,
  CorruptDatabaseError,
} from './storage/migrations/errors.js';

// ---- Providers ----
export {
  getModelsForProvider,
  getDefaultModelForProvider,
  isValidModel,
  findModelById,
  getProviderById,
  providerRequiresApiKey,
  getApiKeyEnvVar,
  validateApiKey,
  validateBedrockCredentials,
  fetchBedrockModels,
  BEDROCK_MODELS,
  resolveBedrockCredentials,
  validateVertexCredentials,
  fetchVertexModels,
  resolveVertexCredentials,
  validateAzureFoundry,
  testAzureFoundryConnection,
  getEntraIdToken,
  testOllamaConnection,
  testLMStudioConnection,
  validateLMStudioConfig,
  LMSTUDIO_REQUEST_TIMEOUT_MS,
  LMSTUDIO_KNOWN_MODELS,
  HF_LOCAL_DEFAULT_URL,
  HF_RECOMMENDED_MODELS,
  searchHuggingFaceHubModels,
  testHuggingFaceLocalConnection,
  fetchOpenRouterModels,
  testLiteLLMConnection,
  testNimConnection,
  GITHUB_COPILOT_OAUTH_CLIENT_ID,
  requestCopilotDeviceCode,
  pollCopilotDeviceToken,
  getCopilotOAuthStatus,
  setCopilotOAuthTokens,
  clearCopilotOAuth,
} from './providers/index.js';
export type {
  ValidationResult,
  ValidationOptions,
  BedrockModel,
  FetchBedrockModelsResult,
  VertexModel,
  AzureFoundryValidationOptions,
  AzureFoundryConnectionResult,
  OllamaModel,
  OllamaConnectionResult,
  LMStudioConnectionResult,
  HuggingFaceHubModel,
  OpenRouterModel,
  FetchModelsResult,
  LiteLLMConnectionResult,
  NimConnectionResult,
  CopilotDeviceCodeResponse,
  CopilotTokenResponse,
  CopilotOAuthStatus,
  CopilotAuthEntry,
} from './providers/index.js';

// ---- Factories ----
export {
  createTaskManager,
  createStorage,
  createPermissionHandler,
  createLogWriter,
  createSkillsManager,
  createSpeechService,
} from './factories/index.js';
export type { TaskManagerOptions, StorageOptions } from './factories/index.js';

// ---- Daemon ----
export {
  DaemonRpcServer,
  DaemonRpcClient,
  acquirePidLock,
  releasePidLock,
} from './daemon/index.js';
export type { DaemonRpcServerOptions, PidLockOptions } from './daemon/index.js';

// ---- OpenCode ----
export {
  generateOpenCodeConfig,
  resolveOpenCodeCli,
  isOpenCodeAvailable,
  NESTCAFE_AGENT_NAME,
} from './opencode/index.js';

// ---- Sandbox ----
export {
  DisabledSandboxProvider,
  NativeSandboxProvider,
  DockerSandboxProvider,
} from './sandbox/index.js';
