# PROJECT_SKILL.md — NestCafe Rewrite (Accomplish v2)

## Visual Thesis

Linear-style AI assistant dashboard. Calm, premium, typography-led. Dark-first with light theme support. One accent color (brand blue). Restraint over decoration. Information-dense but readable.

## Architecture (4-layer monorepo)

```
layers/web/          React 19 + Vite + Tailwind + Zustand + React Router 7
layers/desktop/      Electron 41 shell (main + preload)
layers/daemon/       Background Node.js process (task execution, SQLite, scheduler)
packages/core/       Shared business logic, types, storage, providers (ESM)
```

### Layer communication

```
[React UI] ←contextBridge→ [Electron Main] ←JSON-RPC socket→ [Daemon] ←imports→ [core]
```

## File Naming & Organization Rules

### Rule 1: Every file has ONE clear purpose

- Filename describes WHAT the file does, not HOW
- No "utils.ts" dumping ground — split into focused modules
- Max 300 lines per file (enforced by review)

### Rule 2: Directory = feature, not file type

```
✅ GOOD:
  features/task-execution/
    TaskExecutionPage.tsx      # page component
    TaskChat.tsx               # chat area
    TaskPermissions.tsx        # permission requests
    useTaskExecution.ts        # hook
    task-execution.types.ts    # types for this feature

❌ BAD:
  components/
    TaskExecutionPage.tsx
  hooks/
    useTaskExecution.ts
  types/
    task.types.ts
```

### Rule 3: Naming conventions

- **Components**: `PascalCase.tsx` — describes what it renders (`TaskChat.tsx`, `ProviderSettings.tsx`)
- **Hooks**: `use + PascalCase.ts` — describes what it does (`useTaskPolling.ts`, `useDaemonConnection.ts`)
- **Stores**: `camelCase + Store.ts` — `taskStore.ts`, `settingsStore.ts`
- **Types**: `feature + .types.ts` — `task.types.ts`, `provider.types.ts`
- **IPC handlers**: `feature + .ipc.ts` — `task.ipc.ts`, `settings.ipc.ts`
- **Daemon services**: `feature + Service.ts` — `TaskExecutionService.ts`, `StorageService.ts`
- **Core modules**: `feature + .core.ts` — `providers.core.ts`, `storage.core.ts`

### Rule 4: Index files ONLY re-export

- `index.ts` files only re-export, never contain logic
- Barrel exports from feature directories: `export { TaskChat } from './TaskChat.js'`

## Component Rules (from frontend-skill)

### Layout, not cards

- Use sections, columns, dividers, lists, media blocks
- Cards only when the card IS the interaction (e.g., task cards in history)
- No dashboard-card mosaics

### One job per component

- Every component does ONE thing
- If you need "and" in the component name, split it

### Typography hierarchy

- Page title: loudest text on screen
- Section heading: describes what area is
- Supporting text: 1 sentence max explaining scope/behavior
- No filler copy, no marketing language in product UI

### Motion restraint

- One entrance per page
- One scroll-linked effect if needed
- Hover/transition for interactive elements only
- Use Framer Motion when available

## TypeScript Rules

### Strict mode everywhere

- `strict: true` in all tsconfig.json
- No `any` without explicit justification comment
- Prefer `unknown` over `any`
- Use `zod` for runtime validation at boundaries (IPC, RPC, API)

### Types at boundaries

- Every IPC channel has typed request/response
- Every RPC method has typed params/result
- Every store action has typed input/output
- Shared types in `packages/core/src/types/`

### ESM with .js extensions (core package)

- core is `"type": "module"`
- All imports use `.js` extension: `import { foo } from './utils/bar.js'`
- No `require()` in core

## State Management (Zustand)

### One store per domain

```
stores/
  taskStore.ts        # current task, execution state, permissions
  settingsStore.ts    # app settings, provider configs
  workspaceStore.ts   # workspace CRUD
  daemonStore.ts      # daemon connection state
```

### Store rules

- Actions are async functions on the store
- No mutations outside actions
- Subscribe to stores, don't poll
- Store shape matches domain, not UI layout

## IPC/RPC Flow

### Naming: `domain:action`

```
task:start          task:cancel         task:pause
settings:get        settings:set
daemon:ping         daemon:shutdown
permission:respond
workspace:list      workspace:create
```

### Each channel has 3 files

1. Types: `packages/core/src/types/task.types.ts`
2. Handler: `layers/desktop/src/main/ipc/task.ipc.ts`
3. Client: `layers/web/src/lib/ipc/task.client.ts`

## Testing

### What to test

- **Core**: unit tests for all pure functions, storage, providers
- **Daemon**: integration tests for services
- **Desktop**: E2E for critical paths (start task, cancel, settings)
- **Web**: component tests for complex UI, integration for stores

### Test file location

- Next to the file they test: `TaskChat.tsx` → `TaskChat.test.tsx`
- Integration tests: `__tests__/` directory in feature root

## Rejection Checklist

Before merging any PR, verify:

- [ ] No file over 300 lines
- [ ] No `utils.ts` or `helpers.ts` catch-alls
- [ ] No `any` without comment
- [ ] No card-grid without justification
- [ ] Every IPC channel has typed contract
- [ ] Components have ONE job
- [ ] No commented-out code
- [ ] No filler comments ("// This is a button")
- [ ] Core imports use `.js` extensions
- [ ] `pnpm typecheck` passes
- [ ] Feature tests pass

## Build & Dev Commands

```bash
pnpm dev              # Desktop dev mode
pnpm dev:web          # Web UI only
pnpm build            # Full production build
pnpm typecheck        # Type checking
pnpm lint:eslint      # ESLint
pnpm format           # Prettier
pnpm -F @nestcafe/web test        # Web tests
pnpm -F @nestcafe/desktop test    # Desktop tests
pnpm -F @nestcafe/daemon test     # Daemon tests
pnpm -F @nestcafe/core test       # Core tests
```
