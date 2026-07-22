[← Tilbake til README](../README.md)

# NestCafe

Native Windows AI-assistent — SuperCli-motor + WebView2-grensesnitt.
Ingen Node.js, ingen Electron, ingen npm, ingen Vite.

---

## Hurtigstart

Dobbeltklikk på **`NestCafe.exe`**. Det er alt.

Ved første oppstart leser NestCafe ditt Windows-systemspråk og konfigurerer grensesnittet. Endre når som helst under **Innstillinger → Generelt → Språk**.

---

## Versjon

| Hvor | Hvordan |
|---|---|
| Fil på disk | Root `VERSION`-fil (f.eks. `1.0.5`) |
| I appen | **Innstillinger → Om** — produktversjon, motorversjon, grensesnittsspråk |
| Etter bygg | `native-ui/version.json` — synkronisert fra `VERSION` av `build.bat` |

---

## Støttede språk (20)

Fullstendig oversettelse av grensesnittet. System-språk automatisk gjenkjent ved første oppstart.

| Kode | Språk | Kode | Språk |
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

## Prosjektstruktur

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

## Funksjoner

### Chat
Skriv en melding og trykk Enter. Støtter tekst- og bildevedlegg med forhåndsvisning. Gallerivisning for å bla gjennom bilder med piltastene.

### Leverandører og modeller
Legg til OpenAI-kompatible leverandører under **Innstillinger → Leverandører**. Hver trenger et navn, grunnleggende URL, valgfri API-nøkkel og standardmodell. Aktiver/deaktiver enkelte modeller.

### OCR Viewer
**OCR Viewer**-modulen (`modules/ocr-viewer/`) behandler bilder og PDF-dokumenter:
- Word-lignende forhåndspanel
- PDF-sidbegrensning (1–100)
- Lagre til `supercli-data\exports\ocr\` eller tilpasset mappe
- Alternativ for automatisk åpning av mappe under **Innstillinger → OCR**

### Innstillinger
- **Generelt** — språk, tema, diagnostikkdetaljer
- **Leverandører** — legg til/rediger/slett AI-leverandører, test tilkobling
- **Modeller og kontekst** — søk modeller, sett kontekstgrenser
- **Om** — versjonsinformasjon, motorversjon, systemdetaljer

### DevTools
Synlig bare når **Innstillinger → Generelt → Szczegóły diagnostyczne** er aktivert. Høyreklikk deretter → "Zbadaj element" åpner WebView2 DevTools.

---

## Bygg

```bat
cd NestCafe
build.bat
```

Erstatt bare SuperCli-motor:

```bat
build.bat C:\path\to\supercli-web.exe
```

---

## Verifiser

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Data

All data lagres i `supercli-data/` ved siden av den kjørbare filen:
- `sessions/` — samtaleøkter
- `config/` — leverandørnøkler, innstillinger
- `exports/ocr/` — OCR-utdata

Ingen data skrives utenfor appmappen.

---

## Lisens

Se `LICENSE` i prosjektroten.