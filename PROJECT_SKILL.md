# PROJECT_SKILL.md — NestCafe (native SuperCli)

## Active Windows path

```text
NestCafe.exe                 launcher + embedded native-ui
runtime/NestCafe.exe         replaceable SuperCli WebGUI engine
supercli-data/               portable state (sessions, config, skills)
native-ui/                   NestCafe presentation layer only
native-launcher/             Go launcher sources
modules/                     optional native modules (e.g. ocr-viewer)
```

## Release / updater

- `legacy/node-1.x` preserves the former Node/Electron product line.
- Native releases publish `latest.yml` for the 1.x → 2.x migration path and `native-update.json` for native updates.
- The native launcher checks GitHub Releases on startup, verifies SHA-256, then starts the migration-compatible installer.
- The installer replaces old application files but preserves `supercli-data/`.

## Commands

```bat
build.bat
build.bat C:\path\to\supercli-web.exe
```

- `build.bat` — rebuilds `NestCafe.exe` (launcher + embedded UI + modules).
- `build.bat PATH` — swaps only `runtime/NestCafe.exe` and rebrands it.
- Bridge: `powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe`
- Smoke: `powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1`

## OCR module

- Source: `modules/ocr-viewer/`
- Default export dir (fallback): `supercli-data/exports/ocr`
- Optional `outputFolder` + `maxPdfPages` + `autoOpenFolderAfterSave` in module settings
- Engine APIs: `/api/document/export`, `/api/document/export/save`, `/api/path/open`, `/api/folder/open`

Do not reintroduce Electron, Node monorepo layers, or the old `-tags nestcafe` combined binary.

## native-ui layout

```text
native-ui/
  index.html
  css/
    fonts.css
    app.css              # merged product styles
  assets/
    nestcafe-icon.png
    fonts/
    ai-logos/
    integrations/
  js/
    core/                # namespace, app shell, appearance
    chat/                # messages, tool rows, results
    composer/            # attachments
    models/              # model picker, providers
    plan/                # goals + queue
    settings/            # settings shell + pages
    sidebar/             # sessions search, skills, favorites
    modules/             # module host
```

## UI bus

Modules register through `window.NestCafe` (`js/core/namespace.js`).

Use **only** `NestCafe.*` (legacy `window.*NestCafe*` aliases removed).

Examples:

```js
NestCafe.toast("…");
NestCafe.settings.openPage("folders");
NestCafe.settings.registerPage(id, title, loader);
NestCafe.runPrompt(text, attachments);
NestCafe.chat.createMessage(role, text, conversation, seq);
NestCafe.call("settings.openPage", "general");
```

### Settings pages

| File | Page id |
|---|---|
| `settings.js` | shell + nav + about |
| `settings-pages.js` | page host + workspaces |
| `settings-general.js` | general |
| `settings-folders.js` | folders |
| `settings-memory.js` | memory |
| `settings-models.js` | models |
| `settings-plan.js` | plan |
| `settings-integrations.js` | integrations |
| `settings-scheduler.js` | scheduler |
| `settings-instructions.js` | instructions |

Do not re-register the same page id in two files.

## Rules

1. NestCafe UI is a thin skin. SSE/JSON protocol stays in SuperCli `runtime.js`.
2. No React/Vite/pnpm for the Windows product path.
3. One clear purpose per JS file; settings pages stay under `js/settings/`.
4. Asset paths are relative to `native-ui/` root (`assets/…`, `css/…`, `js/…`).
5. Keep Polish product copy unless explicitly localizing.
6. Prefer editing with UTF-8 tools only (never PowerShell `Set-Content` for source files).

## Visual thesis

Linear-style operator desk: calm surfaces, dense but readable chrome, typography-led hierarchy, one copper accent, almost no ornamental cards. Dark-first with light theme and color accents via `ui.*` settings. Utility copy over marketing. CSS: historical sheets in `app.css` + final `redesign-v2` cascade layer.
