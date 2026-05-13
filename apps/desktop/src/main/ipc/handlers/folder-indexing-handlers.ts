/**
 * Folder-indexing IPC handlers.
 *
 * Scanning logic runs in the main process (Node.js fs access).
 * Config persistence goes through the daemon (SQLite access).
 * The existing `files:pick-folder` handler is reused for the
 * custom-folder picker button.
 */
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { handle } from './utils';
import { getDaemonClient } from '../../daemon-bootstrap';
import type {
  FolderIndexingConfig,
  FolderScanResult,
  FileTypeCounts,
  FileCategory,
} from '@nestcafe_ai/agent-core/common';
import { EXT_CATEGORY_MAP } from '@nestcafe_ai/agent-core/common';

/** Maximum number of directory entries to read per level to avoid hanging. */
const MAX_ENTRIES_PER_DIR = 10_000;

/** Depth limit: root = level 0, its children = level 1, grandchildren = level 2. */
const MAX_SCAN_DEPTH = 2;

/**
 * Categorises a file extension (lowercase, no dot) into a {@link FileCategory}.
 */
function categoriseExtension(ext: string): FileCategory {
  return EXT_CATEGORY_MAP[ext] ?? 'other';
}

/**
 * Recursively scans `dir` up to `MAX_SCAN_DEPTH` levels deep and returns
 * file counts grouped by category.
 */
function scanDirectory(dir: string, currentDepth: number): { counts: FileTypeCounts; files: string[] } {
  const counts: FileTypeCounts = {
    pdf: 0,
    docx: 0,
    txt: 0,
    md: 0,
    mp4: 0,
    png: 0,
    jpg: 0,
    mp3: 0,
    other: 0,
  };
  const files: string[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    // Permission denied or missing directory — return zeros.
    return { counts, files };
  }

  let processed = 0;
  for (const entry of entries) {
    if (processed >= MAX_ENTRIES_PER_DIR) {
      break;
    }
    processed += 1;

    if (entry.isFile()) {
      const filePath = path.join(dir, entry.name);
      const ext = path.extname(entry.name).toLowerCase().replace(/^\./, '');
      const cat = categoriseExtension(ext);
      counts[cat] = (counts[cat] ?? 0) + 1;
      files.push(filePath);
    } else if (entry.isDirectory() && currentDepth < MAX_SCAN_DEPTH) {
      const subPath = path.join(dir, entry.name);
      const sub = scanDirectory(subPath, currentDepth + 1);
      for (const cat of Object.keys(sub.counts) as FileCategory[]) {
        counts[cat] = (counts[cat] ?? 0) + sub.counts[cat];
      }
      files.push(...sub.files);
    }
    // Skip symlinks, sockets, etc.
  }

  return { counts, files };
}

export function registerFolderIndexingHandlers(): void {
  // ── Scan folders ──────────────────────────────────────────────────────
  handle(
    'folder-indexing:scan-folders',
    async (_event: IpcMainInvokeEvent, folderPaths: string[]) => {
      if (!Array.isArray(folderPaths)) {
        throw new Error('Lista folderów musi być tablicą ścieżek tekstowych');
      }

      const results: FolderScanResult[] = [];

      for (const folderPath of folderPaths) {
        if (typeof folderPath !== 'string' || !path.isAbsolute(folderPath)) {
          results.push({
            path: folderPath,
            counts: { pdf: 0, docx: 0, txt: 0, md: 0, mp4: 0, png: 0, jpg: 0, mp3: 0, other: 0 },
            total: 0,
            files: [],
            error: `Nieprawidłowa lub niepełna ścieżka: ${String(folderPath)}`,
          });
          continue;
        }

        if (!fs.existsSync(folderPath)) {
          results.push({
            path: folderPath,
            counts: { pdf: 0, docx: 0, txt: 0, md: 0, mp4: 0, png: 0, jpg: 0, mp3: 0, other: 0 },
            total: 0,
            files: [],
            error: 'Folder nie istnieje',
          });
          continue;
        }

        if (!fs.statSync(folderPath).isDirectory()) {
          results.push({
            path: folderPath,
            counts: { pdf: 0, docx: 0, txt: 0, md: 0, mp4: 0, png: 0, jpg: 0, mp3: 0, other: 0 },
            total: 0,
            files: [],
            error: 'Ścieżka nie jest folderem',
          });
          continue;
        }

        try {
          const { counts, files } = scanDirectory(folderPath, 0);
          const total = Object.values(counts).reduce((s, v) => s + v, 0);
          results.push({ path: folderPath, counts, total, files, error: null });
        } catch (err) {
          results.push({
            path: folderPath,
            counts: { pdf: 0, docx: 0, txt: 0, md: 0, mp4: 0, png: 0, jpg: 0, mp3: 0, other: 0 },
            total: 0,
            files: [],
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return results;
    },
  );

  // ── Config read (via daemon) ──────────────────────────────────────────
  handle('folder-indexing:get-config', async () => {
    return getDaemonClient().call('folderIndexing.getConfig');
  });

  // ── Config write (via daemon) ─────────────────────────────────────────
  handle(
    'folder-indexing:set-config',
    async (_event: IpcMainInvokeEvent, config: FolderIndexingConfig) => {
      await getDaemonClient().call('folderIndexing.setConfig', { config });
    },
  );

  // ── System paths (resolve 'desktop' / 'documents' / 'downloads') ──────
  const VALID_SYSTEM_PATHS = ['desktop', 'documents', 'downloads'] as const;
  type SystemPathKind = (typeof VALID_SYSTEM_PATHS)[number];

  handle(
    'folder-indexing:get-system-path',
    async (_event: IpcMainInvokeEvent, kind: string) => {
      if (!VALID_SYSTEM_PATHS.includes(kind as SystemPathKind)) {
        throw new Error(`Invalid system path kind: ${kind}`);
      }
      return app.getPath(kind as SystemPathKind);
    },
  );
}
