#!/usr/bin/env node
import { homedir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const DB_PATH =
  process.env.NESTCAFE_DB_PATH ||
  join(
    homedir(),
    '.nestcafe',
    process.env.NESTCAFE_IS_PACKAGED === '1' ? 'nestcafe.db' : 'nestcafe-dev.db',
  );

function openDatabase(): Database.Database {
  return new Database(DB_PATH, { readonly: true });
}

interface SearchRow {
  snippet: string;
  task_id: string;
  task_prompt: string;
  task_summary: string | null;
  task_created_at: string;
  rank: number;
}

function searchConversations(
  db: Database.Database,
  query: string,
  limit: number,
): Array<{
  taskId: string;
  taskPrompt: string;
  taskSummary?: string;
  taskCreatedAt: string;
  snippet: string;
  rank: number;
}> {
  const rows = db
    .prepare(
      `SELECT
        snippet(task_messages_fts, 0, '<mark>', '</mark>', '…', 40) AS snippet,
        task_messages_fts.task_id,
        tasks.prompt AS task_prompt,
        tasks.summary AS task_summary,
        tasks.created_at AS task_created_at,
        bm25(task_messages_fts, 0.0, 10.0, 5.0) AS rank
      FROM task_messages_fts
      JOIN tasks ON tasks.id = task_messages_fts.task_id
      WHERE task_messages_fts MATCH ?
      ORDER BY rank
      LIMIT ?`,
    )
    .all(query, limit) as SearchRow[];

  return rows.map((row) => ({
    taskId: row.task_id,
    taskPrompt: row.task_prompt,
    taskSummary: row.task_summary || undefined,
    taskCreatedAt: row.task_created_at,
    snippet: row.snippet,
    rank: row.rank,
  }));
}

const server = new Server(
  { name: 'search-conversations', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_conversations',
      description:
        'Search through past conversation history to find relevant discussions. ' +
        'Use this to recall what was discussed in previous chats, check if a topic was covered, ' +
        'or find context from earlier conversations. Returns matching message snippets with task summaries and timestamps.',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'Search query — words or phrases to find in past conversations',
          },
          limit: {
            type: 'number',
            default: 10,
            description: 'Max results (1-20)',
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'search_conversations') {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const args = (request.params.arguments || {}) as Record<string, unknown>;
  const query = String(args.query || '').trim();
  const limit = Math.min(Math.max(Number(args.limit || 10), 1), 20);

  if (!query) {
    return {
      content: [{ type: 'text', text: '(empty query — nothing to search for)' }],
    };
  }

  let db: Database.Database;
  try {
    db = openDatabase();
  } catch (err) {
    return {
      content: [
        {
          type: 'text',
          text: `(cannot open conversation database at ${DB_PATH}: ${err instanceof Error ? err.message : String(err)})`,
        },
      ],
    };
  }

  try {
    const results = searchConversations(db, query, limit);

    if (results.length === 0) {
      return {
        content: [{ type: 'text', text: '(no conversations match this query)' }],
      };
    }

    const output = results
      .map((r) => {
        const date = r.taskCreatedAt.slice(0, 19).replace('T', ' ');
        const summary = r.taskSummary ? ` — ${r.taskSummary}` : '';
        return (
          `**Task** ${date}${summary}\n` +
          `> ${r.snippet}\n` +
          `(rank: ${r.rank.toFixed(2)}, taskId: ${r.taskId})`
        );
      })
      .join('\n\n---\n\n');

    return { content: [{ type: 'text', text: output }] };
  } finally {
    db.close();
  }
});

async function main() {
  await server.connect(new StdioServerTransport());
  console.error(`[search-conversations] MCP server running, DB: ${DB_PATH}`);
}

main().catch((error) => {
  console.error('[search-conversations] Fatal error:', error);
  process.exit(1);
});
