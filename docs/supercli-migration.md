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
run-native.bat
```

Launcher uruchamia `supercli-web.exe` z:

- przenośną konfiguracją providerów SuperCli,
- workspace ustawionym na katalog NestCafe,
- interfejsem z `native-ui/`.

Gotowe elementy:

- natywne okno SuperCli/WebView2,
- własny interfejs NestCafe bez frameworka,
- lista i wznawianie sesji,
- strumieniowa rozmowa SSE,
- widoczne wywołania narzędzi i workerów,
- zatrzymanie bieżącej odpowiedzi,
- status silnika i aktywnego modelu.
- wyszukiwalny wybór modeli,
- ustawienia providerów z bezpieczną obsługą kluczy,
- pasywna diagnostyka serwerów bez uruchamiania inferencji.
- wybór folderu roboczego przez natywne okno Windows,
- załączanie do ośmiu plików bez kopiowania ich do bazy ani kodowania base64,
- walidacja załączników tym samym sandboxem co narzędzia Word, Excel i PDF.

Test kontraktowy:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/test-supercli-bridge.ps1
```

## Kolejność dalszej migracji

1. Widoki pracy z dokumentami oraz otwieranie gotowych wyników.
2. Pamięć, cele, harmonogram oraz kolejka zadań.
3. MCP i integracje potrzebne w pracy biurowej.
4. Import danych użytkownika ze starej bazy NestCafe.
5. Zastąpienie pozostałych ekranów React ich lekkimi odpowiednikami.
6. Usunięcie `layers/daemon`, starego desktopu i zależności OpenCode.

Stare warstwy pozostają dostępne podczas migracji wyłącznie jako referencja
funkcjonalna. Nowe funkcje nie mogą dodawać kolejnych zależności od Node.
