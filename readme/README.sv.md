[← Tillbaka till README](../README.md)

# NestCafe

Native Windows AI-assistent — SuperCli-motor + WebView2-gränssnitt.
Ingen Node.js, ingen Electron, ingen npm, ingen Vite.

---

## Snabbstart

Dubbelklicka på **`NestCafe.exe`**. Det är allt.

Vid första start läser NestCafe ditt Windows system-språk och konfigurerar gränssnittet. Ändra när som helst i **Inställningar → Allmänt → Språk**.

---

## Version

| Var | Hur |
|---|---|
| Fil på disk | Root `VERSION`-fil (t.ex. `1.0.5`) |
| I appen | **Inställningar → Om** — produktversion, motorversion, gränssnittsspråk |
| Efter bygg | `native-ui/version.json` — synkroniserad från `VERSION` av `build.bat` |

---

## Språk (20)

Fullständig översättning av gränssnittet. System-språk identifieras automatiskt vid första start.

| Kod | Språk | Kod | Språk |
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

### Chatt
Skriv ett meddelande och tryck Enter. Stöder text- och bildbilagor med inline förhandsgranskning. Gallerivisor för att bläddra bilder med piltangenterna.

### Leverantörer och modeller
Lägg till OpenAI-kompatibla leverantörer i **Inställningar → Leverantörer**. Varje behöver ett namn, bas-URL, valfilt API-nyckel och standardmodell. Aktivera/avaktivera enskilda modeller.

### OCR Viewer
**OCR Viewer**-modulen (`modules/ocr-viewer/`) bearbetar bilder och PDF-dokument:
- Word-liknande förhandsvisningspanel
- PDF-sidgräns (1–100)
- Spara till `supercli-data\exports\ocr\` eller anpassad mapp
- Alternativ för automatisk öppning av mapp i **Inställningar → OCR**

### Inställningar
- **Allmänt** — språk, tema, diagnostikdetaljerna
- **Leverantörer** — lägg till/redigera/ta bort AI-leverantörer, testa anslutning
- **Modeller och kontext** — sök modeller, ställ in kontextgränser
- **Om** — versionsinformation, motorversion, systemdetaljer

### DevTools
Synlig endast när **Inställningar → Allmänt → Szczegóły diagnostyczne** är aktiverad. Högerklicka sedan → "Zbadaj element" öppnar WebView2 DevTools.

---

## Bygg

```bat
cd NestCafe
build.bat
```

Byt bara SuperCli-motor:

```bat
build.bat C:\path\to\supercli-web.exe
```

---

## Verifiera

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Data

All data lagras i `supercli-data/` bredvid den körbara filen:
- `sessions/` — chattsessioner
- `config/` — leverantörsnycklar, inställningar
- `exports/ocr/` — OCR-utdata

Ingen data skrivs utanför appmappen.

---

## Licens

Se `LICENSE` i projektroten.