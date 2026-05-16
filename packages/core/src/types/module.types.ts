// ============================================================
// Module domain types — pluggable module system for
// extending the application with additional features.
// ============================================================

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  entryPoint: string;
  permissions?: string[];
  dependencies?: Record<string, string>;
}

export interface ModuleInstance {
  id: string;
  manifest: ModuleManifest;
  enabled: boolean;
  installedAt: string;
  path: string;
}
