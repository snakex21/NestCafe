# NestCafe

Native Windows AI assistant — SuperCli engine + WebView2 UI.  
No Node.js, no Electron, no npm, no Vite.

---

## Quick start

Double-click **`NestCafe.exe`**. That's it.

The first time you launch NestCafe, it reads your Windows system language and configures the UI accordingly. You can change it anytime in **Settings → General → Language**.

---

## Version

| Where | How |
|---|---|
| File on disk | Root `VERSION` file (e.g. `1.0.5`) |
| In the app | **Settings → About** — shows product version, engine version, UI language, and loaded modules |
| Build artifact | `native-ui/version.json` — synced from `VERSION` by `build.bat` |

---

## Supported languages (20)

The UI is fully translated. System language is auto-detected on first launch.

| Code | Language | Code | Language |
|------|----------|------|----------|
| `pl` | Polski | `cs` | Čeština |
| `en` | English | `sk` | Slovenčina |
| `de` | Deutsch | `uk` | Українська |
| `fr` | Français | `ru` | Русский |
| `es` | Español | `tr` | Türkçe |
| `it` | Italiano | `ja` | 日本語 |
| `pt` | Português | `ko` | 한국어 |
| `nl` | Nederlands | `zh` | 中文 |
| `sv` | Svenska | `fi` | Suomi |
| `no` | Norsk | `da` | Dansk |

Full docs in each language: **[`readme/` folder](readme/)**

---

## Documentation in other languages

| Language | File |
|----------|------|
| [Polski](readme/README.pl.md) | [Deutsch](readme/README.de.md) | [Français](readme/README.fr.md) |
| [Español](readme/README.es.md) | [Italiano](readme/README.it.md) | [Português](readme/README.pt.md) |
| [Nederlands](readme/README.nl.md) | [Svenska](readme/README.sv.md) | [Norsk](readme/README.no.md) |
| [Dansk](readme/README.da.md) | [Suomi](readme/README.fi.md) | [Čeština](readme/README.cs.md) |
| [Slovenčina](readme/README.sk.md) | [Українська](readme/README.uk.md) | [Русский](readme/README.ru.md) |
| [Türkçe](readme/README.tr.md) | [日本語](readme/README.ja.md) | [한국어](readme/README.ko.md) |
| [中文](readme/README.zh.md) | [English](readme/README.en.md) | |

---

## Project structure

```
NestCafe.exe                  launcher (Go + WebView2)
runtime/NestCafe.exe          SuperCli engine
native-ui/                    web UI
  css/app.css                 single stylesheet (historical + redesign-v2)
  js/
    core/namespace.js         window.NestCafe bus
    core/i18n.js              20-language system + detection
    core/version.js           version.json reader
    chat/                     chat panel, images, attachments
    models/                   providers, model list, switching
    settings/                 settings pages (general, providers, models, about)
  assets/                     icons, logos
  modules/                    OCR viewer, etc.
  version.json                synced from VERSION at build
VERSION                       root version file
scripts/
  build.bat                   one-shot build (embeds UI + modules into exe)
  build-native.ps1            PowerShell build script
  smoke-test.ps1              quick health/version/OCR/bridge test
supercli-data/                portable data (sessions, config, exports)
readme/                       multi-language READMEs (20 languages)
```

---

## Features

### Chat
Type a message, press Enter. Supports text and image attachments. Images are previewed inline; the gallery viewer lets you browse all images in a conversation with arrow keys.

### Providers and models
Add OpenAI-compatible providers in **Settings → Providers**. Each provider needs a name, base URL, optional API key, and a default model. Toggle individual models on/off. NestCafe fetches the model list from the provider's `/v1/models` endpoint automatically.

### OCR Viewer
The **OCR Viewer** module (`modules/ocr-viewer/`) processes images and PDFs:
- Word-like preview panel with formatted output
- Configurable page limit for PDFs (1–100)
- Save results to `supercli-data\exports\ocr\` or a custom folder
- Auto-open folder option in **Settings → OCR**

### Settings
- **General** — language, theme, diagnostic details toggle
- **Providers** — add/edit/delete AI providers, test connectivity
- **Models & context** — search models, set context limits per model
- **About** — version info, engine version, system details

### DevTools
Only visible when **Settings → General → Szczegóły diagnostyczne** (Diagnostic details) is enabled. Then right-click → "Zbadaj element" (Inspect element) opens WebView2 DevTools.

---

## Build

```bat
cd NestCafe
build.bat
```

Replace the SuperCli engine only (keep your UI changes):

```bat
build.bat C:\path\to\supercli-web.exe
```

The build script:
1. Copies `VERSION` → `native-ui/version.json`
2. Embeds `native-ui/` and `modules/` into `NestCafe.exe`
3. Outputs a single portable executable

---

## Verify

```powershell
# Quick bridge + runtime test
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe

# Comprehensive smoke test (health, version, i18n, OCR, bridge, readme count)
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Data

NestCafe stores all data in `supercli-data/` next to the executable:
- `sessions/` — chat sessions
- `config/` — provider keys, user preferences
- `exports/ocr/` — OCR output files
- Attachments are staged as copies in `.supercli/attachments/`

No data is written outside the app folder.

---

## Technical details

### JS bus
All UI functionality is exposed through `window.NestCafe.*`. No legacy `window.*NestCafe*` aliases exist. Modules register themselves on the bus in `js/core/namespace.js`.

### CSS
Single file: `native-ui/css/app.css`. The top section is the historical design; the `redesign-v2` layer at the bottom provides the current Linear-style look.

### Modules
The `modules/` directory contains optional components (OCR viewer, etc.) that are embedded into the exe at build time. Each module has a `manifest.json`.

---

## License

See `LICENSE` in the project root.
