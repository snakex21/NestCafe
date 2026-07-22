[← Späť na README](../README.md)

# NestCafe

Nativný Windows AI asistent — SuperCli engine + WebView2 UI.
Bez Node.js, bez Electronu, bez npm, bez Vite.

---

## Rýchly štart

Dvakrát kliknite na **`NestCafe.exe`**. To je všetko.

Pri prvom spustení NestCafe prečíta jazyk systému Windows a nakonfigúruje UI. Kedykoľvek zmeníte v **Nastavenie → Všeobecné → Jazyk**.

---

## Verzia

| Kde | Ako |
|---|---|
| Súbor na disku | Root `VERSION` súbor (napr. `1.0.5`) |
V aplikácii | **Nastavenie → O programe** — verzia produktu, verzia engine, jazyk UI |
| Po buildu | `native-ui/version.json` — synchronizované z `VERSION` pomocou `build.bat` |

---

## Podporované jazyky (20)

Plný preklad UI. Jazyk systému automaticky rozpoznaný pri prvom spustení.

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

## Štruktúra projektu

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

## Funkcie

### Chat
Napíšte správu a stlačte Enter. Podporuje textové a obrázkové prílohy s náhľadom. Prehliadač galérie na prechádzanie obrázkov pomocou šípiek na klávesnici.

### Poskytovatelia a modely
Pridajte OpenAI-kompatibilných poskytovateľov v **Nastavenie → Poskytovatelia**. Každý potrebuje názov, základnú URL, voliteľný API kľúč a predvolený model. Jednotlivé modely zapnite/vypnite.

### OCR Viewer
Modul **OCR Viewer** (`modules/ocr-viewer/`) spracováva obrázky a PDF dokumenty:
- Panel náhľadu ako vo Wordu
- Limit strán PDF (1–100)
- Uložiť do `supercli-data\exports\ocr\` alebo vlastného priečinka
- automatické otvorenie priečinka v **Nastavenie → OCR**

### Nastavenie
- **Všeobecné** — jazyk, motív, prepínač diagnostických podrobností
- **Poskytovatelia** — pridať/upraviť/vymazať AI poskytovateľov, testovať pripojenie
- **Modely a kontext** — hľadať modely, nastaviť limity kontextu
- **O programe** — informácie o verzii, verzia engine, podrobnosti systému

### DevTools
Viditeľné iba keď **Nastavenie → Všeobecné → Szczegóły diagnostyczne** je povolené. Potom kliknite pravým tlačidlom → "Zbadaj element" otvorí WebView2 DevTools.

---

## Build

```bat
cd NestCafe
build.bat
```

Nahradiť iba SuperCli engine:

```bat
build.bat C:\path\to\supercli-web.exe
```

---

## Overiť

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Údaje

Všetky údaje sú uložené v `supercli-data/` vedľa spustiteľného súboru:
- `sessions/` — chatové relácie
- `config/` — kľúče poskytovateľov, preferencie
- `exports/ocr/` — výstup OCR

Žiadne údaje sa nezapisujú mimo priečinka aplikácie.

---

## Licencia

Pozrite `LICENSE` v koreni projektu.