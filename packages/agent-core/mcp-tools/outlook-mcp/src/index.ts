#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { listEmails, readEmail, sendEmail, searchEmails, listFolders } from './powershell.js';

const server = new Server(
  { name: 'outlook-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'outlook_mail',
      description:
        'Read, send, and manage Microsoft Outlook emails on this computer. ' +
        'Supports listing emails from folders, reading specific emails, ' +
        'searching by subject/sender/body, sending emails, and listing folders. ' +
        'Requires Outlook to be installed and configured with at least one account.',
      inputSchema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description:
              "The operation to perform. One of: 'list', 'read', 'send', 'search', 'folders'. " +
              "For 'send': provide --to, --subject, --body, and optionally --cc, --bcc. " +
              "For 'list': optionally --folder (default: Inbox), --count (default: 20). " +
              "For 'read': provide the email index and optionally --folder. " +
              "For 'search': provide --query, optionally --folder and --count. " +
              "For 'folders': no additional arguments.",
          },
          folder: {
            type: 'string',
            description: "Target folder name. Defaults to 'Inbox'.",
          },
          count: {
            type: 'number',
            description: 'Max number of emails to return. Default: 20.',
          },
          index: {
            type: 'number',
            description: 'Email index (1-based) to read.',
          },
          query: {
            type: 'string',
            description: 'Search term for subject, body, or sender.',
          },
          to: {
            type: 'string',
            description: 'Recipient email address for sending.',
          },
          subject: {
            type: 'string',
            description: 'Email subject for sending.',
          },
          body: {
            type: 'string',
            description: 'Email body text for sending.',
          },
          cc: {
            type: 'string',
            description: 'CC recipient for sending.',
          },
          bcc: {
            type: 'string',
            description: 'BCC recipient for sending.',
          },
        },
        required: ['command'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  if (request.params.name !== 'outlook_mail') {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    };
  }

  const args = request.params.arguments as Record<string, unknown>;
  const command = String(args.command ?? '').trim();
  const folder = String(args.folder ?? 'Inbox').trim();
  const count = Number(args.count ?? 20);
  const index = Number(args.index ?? 0);

  if (!command) {
    return { content: [{ type: 'text', text: 'Error: command is required' }], isError: true };
  }

  try {
    if (command === 'list') {
      const emails = listEmails(folder, count);
      return { content: [{ type: 'text', text: JSON.stringify(emails, null, 2) }] };
    }

    if (command === 'read') {
      if (!index) {
        return {
          content: [{ type: 'text', text: 'Error: --index is required for read' }],
          isError: true,
        };
      }
      const email = readEmail(index, folder);
      if (!email) {
        return {
          content: [{ type: 'text', text: `No email found at index ${index}` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text', text: JSON.stringify(email, null, 2) }] };
    }

    if (command === 'search') {
      const query = String(args.query ?? '');
      if (!query) {
        return {
          content: [{ type: 'text', text: 'Error: --query is required for search' }],
          isError: true,
        };
      }
      const emails = searchEmails(query, folder, count);
      return { content: [{ type: 'text', text: JSON.stringify(emails, null, 2) }] };
    }

    if (command === 'send') {
      const to = String(args.to ?? '');
      const subject = String(args.subject ?? '');
      const body = String(args.body ?? '');
      if (!to || !subject || !body) {
        return {
          content: [{ type: 'text', text: 'Error: --to, --subject, and --body are required for send' }],
          isError: true,
        };
      }
      const result = sendEmail(to, subject, body, String(args.cc ?? ''), String(args.bcc ?? ''));
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (command === 'folders') {
      const folders = listFolders();
      return { content: [{ type: 'text', text: JSON.stringify(folders, null, 2) }] };
    }

    return {
      content: [{ type: 'text', text: `Unknown command: ${command}. Use list, read, send, search, or folders.` }],
      isError: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Outlook MCP Server started');
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
