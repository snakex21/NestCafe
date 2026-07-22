[← Powrót do README](../README.md)

# NestCafe

Natywny asystent AI na Windows — silnik SuperCli + interfejs WebView2.  
Bez Node.js, bez Electrona, bez npm, bez Vite.

---

## Szybki start

Kliknij dwukrotnie **`NestCafe.exe`**. To wszystko.

Przy pierwszym uruchomieniu NestCafe odczytuje język systemu Windows i konfiguruje interfejs. Możesz go zmienić w **Ustawienia → Ogólne → Język**.

---

## Wersja

| Gdzie | Jak sprawdzić |
|---|---|
| Plik na dysku | Plik `VERSION` w katalogu głównym (np. `1.0.5`) |
| W aplikacji | **Ustawienia → O programie** — wersja produktu, wersja silnika, język UI |
| Po buildzie | `native-ui/version.json` — synchronizowany z `VERSION` przez `build.bat` |

---

## Obsługiwane języki (20)

Interfejs jest w pełni przetłumaczony. Język systemu jest wykrywany automatycznie.

| Kod | Język | Kod | Język |
|-----|-------|-----|-------|
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
runtime/NestCafe.exe          silnik SuperCli
native-ui/                    interfejs web
  css/app.css                 jeden plik CSS
  js/                         logika UI
  assets/                     ikony, logo
  modules/                    moduły (np. OCR)
  version.json                wersja (synchronizowana z VERSION)
VERSION                       plik wersji
scripts/                      build, testy
supercli-data/                dane przenośne (sesje, config, eksporty)
readme/                       README w 20 językach
```

---

## Funkcje

### Czat
Wpisz wiadomość i naciśnij Enter. Obsługuje tekst i załączniki graficzne. Obrazki są podglądane inline, galeria umożliwia przeglądanie strzałkami.

### Dostawcy i modele
Dodawaj dostawców OpenAI-kompatybilnych w **Ustawienia → Dostawcy**. Każdy wymaga nazwy, URLa bazowego, opcjonalnego klucza API i domyślnego modelu. Włączaj/wyłączaj modele indywidualnie.

### Przeglądarka OCR
Moduł **OCR Viewer** (`modules/ocr-viewer/`) przetwarza obrazy i PDF-y:
- Podgląd jak w Wordzie
- Limit stron PDF (1–100)
- Zapis do `supercli-data\exports\ocr\` lub własnego folderu
- Automatyczne otwieranie folderu w **Ustawienia → OCR**

### Ustawienia
- **Ogólne** — język, motyw, szczegóły diagnostyczne
- **Dostawcy** — dodawanie/edycja/usuwanie dostawców, testowanie połączenia
- **Modele i kontekst** — wyszukiwanie modeli, ustawianie limitów kontekstu
- **O programie** — informacje o wersji, silniku, systemie

### DevTools
Widoczne tylko gdy włączone: **Ustawienia → Ogólne → Szczegóły diagnostyczne**. Wtedy prawym przyciskiem → „Zbadaj element" otwiera DevTools WebView2.

---

## Build

```bat
cd NestCafe
build.bat
```

Podmiana tylko silnika SuperCli:

```bat
build.bat C:\sciezka\do\supercli-web.exe
```

---

## Weryfikacja

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Dane

NestCafe przechowuje dane w `supercli-data/` obok pliku wykonywalnego:
- `sessions/` — sesje czatu
- `config/` — klucze dostawców, preferencje
- `exports/ocr/` — wyniki OCR

Żadne dane nie są zapisywane poza folderem aplikacji.

---

## Licencja

Zobacz `LICENSE` w katalogu głównym projektu.
