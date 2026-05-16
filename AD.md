# Architecture Description: NestCafe

**Version**: 2.0 | **Updated**: 2026-05-16
**Status**: Current

---

## 1. Overview

NestCafe is an AI automation assistant desktop application. The user sends prompts to an AI model, which executes tasks using tools (browser, filesystem, terminal, APIs). The app runs as an Electron desktop app with a background daemon process that owns all AI execution.

---

## 2. Layer Architecture (4-layer monorepo)

```
layers/web/          React 19 + Vite + Tailwind + Zustand + React Router 7
layers/desktop/      Electron 41 shell (main process + preload)
layers/daemon/       Background Node.js process (task execution, SQLite, scheduler)
packages/agent-core/ Shared business logic, types, storage, providers (ESM)
packages/core/       Next-gen core package (providers, factories — future replacement)
```

### Communication flow:
```
[React UI] ←contextBridge→ [Electron Main] ←JSON-RPC socket→ [Daemon] ←imports→ [agent-core]
```

---

## 3. `layers/web/` — React UI

**Stack**: React 19, Vite 8, Tailwind 3, Zustand 5, React Router 7, Radix UI, Framer Motion

### Structure:
```
src/client/
├── components/          Reusable UI components
│   ├── execution/       Task execution (MessageList, ConversationView, streaming)
│   ├── layout/          App shell (Sidebar, SettingsDialog)
│   ├── settings/        Settings panels (providers, workspace, skills, connectors)
│   │   ├── providers/   Per-provider forms (Ollama, Bedrock, Vertex, etc.)
│   │   └── folder-indexing/  Folder scanning config
│   ├── TaskLauncher/    Main prompt input
│   └── ui/              shadcn/ui primitives (button, dialog, etc.)
├── pages/               Route pages (Home, Execution, History)
├── stores/              Zustand stores (taskStore, daemonStore, workspaceStore)
├── hooks/               Custom hooks (useSpeechInput, useCreditsState)
├── lib/                 API client (nestcafe.ts), animations, utilities
│   └── api/             Preload API types
├── i18n/                Translations (en, pl, es, fr, ru, zh-CN, ja, ko, etc.)
└── styles/              Global CSS (Tailwind + custom)
```

### Key patterns:
- **State**: Zustand store with actions split by domain (task-execution-actions, task-update-actions, task-lifecycle-actions)
- **Routing**: React Router 7 with animated page transitions (AnimatePresence)
- **IPC**: All desktop communication through `window.nestcafe` (exposed by preload)

---

## 4. `layers/desktop/` — Electron Shell

### Structure:
```
src/
├── main/
│   ├── index.ts              Entry point (344 lines, delegates to app-startup)
│   ├── app-startup.ts        Startup orchestration (550 lines)
│   ├── app-window.ts         BrowserWindow creation
│   ├── app-shutdown.ts       Graceful shutdown
│   ├── daemon/               Daemon communication
│   │   ├── daemon-connector.ts   Spawn, connect, reconnect (521 lines)
│   │   ├── daemon-lifecycle.ts   Client lifecycle
│   │   └── service-manager.ts    Auto-start service
│   ├── daemon-bootstrap.ts   RPC client setup + notification forwarding
│   ├── ipc/
│   │   ├── handlers/         IPC handlers (~25 domain files)
│   │   │   ├── index.ts          Registration orchestrator
│   │   │   ├── api-key-handlers/ API key management (4 files)
│   │   │   ├── provider-config-handlers/ Per-provider config (8 files)
│   │   │   └── settings-handlers/ Settings sub-handlers (5 files)
│   │   ├── types.ts          IPC types
│   │   └── validation.ts     IPC validation
│   ├── connectors/           OAuth connector flows (GitHub, Jira, Slack, etc.)
│   ├── opencode/             OpenCode CLI resolver + auth
│   ├── providers/            HuggingFace local server management
│   ├── services/             Browser preview, speech-to-text, CDP client
│   ├── store/                Storage, secureStorage, legacy migration
│   ├── updater/              Auto-updater (electron-updater)
│   └── analytics/            Mixpanel analytics
├── preload/
│   ├── index.ts              contextBridge entry (43 lines, assembles API)
│   └── api/                  7 domain modules:
│       ├── task-api.ts        Task operations + events
│       ├── settings-api.ts    App settings
│       ├── provider-api.ts    Provider config
│       ├── workspace-api.ts   Workspaces + knowledge notes
│       ├── integration-api.ts Connectors, Google, WhatsApp, scheduler
│       ├── ai-tools-api.ts    Skills, modules, speech, vision, HuggingFace
│       └── system-api.ts      Daemon, debug, logs, backup, updater
└── resources/                 Bundled Node.js, app icons, installer scripts
```

