// ============================================================
// Browser view domain types — live browser preview frames,
// navigation, and status events from task execution.
// ============================================================

export interface BrowserFramePayload {
  taskId: string;
  data: string; // base64-encoded image
  format: 'png' | 'jpeg';
  timestamp: string;
}

export interface BrowserStatusPayload {
  taskId: string;
  status: 'navigating' | 'loading' | 'ready' | 'error';
  url?: string;
  title?: string;
  error?: string;
  timestamp: string;
}

export interface BrowserNavigatePayload {
  taskId: string;
  url: string;
  timestamp: string;
}
