# NestCafe - AI Desktop Assistant

NestCafe is a local AI desktop agent that automates tasks on your computer — file management, document creation, browser automation, and more. Runs locally with your own API keys or local models via Ollama / LM Studio.

Forked from [nestcafe](https://github.com/accomplish-ai/accomplish). MIT licensed.

## Quick Start

```bash
# Prerequisites: Node.js 24+, pnpm 10+
pnpm install
pnpm dev
```

Or on Windows, double-click `start.bat`.

## Building

```bash
pnpm build          # Build all workspaces
pnpm build:web      # Web UI only
pnpm build:desktop  # Desktop app (builds web first)
```

## Project Structure

| Directory | Description |
|-----------|-------------|
| `apps/web` | React UI (Vite + Tailwind + Zustand) |
| `apps/desktop` | Electron shell |
| `apps/daemon` | Background task execution daemon |
| `packages/agent-core` | Core business logic, types, storage |

## Development

```bash
pnpm typecheck     # TypeScript validation
pnpm lint:eslint   # ESLint
pnpm format:check  # Prettier check
pnpm -F @nestcafe/web test   # Web tests
pnpm -F @nestcafe/desktop test  # Desktop tests
```

See [AGENTS.md](AGENTS.md) for detailed development instructions.

## Translations

README in other languages: [readme/](readme/)

## License

MIT — see [LICENSE](LICENSE).