### Key patterns:
- **Desktop is a thin shell** — all business logic lives in the daemon
- **IPC handlers are RPC proxies** — `ipcMain.handle('task:start', ...) → daemonClient.call('task.start', ...)`
- **Preload exposes typed API** — `window.nestcafe.startTask(config)` → `ipcRenderer.invoke('task:start', config)`
- **Daemon spawn**: detached child process with `windowsHide: true`, communicates via Unix socket / Windows named pipe

---

## 5. `layers/daemon/` — Background Process

### Structure:
```
src/
├── index.ts                  Entry point (daemon lifecycle, service wiring)
├── routes/                   17 RPC route files:
│   ├── index.ts              Registration orchestrator + helpers
│   ├── task-routes.ts        task.*, permission.respond, session.resume
│   ├── scheduler-routes.ts   task.schedule, task.listScheduled
│   ├── settings-routes.ts    settings.*, folderIndexing.*, provider.*
│   ├── workspace-routes.ts   workspace.*, knowledgeNote.*
│   ├── connector-routes.ts   connectors.*
│   ├── secrets-routes.ts     secrets.*
│   ├── gws-routes.ts         gwsAccount.*
│   ├── skills-routes.ts      skills.*
│   ├── favorites-routes.ts   favorites.*
│   ├── system-routes.ts      logs.*, legacy.*
│   ├── memory-routes.ts      memory.*
│   ├── vision-routes.ts      vision.transcribe, ai.complete
│   ├── module-routes.ts      module.*
│   ├── whatsapp-daemon-routes.ts whatsapp.*
│   └── auth-routes.ts        auth.openai.*
├── tasks/                    6 task service files:
│   ├── task-service.ts       Core task orchestration (471 lines)
│   ├── task-callbacks.ts     Callback factory (163 lines)
│   ├── task-config-builder.ts Per-task config building (226 lines)
│   ├── task-service-events.ts Event type declarations
│   └── task-service-helpers.ts Browser/summary helpers
├── storage/                  6 storage wrapper services:
│   ├── storage-service.ts     DB lifecycle (104 lines)
│   ├── settings-service.ts   App/provider settings (325 lines)
│   ├── workspace-service.ts  Workspace + knowledge notes (243 lines)
│   ├── connector-service.ts  MCP connectors (139 lines)
│   ├── secrets-service.ts    API keys (54 lines)
│   └── legacy-import-service.ts Electron-store migration (294 lines)
├── opencode/
│   ├── server-manager.ts     opencode serve process lifecycle (588 lines)
│   └── auth-openai.ts        OpenAI ChatGPT OAuth flow (329 lines)
├── whatsapp/                 10 WhatsApp integration files
├── scheduler-service.ts      Cron scheduler (349 lines)
├── skills-service.ts         Skills manager wrapper (122 lines)
├── google-account-service.ts Google Workspace OAuth (359 lines)
├── whatsapp-service.ts       WhatsApp orchestrator (275 lines)
├── health.ts                 Health check endpoint
├── logger.ts                 Structured logger
├── rate-limiter.ts           In-memory rate limiter
├── http-server-factory.ts    HTTP server factory (WhatsApp send API)
└── cli.ts                    CLI argument parsing
```

