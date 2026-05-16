// ============================================================
// Domain types barrel — re-exports all type definitions.
// Each file covers one domain; import only what you need.
// ============================================================

// Task
export type {
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
} from './task.types.js';
export { STARTUP_STAGES } from './task.types.js';

// Provider
export type {
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
} from './provider.types.js';
export {
  ALLOWED_API_KEY_PROVIDERS,
  STANDARD_VALIDATION_PROVIDERS,
  DEFAULT_PROVIDERS,
  DEFAULT_MODEL,
  COPILOT_MODELS,
  NIM_DEFAULT_BASE_URL,
  MINIMAX_DEFAULT_BASE_URL,
} from './provider.types.js';

// Permission
export type {
  FileOperation,
  PermissionRequest,
  PermissionOption,
  PermissionResponse,
} from './permission.types.js';
export {
  FILE_OPERATIONS,
  FILE_PERMISSION_REQUEST_PREFIX,
  QUESTION_REQUEST_PREFIX,
} from './permission.types.js';

// Auth
export type {
  ApiKeyConfig,
  BedrockAccessKeyCredentials,
  BedrockProfileCredentials,
  BedrockApiKeyCredentials,
  BedrockCredentials,
  VertexServiceAccountCredentials,
  VertexAdcCredentials,
  VertexCredentials,
} from './auth.types.js';

// Logging
export type { LogLevel, LogSource, LogEntry } from './logging.types.js';

// OpenCode
export type {
  OpenCodeMessageBase,
  OpenCodeStepStartMessage,
  OpenCodeTextMessage,
  OpenCodeToolCallMessage,
  OpenCodeToolUseMessage,
  OpenCodeToolResultMessage,
  OpenCodeStepFinishMessage,
  OpenCodeErrorMessage,
  OpenCodeMessage,
} from './opencode.types.js';

// Workspace
export type {
  Workspace,
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
  KnowledgeNoteType,
  KnowledgeNote,
  KnowledgeNoteCreateInput,
  KnowledgeNoteUpdateInput,
} from './workspace.types.js';

// Skills
export type { SkillSource, Skill, SkillFrontmatter } from './skill.types.js';

// Connectors
export type {
  OAuthProviderId,
  ConnectorStatus,
  OAuthTokens,
  OAuthMetadata,
  OAuthClientRegistration,
  McpConnector,
} from './connector.types.js';

// To-dos
export type { TodoItem, TodoStatus, TodoPriority } from './todo.types.js';

// Modules
export type { ModuleManifest, ModuleInstance } from './module.types.js';

// Folder indexing
export type {
  FileCategory,
  ExtensionCategoryMap,
  FileTypeCounts,
  FolderIndexEntry,
  FolderIndexingConfig,
  FolderScanResult,
} from './folder-indexing.types.js';
export { EXT_CATEGORY_MAP, DEFAULT_FOLDER_INDEXING_CONFIG } from './folder-indexing.types.js';

// Sandbox
export type {
  SandboxMode,
  SandboxNetworkPolicy,
  SandboxPaths,
  SandboxConfig,
  SpawnArgs,
} from './sandbox.types.js';
export { DEFAULT_SANDBOX_CONFIG } from './sandbox.types.js';

// Cloud browser
export type {
  CloudBrowserProvider,
  CloudBrowserProviderConfig,
  CloudBrowserConfig,
} from './cloud-browser.types.js';
export { DEFAULT_CLOUD_BROWSER_CONFIG } from './cloud-browser.types.js';

// Messaging
export type {
  MessagingPlatform,
  MessagingConnectionStatus,
  MessagingIntegrationConfig,
  MessagingConfig,
  MessagingQRCode,
  IncomingMessage,
} from './messaging.types.js';

// Google accounts
export type {
  GoogleAccountStatus,
  GoogleAccount,
  GoogleAccountToken,
} from './google-account.types.js';

// Gateway
export type { CreditUsage } from './gateway.types.js';

// Browser view
export type {
  BrowserFramePayload,
  BrowserStatusPayload,
  BrowserNavigatePayload,
} from './browser-view.types.js';

// Settings
export type {
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
} from './settings.types.js';
export { PROVIDER_META, DEFAULT_MODELS, PROVIDER_ID_TO_OPENCODE } from './settings.types.js';

// Daemon
export type {
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
} from './daemon.types.js';
export { JSON_RPC_ERRORS } from './daemon.types.js';
