[← Zpět na README](../README.md)

# NestCafe

Nativní Windows AI asistent — SuperCli engine + WebView2 UI.
Bez Node.js, bez Electronu, bez npm, bez Vite.

---

## Rychlý start

Dvakrát klikněte na **`NestCafe.exe`**. To je vše.

Při prvním spuštění NestCafe přečte jazyk systému Windows a nakonfiguruje UI. Kdykoli změníte v **Nastavení → Obecné → Jazyk**.

---

## Verze

| Kde | Jak |
|---|---|
| Soubor na disku | Root `VERSION` soubor (např. `1.0.5`) |
V aplikaci | **Nastavení → O programu** — verze produktu, verze engine, jazyk UI |
| Po buildu | `native-ui/version.json` — synchronizováno z `VERSION` pomocí `build.bat` |

---

## Podporované jazyky (20)

Plný překlad UI. Jazyk systému automaticky rozpoznán při prvním spuštění.

| Kód | Jazyk | Kód | Jazyk |
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

## Struktura projektu

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

## Funkce

### Chat
Napište zprávu a stiskněte Enter. Podporuje textové a obrázkové přílohy s náhledem. Prohlížeč galerie pro procházení obrázků pomocí šipkek na klávesnici.

### Poskytovatelé a modely
Přidejte OpenAI-kompatibilní poskytovatele v **Nastavení → Poskytovatelé**. Každý potřebuje název, základní URL, volitelný API klíč a výchozí model. Jednotlivé modely zapněte/vypněte.

### OCR Viewer
Modul **OCR Viewer** (`modules/ocr-viewer/`) zpracovává obrázky a PDF dokumenty:
- Panel náhledu jako ve Wordu
- Limit stran PDF (1–100)
- Uložit do `supercli-data\exports\ocr\` nebo vlastní složky
- automatické otevření složky v **Nastavení → OCR**

### Nastavení
- **Obecné** — jazyk, motiv, přepínač diagnostických podrobností
- **Poskytovatelé** — přidat/upravit/smazat AI poskytovatele, testovat připojení
- **Modely a kontext** — hledat modely, nastavit limity kontextu
- **O programu** — informace o verzi, verze engine, podrobnosti systému

### DevTools
Viditelné pouze když **Nastavení → Obecné → Szczegóły diagnostyczne** je povoleno. Poté klikněte pravým tlačítkem → "Zbadaj element" otevře WebView2 DevTools.

---

## Build

```bat
cd NestCafe
build.bat
```

Nahradit pouze SuperCli engine:

```bat
build.bat C:\path\to\supercli-web.exe
```

---

## Ověřit

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Data

Všechna data jsou uložena v `supercli-data/` vedle spustitelného souboru:
- `sessions/` — chatové relace
- `config/` — klíče poskytovatelů, předvolby
- `exports/ocr/` — výstup OCR

Žádná data nejsou zapisována mimo složku aplikace.

---

## Licence

Viz `LICENSE` v kořeni projektu.