### Key patterns:
- **JSON-RPC 2.0** protocol over Unix socket (Windows named pipe)
- **Storage owners** all data in SQLite (better-sqlite3 with WAL mode)
- **Task execution** spawns `opencode serve` subprocess per task via `@opencode-ai/sdk`
- **Event forwarding** daemon → RPC notifications → Electron IPC → React renderer
- **Secure storage** AES-256-GCM encryption for API keys

---

## 6. `packages/agent-core/` — Shared Business Logic

### Structure:
```
src/
├── common/               Public API surface (browser-safe)
│   ├── types/            Domain types (task, provider, settings, workspace, etc.)
│   ├── constants/        Shared constants + model registry
│   ├── schemas/          Zod validation schemas
│   └── utils/            ID generation, JSON helpers
├── storage/              SQLite database + migrations (v001-v035)
├── providers/            AI provider integrations (validation, model fetching)
├── opencode/             OpenCode config generation + CLI resolution
├── daemon/               RPC server/client, IPC transport, PID lock
├── sandbox/              Execution isolation (disabled, native, docker)
├── factories/            Service factories (TaskManager, Storage, Skills)
├── services/             Permission handler, summarizer, speech
├── connectors/           OAuth connector registry + tokens
├── google-accounts/      Google Workspace OAuth manifest
├── modules/              Module system loader
├── browser/              Dev browser server + CDP client
├── mcp-tools/            MCP tool implementations (dev-browser, gmail, calendar, etc.)
└── utils/                Network, fetch, logging, shell, system-path
```

---

## 7. `packages/core/` — Next-Gen Core (v2)

Work-in-progress replacement for agent-core. Currently standalone (not yet integrated).

### Key differences from agent-core:
- **Simplified StorageAPI** (26 methods vs 120)
- **Provider implementations** using native crypto (Vertex JWT, Bedrock SigV4) — no SDK dependencies
- **Feature-folders** (providers grouped by cloud/local/enterprise)

---

## 8. Data Flow

### Task Execution:
```
User types prompt → React UI → IPC → Electron main → Daemon RPC (task.start)
  → TaskService → OpenCodeServerManager → spawn 'opencode serve'
  → SDK messages stream back → RPC notifications → IPC → React UI updates
```

### Settings Change:
```
User changes setting → React UI → IPC → Electron main → Daemon RPC
  → SettingsService → SQLite write → RPC notification (settings.changed)
  → IPC forward → React UI re-render
```

### Provider Connection:
```
User enters API key → React UI → IPC → Daemon RPC (secrets.storeApiKey)
  → SecretsService → SecureStorage (AES-256-GCM) → SQLite
  → Validation call → Provider API (OpenAI, Anthropic, etc.) → status back to UI
```

---

## 9. Key Design Decisions

1. **Daemon owns all state** — Electron main process is a thin proxy
2. **SQLite with WAL mode** — single writer, multiple readers, crash-safe
3. **JSON-RPC 2.0** — language-agnostic, supports notifications (fire-and-forget) and requests (request-response)
4. **AES-256-GCM encryption** for API keys — keys never leave the daemon unencrypted
5. **Feature-folders** over flat files — `tasks/`, `storage/`, `routes/` etc.
6. **Preload API modules** — 7 domain files instead of 1 monolith (1132 → 43 lines)

---

## 10. Refactoring History

| Date | Change |
|------|--------|
| 2026-05-15 | `apps/` → `layers/` rename, created `packages/core/` |
| 2026-05-16 | Daemon: split `daemon-routes.ts` (1878→17 files), grouped `tasks/` + `storage/` |
| 2026-05-16 | Desktop: split `preload/index.ts` (1038→43 lines + 7 modules) |
| 2026-05-16 | Web: split `FolderIndexingSection.tsx` + `nestcafe.ts` |
| 2026-05-16 | Core: implemented provider stubs (Vertex JWT, Bedrock SigV4, HuggingFace Hub) |
| 2026-05-16 | Removed Accomplish AI / NestCafe AI free tier provider |
| 2026-05-16 | Cleaned up: deleted Python venv (4466 files), stale dists, old branding |
