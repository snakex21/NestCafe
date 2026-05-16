#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const memoryDir = process.env.NESTCAFE_MEMORY_DIR || path.join(process.cwd(), 'memory');

function pageToFile(page: string): string {
  const safe = page
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .join('-')
    .replace(/[^\p{L}\p{N}._ -]/gu, '_')
    .slice(0, 120);
  return path.join(memoryDir, `${safe || 'index'}.md`);
}

function fileToPage(filePath: string): string {
  return path.basename(filePath, '.md').replace(/_/g, ' ').trim();
}

async function ensureMemoryDir() {
  await fs.mkdir(memoryDir, { recursive: true });
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Simple TF-IDF‑like paragraph scorer for semantic search.
// ---------------------------------------------------------------------------
type ScoredParagraph = {
  file: string;
  score: number;
  snippet: string;
  heading: string;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\uFFFF\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function computeIdf(paragraphs: string[], terms: string[]): Map<string, number> {
  const docCount = paragraphs.length;
  const df = new Map<string, number>();
  for (const p of paragraphs) {
    const unique = new Set(tokenize(p));
    for (const t of unique) {
      df.set(t, (df.get(t) || 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const t of terms) {
    const count = df.get(t) || 0;
    idf.set(t, Math.log((docCount + 1) / (count + 1)) + 1);
  }
  return idf;
}

function scoreParagraph(paragraph: string, queryTerms: string[], idf: Map<string, number>): number {
  const tokens = tokenize(paragraph);
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1);
  }
  let score = 0;
  for (const t of queryTerms) {
    score += (tf.get(t) || 0) * (idf.get(t) || 0);
  }
  return score / Math.max(1, Math.sqrt(tokens.length));
}

function extractHeading(lines: string[], lineIndex: number): string {
  for (let i = lineIndex; i >= 0; i--) {
    const match = lines[i].match(/^#{1,3}\s+(.+)/);
    if (match) {
      return match[1].trim();
    }
  }
  return fileToPage('');
}

async function searchParagraphs(query: string, limit: number): Promise<ScoredParagraph[]> {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return [];
  }

  const allParagraphs: { file: string; text: string; lineStart: number; lines: string[] }[] = [];
  for (const file of await listMarkdownFiles(memoryDir)) {
    const raw = await fs.readFile(file, 'utf8').catch(() => '');
    const lines = raw.split(/\r?\n/);
    let paraLines: string[] = [];
    let paraStart = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '' && paraLines.length > 0) {
        allParagraphs.push({
          file,
          text: paraLines.join(' '),
          lineStart: paraStart,
          lines,
        });
        paraLines = [];
        paraStart = i + 1;
      } else if (line.trim() !== '') {
        if (paraLines.length === 0) paraStart = i;
        paraLines.push(line);
      }
    }
    if (paraLines.length > 0) {
      allParagraphs.push({
        file,
        text: paraLines.join(' '),
        lineStart: paraStart,
        lines,
      });
    }
  }

  const idf = computeIdf(
    allParagraphs.map((p) => p.text),
    queryTerms,
  );

  return allParagraphs
    .map((p) => ({
      file: p.file,
      score: scoreParagraph(p.text, queryTerms, idf),
      snippet: p.text.slice(0, 300) + (p.text.length > 300 ? '…' : ''),
      heading: extractHeading(p.lines, p.lineStart),
    }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Dedup helpers
// ---------------------------------------------------------------------------
function normalizeForDedup(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\u00C0-\uFFFF ]/g, '')
    .trim();
}

function checkExistingTail(existingText: string, newText: string): boolean {
  const lines = existingText
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(-10);
  const tail = normalizeForDedup(lines.join(' '));
  const incoming = normalizeForDedup(newText);
  return tail.includes(incoming) || incoming.includes(tail);
}

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------
const server = new Server(
  { name: 'wiki-memory', version: '2.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'update_wiki',
      description:
        'Create or update a Markdown page in the persistent /memory wiki. ' +
        'Use SEPARATE pages for different topics — never dump unrelated facts into one page. ' +
        'Before writing, use list_wiki to see existing pages. If the topic fits an existing page, ' +
        'append there. If it is a new topic, create a new page (e.g. car, health, finances). ' +
        'Use mode=append to add a new timestamped section with dedup. ' +
        'Use mode=replace to rewrite the entire page. ' +
        'Use mode=upsert to replace a specific section (## heading) or add it at the end.',
      inputSchema: {
        type: 'object',
        required: ['page', 'content'],
        properties: {
          page: {
            type: 'string',
            description:
              'Wiki page name — use short, topic-specific names in English with dashes. ' +
              'Examples: user-profile, car, health, coding-preferences, project-ideas. ' +
              'Create a NEW page for each distinct topic. Do NOT reuse the same page for unrelated facts.',
          },
          content: {
            type: 'string',
            description: 'Markdown content to write',
          },
          mode: {
            type: 'string',
            enum: ['append', 'replace', 'upsert'],
            default: 'append',
            description:
              'append = add timestamped section. replace = full rewrite. ' +
              'upsert = replace section matching ## heading in content (first line), or append',
          },
        },
      },
    },
    {
      name: 'get_wiki',
      description: 'Read one Markdown page from the persistent /memory wiki.',
      inputSchema: {
        type: 'object',
        required: ['page'],
        properties: { page: { type: 'string' } },
      },
    },
    {
      name: 'search_wiki',
      description:
        'Semantic search across all wiki pages. Returns ranked paragraphs with scores ' +
        'and section headings. Best for finding relevant context before starting a task.',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: {
            type: 'number',
            default: 10,
            description: 'Max results (1-20)',
          },
        },
      },
    },
    {
      name: 'list_wiki',
      description: 'List all wiki pages with metadata: file size, line count, last modified.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'delete_wiki',
      description: 'Delete a wiki page permanently.',
      inputSchema: {
        type: 'object',
        required: ['page'],
        properties: { page: { type: 'string' } },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  await ensureMemoryDir();
  const args = (request.params.arguments || {}) as Record<string, unknown>;

  if (request.params.name === 'update_wiki') {
    const page = String(args.page || 'index');
    const content = String(args.content || '').trim();
    const mode = String(args.mode || 'append');
    const file = pageToFile(page);

    if (mode === 'replace') {
      await fs.writeFile(file, content + '\n', 'utf8');
      return {
        content: [
          {
            type: 'text',
            text: `Replaced memory page \`${page}\` (${content.length} chars).`,
          },
        ],
      };
    }

    if (mode === 'upsert') {
      const headingLine = content.split(/\r?\n/)[0];
      const headingMatch = headingLine.match(/^#{2,3}\s+(.+)/);
      const existing = await fs.readFile(file, 'utf8').catch(() => '');
      let updated: string;

      if (headingMatch) {
        const heading = headingMatch[1].trim();
        const lines = existing.split(/\r?\n/);
        const startIdx = lines.findIndex(
          (l) => l.trim().startsWith('## ') && l.trim().includes(heading),
        );
        if (startIdx >= 0) {
          // Find the end of the section (next ## heading or EOF)
          let endIdx = lines.length;
          for (let i = startIdx + 1; i < lines.length; i++) {
            if (/^##\s/.test(lines[i])) {
              endIdx = i;
              break;
            }
          }
          // Replace section content
          const newBody = content.includes('\n')
            ? content.slice(content.indexOf('\n')).trim()
            : content;
          const before = lines.slice(0, startIdx);
          const after = lines.slice(endIdx);
          updated = [...before, '', `## ${heading}`, '', newBody || content, ...after]
            .join('\n')
            .replace(/^\n+/, '');
        } else {
          updated = existing
            ? existing.replace(/\n+$/, '') + '\n\n' + content + '\n'
            : content + '\n';
        }
      } else {
        updated = existing
          ? existing.replace(/\n+$/, '') + '\n\n' + content + '\n'
          : content + '\n';
      }

      await fs.writeFile(file, updated, 'utf8');
      return {
        content: [
          {
            type: 'text',
            text: `Upserted memory page \`${page}\`.`,
          },
        ],
      };
    }

    // mode = append
    const existing = await fs.readFile(file, 'utf8').catch(() => '');
    if (existing && checkExistingTail(existing, content)) {
      return {
        content: [
          {
            type: 'text',
            text: `Skipped duplicate fact in \`${page}\`.`,
          },
        ],
      };
    }

    const now = new Date().toISOString();
    const prefix = existing ? '\n\n' : '';
    await fs.appendFile(file, `${prefix}## ${now}\n\n${content}\n`, 'utf8');
    return {
      content: [
        {
          type: 'text',
          text: `Appended to memory page \`${page}\` (${content.length} chars).`,
        },
      ],
    };
  }

  if (request.params.name === 'get_wiki') {
    const file = pageToFile(String(args.page || 'index'));
    const text = await fs.readFile(file, 'utf8').catch(() => '');
    return {
      content: [
        {
          type: 'text',
          text: text || '(empty or missing wiki page)',
        },
      ],
    };
  }

  if (request.params.name === 'search_wiki') {
    const query = String(args.query || '');
    const limit = Math.min(Math.max(Number(args.limit || 10), 1), 20);
    const results = await searchParagraphs(query, limit);

    if (results.length === 0) {
      return {
        content: [{ type: 'text', text: '(no wiki matches for this query)' }],
      };
    }

    const output = results
      .map((r) => {
        const pageName = fileToPage(r.file);
        const heading = r.heading !== pageName ? ` → ${r.heading}` : '';
        return `**${pageName}**${heading} (score: ${r.score.toFixed(2)})\n` + `> ${r.snippet}`;
      })
      .join('\n\n---\n\n');

    return { content: [{ type: 'text', text: output }] };
  }

  if (request.params.name === 'list_wiki') {
    const files = await listMarkdownFiles(memoryDir);
    if (files.length === 0) {
      return {
        content: [{ type: 'text', text: 'Wiki is empty. No pages yet.' }],
      };
    }

    const rows = await Promise.all(
      files.map(async (f) => {
        const stat = await fs.stat(f).catch(() => ({ size: 0, mtime: new Date(0) }));
        const raw = await fs.readFile(f, 'utf8').catch(() => '');
        const lines = raw.split(/\r?\n/).length;
        return {
          page: fileToPage(f),
          size: stat.size,
          lines,
          mtime: stat.mtime.toISOString().slice(0, 19).replace('T', ' '),
        };
      }),
    );

    rows.sort((a, b) => b.mtime.localeCompare(a.mtime));

    const output = rows
      .map((r) => `- **${r.page}** — ${r.lines} lines, ${r.size} B, updated ${r.mtime}`)
      .join('\n');

    return { content: [{ type: 'text', text: output }] };
  }

  if (request.params.name === 'delete_wiki') {
    const file = pageToFile(String(args.page || 'index'));
    await fs.unlink(file).catch(() => {});
    return {
      content: [
        {
          type: 'text',
          text: `Deleted memory page \`${String(args.page)}\`.`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function main() {
  await server.connect(new StdioServerTransport());
  console.error(`[wiki-memory] MCP server running at ${memoryDir}`);
}

main().catch((error) => {
  console.error('[wiki-memory] Fatal error:', error);
  process.exit(1);
});
