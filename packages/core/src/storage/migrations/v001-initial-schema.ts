// ============================================================
// Migration v001 — Initial schema
// Creates all core tables for the NestCafe v2 application.
// ============================================================

import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration: Migration = {
  version: 1,
  up(db: Database.Database) {
    // Schema metadata (tracks current version)
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Application settings (single row)
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id                   INTEGER PRIMARY KEY CHECK (id = 1),
        theme                TEXT NOT NULL DEFAULT 'dark',
        language             TEXT NOT NULL DEFAULT 'en',
        debug_mode           INTEGER NOT NULL DEFAULT 0,
        onboarding_completed INTEGER NOT NULL DEFAULT 0,
        selected_model       TEXT,
        active_provider      TEXT,
        close_behavior       TEXT NOT NULL DEFAULT 'keep-daemon',
        auto_update          INTEGER NOT NULL DEFAULT 1,
        notifications        INTEGER NOT NULL DEFAULT 1,
        created_at           TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO app_settings (id) VALUES (1);
    `);

    // Provider settings (per-provider configuration)
    db.exec(`
      CREATE TABLE IF NOT EXISTS provider_settings (
        provider_id    TEXT PRIMARY KEY,
        status         TEXT NOT NULL DEFAULT 'disconnected',
        selected_model TEXT,
        connected_at   TEXT,
        last_validated INTEGER,
        credentials    TEXT, -- JSON blob
        config         TEXT, -- JSON blob (ollama/litellm/lmstudio/etc. sub-config)
        created_at     TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Tasks
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id            TEXT PRIMARY KEY,
        prompt        TEXT NOT NULL,
        summary       TEXT,
        status        TEXT NOT NULL DEFAULT 'pending',
        session_id    TEXT,
        messages      TEXT NOT NULL DEFAULT '[]', -- JSON array of TaskMessage
        result        TEXT, -- JSON blob
        workspace_id  TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        started_at    TEXT,
        completed_at  TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at DESC);
    `);

    // Task todos
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_todos (
        id         TEXT PRIMARY KEY,
        task_id    TEXT NOT NULL,
        content    TEXT NOT NULL,
        status     TEXT NOT NULL DEFAULT 'pending',
        priority   TEXT NOT NULL DEFAULT 'medium',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_todos_task ON task_todos(task_id);
    `);

    // Workspaces
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        path        TEXT NOT NULL,
        description TEXT,
        is_active   INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Knowledge notes (per workspace)
    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_notes (
        id           TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        type         TEXT NOT NULL DEFAULT 'context',
        title        TEXT NOT NULL,
        content      TEXT NOT NULL DEFAULT '',
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_notes_workspace ON knowledge_notes(workspace_id);
    `);

    // Skills
    db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id           TEXT PRIMARY KEY,
        source       TEXT NOT NULL DEFAULT 'custom',
        name         TEXT NOT NULL,
        description  TEXT NOT NULL DEFAULT '',
        path         TEXT NOT NULL,
        frontmatter  TEXT NOT NULL DEFAULT '{}',
        enabled      INTEGER NOT NULL DEFAULT 1,
        installed_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT
      );
    `);

    // Connectors (MCP OAuth integrations)
    db.exec(`
      CREATE TABLE IF NOT EXISTS connectors (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'disconnected',
        enabled     INTEGER NOT NULL DEFAULT 0,
        metadata    TEXT NOT NULL DEFAULT '{}',
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT
      );
    `);

    // Favorites (starred tasks)
    db.exec(`
      CREATE TABLE IF NOT EXISTS favorites (
        task_id    TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );
    `);

    // Sandbox config (single row)
    db.exec(`
      CREATE TABLE IF NOT EXISTS sandbox_config (
        id             INTEGER PRIMARY KEY CHECK (id = 1),
        mode           TEXT NOT NULL DEFAULT 'disabled',
        network_policy TEXT NOT NULL DEFAULT 'allow-all',
        docker_image   TEXT,
        timeout_ms     INTEGER NOT NULL DEFAULT 300000,
        updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO sandbox_config (id) VALUES (1);
    `);

    // Cloud browser config (single row)
    db.exec(`
      CREATE TABLE IF NOT EXISTS cloud_browser_config (
        id             INTEGER PRIMARY KEY CHECK (id = 1),
        provider       TEXT,
        enabled        INTEGER NOT NULL DEFAULT 0,
        api_key        TEXT,
        region         TEXT,
        last_validated INTEGER,
        updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO cloud_browser_config (id) VALUES (1);
    `);

    // Folder indexing config (single row)
    db.exec(`
      CREATE TABLE IF NOT EXISTS folder_indexing_config (
        id          INTEGER PRIMARY KEY CHECK (id = 1),
        enabled     INTEGER NOT NULL DEFAULT 0,
        paths       TEXT NOT NULL DEFAULT '[]',
        max_depth   INTEGER NOT NULL DEFAULT 5,
        exclusions  TEXT NOT NULL DEFAULT '[]',
        max_size    INTEGER NOT NULL DEFAULT 10485760,
        max_files   INTEGER NOT NULL DEFAULT 10000,
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO folder_indexing_config (id) VALUES (1);
    `);

    // Scheduled tasks (cron-based)
    db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id          TEXT PRIMARY KEY,
        prompt      TEXT NOT NULL,
        cron        TEXT NOT NULL,
        enabled     INTEGER NOT NULL DEFAULT 1,
        workspace_id TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT
      );
    `);

    // Modules (pluggable features)
    db.exec(`
      CREATE TABLE IF NOT EXISTS modules (
        id           TEXT PRIMARY KEY,
        manifest     TEXT NOT NULL,
        enabled      INTEGER NOT NULL DEFAULT 0,
        installed_at TEXT NOT NULL DEFAULT (datetime('now')),
        path         TEXT NOT NULL
      );
    `);

    // Google accounts
    db.exec(`
      CREATE TABLE IF NOT EXISTS google_accounts (
        id             TEXT PRIMARY KEY,
        email          TEXT NOT NULL,
        display_name   TEXT,
        photo_url      TEXT,
        status         TEXT NOT NULL DEFAULT 'disconnected',
        access_token   TEXT,
        refresh_token  TEXT,
        expires_at     INTEGER,
        scope          TEXT,
        token_type     TEXT,
        last_synced_at TEXT,
        created_at     TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at     TEXT
      );
    `);
  },
};
