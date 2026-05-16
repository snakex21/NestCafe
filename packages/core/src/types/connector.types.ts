// ============================================================
// Connector domain types — OAuth-based integrations with
// external services (Slack, GitHub, Jira, Google, etc.).
// ============================================================

export type OAuthProviderId =
  | 'slack'
  | 'google'
  | 'jira'
  | 'github'
  | 'monday'
  | 'notion'
  | 'lightdash'
  | 'datadog';

export type ConnectorStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
}

export interface OAuthMetadata {
  providerId: OAuthProviderId;
  installedAt: string;
  lastUsedAt?: string;
  accountEmail?: string;
  accountName?: string;
}

export interface OAuthClientRegistration {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
}

export interface McpConnector {
  id: string;
  name: string;
  providerId: OAuthProviderId;
  status: ConnectorStatus;
  enabled: boolean;
  metadata: OAuthMetadata;
  createdAt: string;
  updatedAt?: string;
}
