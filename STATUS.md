# NestCafe Rewrite — Status (2026-05-15)

## Co zrobione

### 1. PROJECT_SKILL.md ✅

- Konstytucja projektu: zasady nazewnictwa, struktury, komponentów
- Plik: `C:\Users\ASRock\Desktop\accomplish-main\PROJECT_SKILL.md`

### 2. apps/ → layers/ rename ✅

- `apps/web` → `layers/web`
- `apps/desktop` → `layers/desktop`
- `apps/daemon` → `layers/daemon`
- pnpm-workspace.yaml zaktualizowany
- Skrypty (sync-version, ensure-daemon-built, check-native-abi) zaktualizowane
- Desktop package.json extraResources zaktualizowane

### 3. packages/core/ — NOWY PAKIET ✅ (typecheck przechodzi!)

```
packages/core/src/
├── index.ts                 Główny eksport publiczny (~170 linii)
├── common.ts                Browser-safe eksport (tylko typy + stałe)
│
├── types/ (18 plików)       Każdy plik = jedna domena
│   ├── task.types.ts            Task, TaskConfig, TaskMessage...
│   ├── provider.types.ts        ProviderType, DEFAULT_PROVIDERS (30 providerów)
│   ├── permission.types.ts      FileOperation, PermissionRequest...
│   ├── settings.types.ts        SettingsSnapshot, PROVIDER_META...
│   ├── daemon.types.ts          JSON-RPC 2.0, DaemonMethodMap...
│   └── ... (auth, opencode, workspace, skill, connector, sandbox, itd.)
│
├── api/                     Interfejsy publiczne (TaskManagerAPI, StorageAPI...)
├── constants/               Timeouty, limity, porty
├── utils/                   ID generation, JSON helpers
│
├── storage/                 SQLite + szyfrowanie
│   ├── database.ts              init, WAL, reset
│   ├── secure-storage.ts        AES-256-GCM
│   └── migrations/              runner + v001-initial-schema
│
├── providers/               Pogrupowane po kategoriach
│   ├── models.ts                Wspólne funkcje lookup
│   ├── validation.ts            Walidacja API key
│   ├── aws/                     Bedrock (3 pliki)
│   ├── google/                  Vertex AI (2 pliki)
│   ├── azure/                   Foundry (2 pliki)
│   ├── local/                   Ollama, LM Studio, HuggingFace (5 plików)
│   ├── cloud/                   OpenRouter, LiteLLM, NIM (3 pliki)
│   └── copilot/                 GitHub Copilot OAuth (1 plik)
│
├── factories/               Factory stubs (6 funkcji)
├── daemon/                  RPC server + PID lock
├── opencode/                Config generation + CLI
└── sandbox/                 Disabled, Native, Docker
```

## Co zostało do zrobienia

### 4. layers/daemon/ — przepisać ❌ (w trakcie analizy)

Obecnie: 26 płaskich plików w `layers/daemon/src/`
Planowana struktura:

```
layers/daemon/src/
├── index.ts              # Entry point — już przeczytany (403 linie)
├── rpc/
│   ├── server.ts         # RPC server (z daemon-routes.ts)
│   └── routes/           # Route handlers per domain
├── services/
│   ├── task-service.ts
│   ├── storage-service.ts
│   ├── settings-service.ts
│   ├── secrets-service.ts
│   ├── workspace-service.ts
│   ├── skills-service.ts
│   ├── connector-service.ts
│   ├── scheduler-service.ts
│   ├── whatsapp-service.ts
│   └── google-account-service.ts
├── opencode/
│   └── server-manager.ts
├── task/
│   ├── callbacks.ts
│   ├── config-builder.ts
│   ├── event-forwarding.ts
│   └── helpers.ts
├── health.ts
├── logger.ts
├── rate-limiter.ts
└── legacy-import.ts
```

### 5. layers/desktop/ — przepisać ❌

Electron shell z czystą strukturą IPC handlerów.

### 6. layers/web/ — przepisać ❌

React UI z czystą strukturą komponentów.

### 7. W core są stuby do dokończenia

- Factories zwracają błędy (trzeba zaimplementować)
- Niektóre providery (Vertex, Bedrock) są stubami
- Trzeba podpiąć prawdziwe SDK

---

## Jak kontynuować

1. Wróć do tego pliku: `C:\Users\ASRock\Desktop\accomplish-main\STATUS.md`
2. Powiedz: "kontynuuj od daemona" albo "dokończ core stuby"
3. PROJECT_SKILL.md zawiera wszystkie zasady nazewnictwa i struktury
