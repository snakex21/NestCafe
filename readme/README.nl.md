[← Terug naar README](../README.md)

# NestCafe

Native Windows AI-assistent — SuperCli-engine + WebView2-UI.
Geen Node.js, geen Electron, geen npm, geen Vite.

---

## Snel starten

Dubbelklik op **`NestCafe.exe`**. Dat is alles.

Bij eerste lancering leest NestCafe de systeemtaal van Windows en configureert de UI. Wanneer dan ook wijzigen via **Instellingen → Algemeen → Taal**.

---

## Versie

| Waar | Hoe |
|---|---|
| Bestand op schijf | Root `VERSION`-bestand (bijv. `1.0.5`) |
| In de app | **Instellingen → Over** — productversie, engineversie, UI-taal |
| Na build | `native-ui/version.json` — gesynchroniseerd vanuit `VERSION` door `build.bat` |

---

## Ondersteunde talen (20)

Volledige UI-vertaling. Systeemtaal automatisch gedetecteerd bij eerste lancering.

| Code | Taal | Code | Taal |
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

## Projectstructuur

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

## Functies

### Chat
Typ een bericht en druk op Enter. Ondersteunt tekst- en afbeeldingsbijlagen met inline-voorbeeld. Galerieviewer om afbeeldingen te bladeren met pijltjestoetsen.

### Aanbieders en modellen
Voeg OpenAI-compatibele aanbieders toe via **Instellingen → Aanbieders**. Elke aanbieding heeft een naam, basis-URL, optionele API-sleutel en standaardmodel. Schakel individuele modellen in/uit.

### OCR Viewer
De **OCR Viewer**-module (`modules/ocr-viewer/`) verwerkt afbeeldingen en PDF's:
- Word-achtig voorbeeldpaneel
- PDF-paginalimiet (1–100)
- Opslaan in `supercli-data\exports\ocr\` of aangepaste map
- Automatische mapoptie in **Instellingen → OCR**

### Instellingen
- **Algemeen** — taal, thema, diagnostiche-detailtoggle
- **Aanbieders** — AI-aanbieders toevoegen/bewerken/verwijderen, connectiviteit testen
- **Modellen en context** — modellen zoeken, contextlimieten instellen
- **Over** — versie-info, engineversie, systeemdetails

### DevTools
Alleen zichtbaar wanneer **Instellingen → Algemeen → Szczegóły diagnostyczne** is ingeschakeld. Klik dan met de rechtermuisknop → "Zbadaj element" opent WebView2 DevTools.

---

## Build

```bat
cd NestCafe
build.bat
```

Alleen SuperCli-engine vervangen:

```bat
build.bat C:\path\to\supercli-web.exe
```

---

## Verifiëren

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Gegevens

Alle gegevens worden opgeslagen in `supercli-data/` naast het uitvoerbare bestand:
- `sessions/` chatsessies
- `config/` aanbiederssleutels, voorkeuren
- `exports/ocr/` OCR-uitvoer

Er worden geen gegevens buiten de app-map geschreven.

---

## Licentie

Zie `LICENSE` in de projectroot.