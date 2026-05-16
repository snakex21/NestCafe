// ============================================================
// Google Account domain types — Google Workspace multi-account
// management for file access, calendar, and email integration.
// ============================================================

export type GoogleAccountStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'expired';

export interface GoogleAccountToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
}

export interface GoogleAccount {
  id: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  status: GoogleAccountStatus;
  token?: GoogleAccountToken;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt?: string;
}
