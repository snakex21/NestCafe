import type { Database } from 'better-sqlite3';
import type { Migration } from './index.js';

/**
 * v033 — Add FTS5 full-text search across conversation history.
 *
 * Creates a virtual table `task_messages_fts` that indexes the `content`
 * column of `task_messages`. Three triggers keep the FTS index in sync
 * with INSERT, UPDATE (upsert via ON CONFLICT), and DELETE operations.
 * A final 'rebuild' populates the index from any existing messages.
 */
export const migration: Migration = {
  version: 33,
  up: (db: Database) => {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS task_messages_fts USING fts5(
        content,
        task_id UNINDEXED,
        content=task_messages,
        content_rowid=rowid
      )
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS task_messages_fts_ai AFTER INSERT ON task_messages BEGIN
        INSERT INTO task_messages_fts(rowid, content, task_id)
        VALUES (new.rowid, new.content, new.task_id);
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS task_messages_fts_ad AFTER DELETE ON task_messages BEGIN
        INSERT INTO task_messages_fts(task_messages_fts, rowid, content, task_id)
        VALUES ('delete', old.rowid, old.content, old.task_id);
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS task_messages_fts_au AFTER UPDATE ON task_messages BEGIN
        INSERT INTO task_messages_fts(task_messages_fts, rowid, content, task_id)
        VALUES ('delete', old.rowid, old.content, old.task_id);
        INSERT INTO task_messages_fts(rowid, content, task_id)
        VALUES (new.rowid, new.content, new.task_id);
      END
    `);

    db.exec(`INSERT INTO task_messages_fts(task_messages_fts) VALUES ('rebuild')`);
  },
};
