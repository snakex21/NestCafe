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
- `dist.bat` — clean portable package in `dist\NestCafe-portable-<VERSION>\` + zip.
- `runtime/NestCafe.exe` is a build output and is **not tracked**. `-BuildEngine` builds it from SuperCli sources
  (`-EngineRoot`, default `..\SuperCli`); CI checks out the SuperCli tag pinned in `SUPERCLI_REF`.
- UI unit tests (dev-only Node, not part of the product): `node --test native-ui/tests/*.test.cjs`
- Bridge: `powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe`
- Smoke: `powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1`

## OCR / document module

- Source: `modules/ocr-viewer/`
- Default export dir (fallback): `supercli-data/exports/ocr`
- Optional `outputFolder` + `maxPdfPages` + `autoOpenFolderAfterSave` in module settings
- PDF OCR renders one full-resolution page at a time; only compact preview thumbnails stay in memory.
- DOCX / MD / TXT can be imported and converted locally without a model call.
- OCR history sources live under `supercli-data/module-sources` and are removed when no history entry references them.
- Engine APIs: `/api/document/import`, `/api/document/export`, `/api/document/export/save`, `/api/attachment/preview`, `/api/path/open`, `/api/folder/open`

## Thunderbird AI Bridge

- First-class NestCafe status UI: **Settings → Integrations**.
- Bundled add-on: `integrations/Thunderbird-AI-Bridge.xpi` (vendored bridge 0.10.0, SHA-256 pinned in `integrations/Thunderbird-AI-Bridge.xpi.sha256`; the build fails on a mismatch).
- `build-native.ps1 -RefreshBridge` copies `../Thunderbird-AI-Bridge/dist/thunderbird-ai-bridge.xpi` and re-pins the hash; otherwise builds use the vendored XPI.
- Bridge 0.9.33+ protocol (CORS + long-poll host, `include_attachments`, Message-ID dedupe fields, `verify_move`, `repair_folder`, ambiguous-account errors) needs SuperCli >= 1.0.20.
- Bridge 0.10.0 (protocol 2: pairing, mutual HMAC auth, signed messages) needs SuperCli >= 1.0.25 and is refused by older engines; 0.9.x extensions are refused by 1.0.25.
- Pairing UI: Settings -> Integrations -> Thunderbird -> "Paruj z Thunderbirdem" shows a one-time code; the user enters it in Thunderbird (Add-ons -> Thunderbird AI Bridge -> Options). "Rozparuj" forgets the secret.
- Host endpoint: `127.0.0.1:47831`; the SuperCli `thunderbird_mail` tool owns the local bridge protocol.
- NestCafe APIs: `/api/integrations/thunderbird` (with a `bridge` status object), `/api/integrations/thunderbird/xpi`, and local-only POST `/api/integrations/thunderbird/pair`, `/pair/cancel`, `/unpair`.
- Extension source: `https://github.com/snakex21/Thunderbird-AI-Bridge`.

## Host approval prompts (SuperCli >= 1.0.23)

- Risky tool operations reach the UI as `question` events with `confirmation: true` and an `approval` card.
- `js/chat/execution.js` renders them with `showApprovalQuestion` (not the generic ask_user form); buttons send the
  server's own `deny_label` / `approve_label` / `similar_label`. Styles: `css/components/approvals.css`.
- Approval cards are tracked apart from ask_user forms and never replace or join an open batch. Tests: `native-ui/tests/approvals.test.cjs`.
- allow-all (forced by the NestCafe profile) does not approve gated actions in the GUI; the user is always asked.

Do not reintroduce Electron, Node monorepo layers, or the old `-tags nestcafe` combined binary.

## native-ui layout

```text
native-ui/
  index.html
  css/
    fonts.css
    app.css              # small import entrypoint
    legacy.css           # frozen historical cascade
    components/          # focused new component styles
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
