// ============================================================
// GitHub Copilot provider — OAuth device-code flow for
// free AI access via GitHub Copilot subscription.
// ============================================================

export const GITHUB_COPILOT_OAUTH_CLIENT_ID = 'Iv23li...'; // placeholder
export const GITHUB_COPILOT_DEVICE_CODE_URL = 'https://github.com/login/device/code';
export const GITHUB_COPILOT_TOKEN_URL = 'https://github.com/login/oauth/access_token';
export const GITHUB_COPILOT_AUTH_URL = 'https://github.com/login/device';
export const GITHUB_COPILOT_SCOPE = 'read:user';

export interface CopilotDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface CopilotTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export type CopilotOAuthStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'expired';

export interface CopilotAuthEntry {
  status: CopilotOAuthStatus;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

/**
 * Request a device code from GitHub for Copilot OAuth.
 */
export async function requestCopilotDeviceCode(): Promise<CopilotDeviceCodeResponse> {
  const response = await fetch(GITHUB_COPILOT_DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_COPILOT_OAUTH_CLIENT_ID,
      scope: GITHUB_COPILOT_SCOPE,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to request device code: HTTP ${response.status}`);
  }

  return response.json() as Promise<CopilotDeviceCodeResponse>;
}

/**
 * Poll for an access token after the user authorizes the device code.
 */
export async function pollCopilotDeviceToken(
  deviceCode: string,
): Promise<CopilotTokenResponse | null> {
  const response = await fetch(GITHUB_COPILOT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_COPILOT_OAUTH_CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<CopilotTokenResponse>;
}

/**
 * Get the current Copilot OAuth status from stored tokens.
 */
export function getCopilotOAuthStatus(entry?: CopilotAuthEntry): CopilotOAuthStatus {
  if (!entry) {
    return 'disconnected';
  }
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    return 'expired';
  }
  return entry.status;
}

/**
 * Store Copilot OAuth tokens.
 */
export function setCopilotOAuthTokens(
  entry: CopilotAuthEntry,
  tokens: CopilotTokenResponse,
): CopilotAuthEntry {
  entry.accessToken = tokens.access_token;
  entry.status = 'connected';
  entry.expiresAt = Date.now() + 3600 * 1000; // 1 hour default
  return entry;
}

/**
 * Clear Copilot OAuth state.
 */
export function clearCopilotOAuth(entry?: CopilotAuthEntry): CopilotAuthEntry {
  return { status: 'disconnected' };
}
