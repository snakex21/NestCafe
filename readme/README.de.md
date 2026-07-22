[← Zurück zum README](../README.md)

# NestCafe

Native Windows KI-Assistent — SuperCli-Engine + WebView2-UI.  
Kein Node.js, kein Electron, kein npm, kein Vite.

---

## Schnellstart

Doppelklick auf **`NestCafe.exe`**. Das wars.

Beim ersten Start erkennt NestCafe die Windows-Sprache und konfiguriert die UI. Änderbar unter **Einstellungen → Allgemein → Sprache**.

---

## Version

| Ort | Wie |
|---|---|
| Datei auf Disk | `VERSION`-Datei im Stammverzeichnis (z.B. `1.0.5`) |
| In der App | **Einstellungen → Über** — Produktversion, Engine-Version, UI-Sprache |
| Nach Build | `native-ui/version.json` — synchronisiert mit `VERSION` |

---

## Unterstützte Sprachen (20)

Vollständige UI-Übersetzung. Systemsprache wird automatisch erkannt.

| Code | Sprache | Code | Sprache |
|------|---------|------|---------|
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
NestCafe.exe                  Launcher (Go + WebView2)
runtime/NestCafe.exe          SuperCli-Engine
native-ui/                    Web-UI
  css/app.css                 eine CSS-Datei
  js/                         UI-Logik
  assets/                     Icons, Logos
  modules/                    Module (z.B. OCR)
  version.json                Version (synchronisiert)
VERSION                       Stamm-Version
scripts/                      Build, Tests
supercli-data/                Tragbare Daten
readme/                       Mehrsprachige READMEs (20 Sprachen)
```

---

## Funktionen

### Chat
Nachricht eingeben, Enter drücken. Unterstützt Text und Bildanhänge mit Inline-Vorschau. Galerie-Viewer zum Durchblättern mit Pfeiltasten.

### Anbieter und Modelle
OpenAI-kompatible Anbieter unter **Einstellungen → Anbieter** hinzufügen. Je Name, Base-URL, optionaler API-Key und Standardmodell. Modelle einzeln aktivieren/deaktivieren.

### OCR-Viewer
**OCR-Viewer**-Modul (`modules/ocr-viewer/`) verarbeitet Bilder und PDFs:
- Word-ähnliche Vorschau
- PDF-Seitenlimit (1–100)
- Speicherung in `supercli-data\exports\ocr\` oder eigenem Ordner
- Auto-Open-Option in **Einstellungen → OCR**

### Einstellungen
- **Allgemein** — Sprache, Design, Diagnostik
- **Anbieter** — Anbieter verwalten, Verbindung testen
- **Modelle & Kontext** — Modelle suchen, Kontextlimits setzen
- **Über** — Versionsinfo, Engine-Version, Systemdetails

### DevTools
Nur sichtbar wenn **Einstellungen → Allgemein → Szczegóły diagnostyczne** aktiviert ist. Rechtsklick → „Zbadaj element".

---

## Build

```bat
cd NestCafe
build.bat
```

Nur SuperCli-Engine ersetzen:

```bat
build.bat C:\Pfad\zu\supercli-web.exe
```

---

## Überprüfung

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Daten

Alle Daten in `supercli-data/` neben der ausführbaren Datei:
- `sessions/` — Chat-Sitzungen
- `config/` — Anbieter-Schlüssel, Einstellungen
- `exports/ocr/` — OCR-Ausgaben

---

## Lizenz

Siehe `LICENSE` im Projektstamm.
