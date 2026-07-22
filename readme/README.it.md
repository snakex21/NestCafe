[← Torna al README](../README.md)

# NestCafe

Assistente IA nativo per Windows — motore SuperCli + interfaccia WebView2.  
Nessun Node.js, nessun Electron, nessun npm, nessun Vite.

---

## Avvio rapido

Fai doppio clic su **`NestCafe.exe`**. Ecco fatto.

Al primo avvio NestCafe rileva la lingua di Windows e configura l'interfaccia. Modificabile in **Impostazioni → Generali → Lingua**.

---

## Versione

| Dove | Come |
|---|---|
| File su disco | File `VERSION` nella root (es. `1.0.5`) |
| Nell'app | **Impostazioni → Informazioni** — versione prodotto, motore, lingua |
| Dopo build | `native-ui/version.json` — sincronizzato da `VERSION` |

---

## Lingue supportate (20)

Interfaccia completamente tradotta. Lingua di sistema rilevata automaticamente.

| Codice | Lingua | Codice | Lingua |
|--------|--------|--------|--------|
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

## Struttura del progetto

```
NestCafe.exe                  launcher (Go + WebView2)
runtime/NestCafe.exe          motore SuperCli
native-ui/                    interfaccia web
  css/app.css                 un solo foglio di stile
  js/                         logica UI
  assets/                     icone, loghi
  modules/                    moduli (es. OCR)
  version.json                versione (sincronizzata)
VERSION                       file versione root
scripts/                      build, test
supercli-data/                dati portabili
readme/                       README multilingue (20 lingue)
```

---

## Funzionalità

### Chat
Scrivi un messaggio, premi Invio. Supporta testo e allegati immagine con anteprima inline. Visualizzatore galleria con frecce.

### Provider e modelli
Aggiungi provider compatibili OpenAI in **Impostazioni → Provider**. Ognuno richiede nome, URL base, chiave API opzionale e modello predefinito.

### Visualizzatore OCR
Modulo **OCR Viewer** (`modules/ocr-viewer/`) elabora immagini e PDF:
- Anteprima stile Word
- Limite pagine PDF (1–100)
- Salva in `supercli-data\exports\ocr\` o cartella personalizzata
- Opzione apertura automatica in **Impostazioni → OCR**

### Impostazioni
- **Generali** — lingua, tema, dettagli diagnostici
- **Provider** — gestisci provider, testa connessione
- **Modelli e contesto** — cerca modelli, imposta limiti
- **Informazioni** — versione, motore, dettagli sistema

### DevTools
Visibile solo con **Impostazioni → Generali → Szczegóły diagnostyczne** attivato. Tasto destro → « Zbadaj element ».

---

## Build

```bat
cd NestCafe
build.bat
```

Sostituisci solo il motore:

```bat
build.bat C:\percorso\supercli-web.exe
```

---

## Verifica

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Dati

Tutti i dati in `supercli-data/`:
- `sessions/` — sessioni chat
- `config/` — chiavi provider, preferenze
- `exports/ocr/` — output OCR

---

## Licenza

Vedi `LICENSE` nella root del progetto.
