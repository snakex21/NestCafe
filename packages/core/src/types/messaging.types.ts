// ============================================================
// Messaging domain types — WhatsApp and other messaging
// platform integrations for the application.
// ============================================================

export type MessagingPlatform = 'whatsapp';

export type MessagingConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MessagingIntegrationConfig {
  platform: MessagingPlatform;
  enabled: boolean;
  autoConnect: boolean;
  qrTimeoutMs?: number;
}

export interface MessagingConfig {
  integrations: MessagingIntegrationConfig[];
}

export interface MessagingQRCode {
  platform: MessagingPlatform;
  qrData: string;
  expiresAt: string;
}

export interface IncomingMessage {
  id: string;
  platform: MessagingPlatform;
  from: string;
  content: string;
  receivedAt: string;
  attachments?: string[];
}
