[← Back to README](../README.md)

# NestCafe

Native Windows AI assistant — SuperCli engine + WebView2 UI.  
No Node.js, no Electron, no npm, no Vite.

---

## Quick start

Double-click **`NestCafe.exe`**. That's it.

On first launch NestCafe reads your Windows system language and configures the UI. Change anytime in **Settings → General → Language**.

---

## Version

| Where | How |
|---|---|
| File on disk | Root `VERSION` file (e.g. `1.0.5`) |
| In the app | **Settings → About** — product version, engine version, UI language |
| After build | `native-ui/version.json` — synced from `VERSION` by `build.bat` |

---

## Supported languages (20)

Full UI translation. System language auto-detected on first launch.

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

---

## Project structure

```
NestCafe.exe                  launcher (Go + WebView2)
runtime/NestCafe.exe          SuperCli engine
native-ui/                    web UI
  css/app.css                 single stylesheet
  js/                         UI logic
  assets/                     icons, logos
  modules/                    modules (e.g. OCR)
  version.json                version (synced from VERSION)
VERSION                       root version file
scripts/                      build, tests
supercli-data/                portable data (sessions, config, exports)
readme/                       multi-language READMEs (20 languages)
```

---

## Features

### Chat
Type a message, press Enter. Supports text and image attachments with inline preview. Gallery viewer for browsing images with arrow keys.

### Providers and models
Add OpenAI-compatible providers in **Settings → Providers**. Each needs a name, base URL, optional API key, and default model. Toggle individual models on/off.

### OCR Viewer
**OCR Viewer** module (`modules/ocr-viewer/`) processes images and PDFs:
- Word-like preview panel
- PDF page limit (1–100)
- Save to `supercli-data\exports\ocr\` or custom folder
- Auto-open folder option in **Settings → OCR**

### Settings
- **General** — language, theme, diagnostic details toggle
- **Providers** — add/edit/delete AI providers, test connectivity
- **Models & context** — search models, set context limits
- **About** — version info, engine version, system details

### DevTools
Visible only when **Settings → General → Szczegóły diagnostyczne** is enabled. Then right-click → "Zbadaj element" opens WebView2 DevTools.

---

## Build

```bat
cd NestCafe
build.bat
```

Replace SuperCli engine only:

```bat
build.bat C:\path\to\supercli-web.exe
```

---

## Verify

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Data

All data stored in `supercli-data/` next to the executable:
- `sessions/` — chat sessions
- `config/` — provider keys, preferences
- `exports/ocr/` — OCR output

No data written outside the app folder.

---

## License

See `LICENSE` in the project root.
