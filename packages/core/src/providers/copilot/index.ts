// ============================================================
// Copilot provider barrel.
// ============================================================

export {
  GITHUB_COPILOT_OAUTH_CLIENT_ID,
  GITHUB_COPILOT_DEVICE_CODE_URL,
  GITHUB_COPILOT_TOKEN_URL,
  GITHUB_COPILOT_AUTH_URL,
  GITHUB_COPILOT_SCOPE,
  requestCopilotDeviceCode,
  pollCopilotDeviceToken,
  getCopilotOAuthStatus,
  setCopilotOAuthTokens,
  clearCopilotOAuth,
} from './copilot.js';
export type {
  CopilotDeviceCodeResponse,
  CopilotTokenResponse,
  CopilotOAuthStatus,
  CopilotAuthEntry,
} from './copilot.js';
