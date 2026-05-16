/**
 * Module system types for the pluggable module architecture.
 * Modules are standalone feature packs that extend the app with custom UI and capabilities.
 */

export interface ModuleManifest {
  /** Unique machine-readable identifier (e.g. "ocr-viewer") */
  name: string;
  /** Human-readable title (e.g. "Przeglądarka OCR") */
  title: string;
  /** Semantic version */
  version: string;
  /** Short description of what the module does */
  description: string;
  /** Icon identifier (lucide icon name) */
  icon: string;
  /** Path to the renderer entry point, relative to module directory */
  entry: string;
  /** Optional: permissions the module requires */
  permissions?: string[];
  /** Optional: MCP tool names the module provides */
  mcpTools?: string[];
}

export interface ModuleInstance {
  /** UUID assigned at install time */
  id: string;
  /** Matches ModuleManifest.name */
  name: string;
  title: string;
  version: string;
  description: string;
  icon: string;
  /** Absolute path to the renderer entry */
  entry: string;
  /** Full manifest as stored JSON */
  manifestJson: string;
  /** Whether the module is active */
  enabled: boolean;
  /** ISO timestamp of installation */
  installedAt: string;
  /** Path to the module directory on disk */
  sourcePath: string;
}
