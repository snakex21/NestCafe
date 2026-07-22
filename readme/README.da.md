[← Tilbage til README](../README.md)

# NestCafe

Native Windows AI-assistent — SuperCli-motor + WebView2-brugerflade.
Ingen Node.js, ingen Electron, ingen npm, ingen Vite.

---

## Hurtig start

Dobbeltklik på **`NestCafe.exe`**. Det er alt.

Ved første start læser NestCafe dit Windows-systemsprog og konfigurerer brugerfladen. Ændr når som helst under **Indstillinger → Generelt → Sprog**.

---

## Version

| Hvor | Hvordan |
|---|---|
| Fil på disk | Root `VERSION`-fil (f.eks. `1.0.5`) |
| I appen | **Indstillinger → Om** — produktversion, motorversion, brugerfladesprog |
| Efter bygning | `native-ui/version.json` — synkroniseret fra `VERSION` af `build.bat` |

---

## Understøttede sprog (20)

Fuld oversættelse af brugerfladen. Systemsprog automatisk genkendt ved første start.

| Kode | Sprog | Kode | Sprog |
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

## Projektstruktur

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

## Funktioner

### Chat
Skriv en besked og tryk Enter. Understøtter tekst- og billedvedhæftninger med inline forhåndsvisning. Gallerivisning til at gennemse billeder med piletasterne.

### Udbydere og modeller
Tilføj OpenAI-kompatible udbydere under **Indstillinger → Udbydere**. Hver kræver et navn, basis-URL, valgfri API-nøgle og standardmodel. Aktiver/deaktiver enkelte modeller.

### OCR Viewer
**OCR Viewer**-modulet (`modules/ocr-viewer/`) behandler billeder og PDF-dokumenter:
- Word-lignende forhåndspanel
- PDF-sidegrænse (1–100)
- Gem til `supercli-data\exports\ocr\` eller tilpasset mappe
- Automatisk åbningsmulighed for mappe under **Indstillinger → OCR**

### Indstillinger
- **Generelt** — sprog, tema, diagnostiske detaljer
- **Udbydere** — tilføj/rediger/slet AI-udbydere, test forbindelse
- **Modeller og kontekst** — søg modeller, sæt kontekstgrænser
- **Om** — versionsinformation, motorversion, systemdetaljer

### DevTools
Synlig kun når **Indstillinger → Generelt → Szczegóły diagnostyczne** er aktiveret. Højreklik derefter → "Zbadaj element" åbner WebView2 DevTools.

---

## Byg

```bat
cd NestCafe
build.bat
```

Udskift kun SuperCli-motor:

```bat
build.bat C:\path\to\supercli-web.exe
```

---

## Verificer

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Data

Al data gemmes i `supercli-data/` ved siden af den eksekverbare fil:
- `sessions/` — samtale sessioner
- `config/` — udbydernøgler, indstillinger
- `exports/ocr/` — OCR-uddata

Ingen data skrives uden for appmappen.

---

## Licens

Se `LICENSE` i projektroten.