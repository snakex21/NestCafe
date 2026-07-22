[← Takaisin README:hen](../README.md)

# NestCafe

Natiivi Windows AI-avustaja — SuperCli-moottori + WebView2-käyttöliittymä.
Ei Node.js:ää, ei Electronia, ei npm:ää, ei Viteä.

---

## Pika-aloitus

Kaksoisnapsauta **`NestCafe.exe`**. Se on kaikki.

Ensimmäisellä käynnistyskerralla NestCafe lukee Windows-järjestelmän kielen ja määrittää käyttöliittymän. Muuta milloin tahansa **Asetukset → Yleinen → Kieli**.

---

## Versio

| Missä | Miten |
|---|---|
| Tiedosto levyllä | Root `VERSION`-tiedosto (esim. `1.0.5`) |
| Sovelluksessa | **Asetukset → Tietoja** — tuoteversio, moottoriversio, käyttöliittymän kieli |
| Käännöksen jälkeen | `native-ui/version.json` — synkronoitu `VERSION`:stä `build.bat`:llä |

---

## Tuetut kielet (20)

Täydellinen käyttöliittymän käännös. Järjestelmän kieli tunnistaan automaattisesti ensimmäisellä käynnistyskerralla.

| Koodi | Kieli | Koodi | Kieli |
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

## Projekti-rakenne

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

## Ominaisuudet

### Chatti
Kirjoita viesti ja paina Enter. Tukee teksti- ja kuvaliitteitä inline-esikatselulla. Galleriakatselin kuvien selaamiseen nuolinäppäimillä.

### Palveluntarjoajat ja mallit
Lisää OpenAI-yhteensopivia palveluntarjoajia **Asetukset → Palveluntarjoajat**. Jokainen tarvitsee nimen, perus-URL:in, valinnaisen API-avaimen ja oletusmallin. Ota yksittäiset mallit käyttöön/pois käytöstä.

### OCR Viewer
**OCR Viewer** -moduuli (`modules/ocr-viewer/`) käsittelee kuvia ja PDF-tiedostoja:
- Word-mainen esikatselupaneeli
- PDF-sivuraja (1–100)
- Tallenna `supercli-data\exports\ocr\` tai mukautettu kansio
- Automaattinen kansioavausvaihtoehto **Asetukset → OCR**

### Asetukset
- **Yleinen** — kieli, teema, diagnostiikka-yksityiskohdat
- **Palveluntarjoajat** — lisää/muokkaa/poista AI-palveluntarjoajia, testaa yhteys
- **Mallit ja konteksti** etsi malleja, aseta konteksirajat
- **Tietoja** — versiotiedot, moottoriversio, järjestelmätiedot

### DevTools
Näkyvä vain kun **Asetukset → Yleinen → Szczegóły diagnostyczne** on käytössä. Oikeanpainikkeella → "Zbadaj element" avaa WebView2 DevTools.

---

## Käännä

```bat
cd NestCafe
build.bat
```

Vaihda vain SuperCli-moottori:

```bat
build.bat C:\path\to\supercli-web.exe
```

---

## Vahvista

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Tiedot

Kaikki tiedot tallennetaan `supercli-data/`:ään suoritettavan tiedoston viereen:
- `sessions/` — chat-istunnot
- `config/` — palveluntarjoajan avaimet, asetukset
- `exports/ocr/` — OCR-tulosteet

Mitään tietoja ei kirjoiteta sovelluskansion ulkopuolelle.

---

## Lisenssi

Katso `LICENSE` projektin juuressa.