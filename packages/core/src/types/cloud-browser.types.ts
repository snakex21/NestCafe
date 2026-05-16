// ============================================================
// Cloud browser domain types — remote browser automation
// providers (Browserbase, Steel, etc.).
// ============================================================

export type CloudBrowserProvider = 'browserbase' | 'steel';

export interface CloudBrowserProviderConfig {
  provider: CloudBrowserProvider;
  apiKey: string;
  region?: string;
}

export interface CloudBrowserConfig {
  provider?: CloudBrowserProvider;
  enabled: boolean;
  apiKey?: string;
  region?: string;
  lastValidated?: number;
}

export const DEFAULT_CLOUD_BROWSER_CONFIG: CloudBrowserConfig = {
  enabled: false,
};
