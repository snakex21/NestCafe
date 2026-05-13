<p align="center">
  <img src="apps/desktop/public/assets/logo.png" alt="NestCafe" width="120" height="120">
  <h1 align="center">NestCafe</h1>
  <p align="center">
    <strong>The open-source AI coworker that lives on your desktop</strong><br>
    Automate tasks, manage files, browse the web, handle email — all with AI agents running locally on your machine.
  </p>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> · 
  <a href="#features">Features</a> · 
  <a href="#supported-providers">AI Providers</a> · 
  <a href="#architecture">Architecture</a> · 
  <a href="#development">Development</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/Node-24%2B-339933" alt="Node.js">
  <img src="https://img.shields.io/badge/pnpm-10.33%2B-F69220" alt="pnpm">
  <img src="https://img.shields.io/badge/Electron-41-47848F" alt="Electron">
</p>

---

## What is NestCafe?

NestCafe is a **local AI desktop agent** that gives AI models direct access to your computer — with your permission. Unlike cloud-only chatbots, NestCafe can read and write files, browse the web, execute shell commands, send emails, manage your calendar, and more.

Think of it as an AI coworker that actually _does_ things, not just talks about them.

## Features

- **Multi-Agent Execution** — A lead agent coordinates specialized sub-agents to tackle complex, multi-step tasks
- **25+ AI Providers** — Use OpenAI, Anthropic, Google, DeepSeek, Qwen, Perplexity, Ollama, LM Studio, or bring your own API
- **Browser Automation** — Built-in Chromium browser lets agents navigate websites, fill forms, and scrape data
- **File System Access** — Agents read, write, and organize files and folders on your computer (with permission)
- **Shell Commands** — Execute PowerShell, Bash, or any CLI tool from within tasks
- **Email & Calendar** — Connect Gmail and Google Calendar for automated communication and scheduling
- **WhatsApp Integration** — Send messages and receive commands via WhatsApp
- **Scheduled Tasks** — Set up recurring jobs that run on a cron schedule
- **Extensible Skills** — Load custom logic via Markdown-defined skills — teach your agents new tricks
- **Sandbox Modes** — Run agents in Docker containers or natively with configurable safety controls
- **Dark/Light Themes** — Beautiful UI with customizable appearance and theming
- **Multi-language** — UI available in English, Polish, Chinese, Japanese, and more

## Supported Providers

NestCafe works with virtually every major AI provider:

| Cloud Providers | Local / Self-Hosted | Enterprise |
|:--|:--|:--|
| OpenAI | Ollama | Azure Foundry |
| Anthropic | LM Studio | AWS Bedrock |
| Google (Gemini) | HuggingFace Local | Google Vertex AI |
| DeepSeek | LiteLLM | NVIDIA NIM |
| xAI (Grok) | Custom OpenAI-compatible | Copilot |
| Groq | | |
| Fireworks | | |
| Together AI | | |
| OpenRouter | | |
| Moonshot | | |
| MiniMax | | |
| Nebius | | |
| Z.AI | | |
| Qwen (China) | | |
| Qwen (International) | | |
| Perplexity | | |
| Xiaomi | | |

## Quick Start

**Prerequisites:** Node.js 24+, pnpm 10.33+

```bash
# Clone the repo
git clone https://github.com/snakex21/NestCafe.git
cd NestCafe

# Install dependencies
pnpm install

# Start development
pnpm dev
```

On Windows, you can also double-click `start.bat`.

> **First run?** You'll be guided through onboarding — pick a provider, add your API key (or connect to a local model), and you're ready to go.

## Architecture

NestCafe uses a split architecture for security and performance:

```
┌─────────────────────────────────────────────────────┐
│  apps/web          React UI (Vite + Tailwind)        │
│  apps/desktop      Electron Shell (main + preload)   │
│  apps/daemon       Background Task Execution         │
│  packages/agent-core    Core Logic, Storage, Types   │
└─────────────────────────────────────────────────────┘
```

- **Web UI** — Standalone React app with Zustand state management, shadcn/ui components, and Framer Motion animations
- **Electron Shell** — Thin desktop wrapper, IPC bridge, auto-updater, system tray
- **Daemon** — Long-lived background process that owns task execution, spawns `opencode` subprocesses
- **Agent Core** — Shared business logic, database migrations, MCP tools, provider integrations, types

API keys are stored locally with **AES-256-GCM encryption**. Nothing leaves your machine unless you configure it to.

## Building

```bash
pnpm build            # Build all workspaces
pnpm build:desktop    # Package as desktop app (Windows/Mac/Linux)
```

## Development

```bash
pnpm typecheck        # TypeScript validation
pnpm lint:eslint      # ESLint
pnpm format:check     # Prettier check
pnpm -F @nestcafe/web test        # Web tests
pnpm -F @nestcafe/desktop test     # Desktop tests
pnpm -F @nestcafe_ai/agent-core test  # Core tests
```

See [AGENTS.md](AGENTS.md) for detailed development instructions, code conventions, and common workflows.

## Tech Stack

| Layer | Technology |
|:--|:--|
| Language | TypeScript (strict) |
| Frontend | React 19, Vite 8, Tailwind CSS 3 |
| Desktop | Electron 41 |
| State | Zustand |
| UI Components | shadcn/ui, Radix UI |
| Animations | Framer Motion |
| Database | SQLite (better-sqlite3) |
| Testing | Vitest, Playwright |
| Package Manager | pnpm (monorepo) |
| AI Runtime | OpenCode SDK |

## Translations

README in other languages: [readme/](readme/)

## License

MIT — see [LICENSE](LICENSE).

---

<p align="center">
  Built with ❤️ by the NestCafe community
</p>
