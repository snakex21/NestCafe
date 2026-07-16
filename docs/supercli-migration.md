# Migracja NestCafe do SuperCli

## Cel

NestCafe ma pozostać prostą aplikacją biurową, ale korzystać bezpośrednio z
silnika SuperCli. Wersja końcowa nie wymaga Node.js, npm, Electronowego
daemona ani OpenCode.

## Docelowy przepływ

```text
czysty HTML/CSS/JS
        |
        | JSON + SSE na localhost
        v
supercli-web.exe (Go + natywne okno WebView2)
        |
        +-- modele lokalne i chmurowe
        +-- sesje i SQLite
        +-- pamięć i cele
        +-- MCP i skills
        +-- narzędzia plikowe
        +-- Word, Excel i PDF
```

## Działający pionowy przekrój

Polecenie:

```bat
build-native.bat
```

Polecenie tworzy pojedynczy `NestCafe.exe` bez okna konsoli. Interfejs z
`native-ui/` jest osadzony w binarce i nie musi być kopiowany obok programu.
`run-native.bat` automatycznie wykona build, jeśli pliku EXE jeszcze nie ma.
Build osadza również oryginalną, wielorozdzielczą ikonę NestCafe w zasobach
Windows, więc jest ona używana w Eksploratorze, Alt+Tab i na pasku zadań.

Gotowa aplikacja korzysta z:

- przenośnej konfiguracji providerów SuperCli,
- zapamiętanego folderu roboczego,
- interfejsu osadzonego bezpośrednio w `NestCafe.exe`.

Gotowe elementy:

- natywne okno SuperCli/WebView2,
- własny interfejs NestCafe bez frameworka,
- jasny, klasyczny wygląd NestCafe z dawną ikoną, zielonym akcentem i
  centralnym polem zadania,
- sidebar zgodny z dawnym układem: moduły, wyszukiwanie i czyszczenie rozmów,
- lokalne ulubione sesje oraz sześć przykładowych zadań z ikonami integracji,
- widok wykonania z kartami wiadomości, czasem, zwijanym myśleniem i
  rozwijanymi wynikami narzędzi,
- lista i wznawianie sesji,
- strumieniowa rozmowa SSE,
- widoczne wywołania narzędzi i workerów,
- zatrzymanie bieżącej odpowiedzi,
- status silnika i aktywnego modelu.
- wyszukiwalny wybór modeli,
- pełnoekranowy katalog modeli ze wspólną nawigacją ustawień,
- katalog umiejętności ładowany stronami wyłącznie na żądanie użytkownika,
- ustawienia providerów z bezpieczną obsługą kluczy,
- pełnoekranowe ustawienia dostawców z katalogiem gotowych połączeń,
  wyszukiwaniem i przejściem do modeli, pamięci, celu oraz folderu roboczego,
- responsywny układ ustawień: tekstowa nawigacja, elastyczne kolumny oraz
  pełnoekranowe strony Planu i Pamięci zamiast osobnych modalnych paneli,
- pasywna diagnostyka serwerów bez uruchamiania inferencji.
- wybór folderu roboczego przez natywne okno Windows,
- załączanie do ośmiu plików bez kopiowania ich do bazy ani kodowania base64,
- walidacja załączników tym samym sandboxem co narzędzia Word, Excel i PDF.
- aktywny cel widoczny dla modelu w kolejnych rozmowach,
- kroki celu z obowiązkową weryfikacją przed zakończeniem,
- trwała kolejka wiadomości działająca także podczas generowania odpowiedzi,
- podgląd pamięci projektu bez dodatkowego wywołania modelu.

Test kontraktowy:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/test-supercli-bridge.ps1
```

## Kolejność dalszej migracji

1. Harmonogram oraz uruchamianie zadań o wskazanej porze.
2. MCP i integracje potrzebne w pracy biurowej.
3. Import danych użytkownika ze starej bazy NestCafe.
4. Zastąpienie pozostałych ekranów React ich lekkimi odpowiednikami.
5. Usunięcie `layers/daemon`, starego desktopu i zależności OpenCode.

Stare warstwy pozostają dostępne podczas migracji wyłącznie jako referencja
funkcjonalna. Nowe funkcje nie mogą dodawać kolejnych zależności od Node.
