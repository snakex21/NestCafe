<p align="center">
  <img src="../apps/desktop/public/assets/logo.png" alt="NestCafe" width="120" height="120">
  <h1 align="center">NestCafe</h1>
  <p align="center">
    <strong>Open-source'owy asystent AI na Twoim pulpicie</strong><br>
    Automatyzuj zadania, zarządzaj plikami, przeglądaj internet, obsługuj pocztę — wszystko z agentami AI działającymi lokalnie na Twoim komputerze.
  </p>
</p>

<p align="center">
  <a href="#szybki-start">Szybki start</a> · 
  <a href="#funkcje">Funkcje</a> · 
  <a href="#obslugiwani-dostawcy">Dostawcy AI</a> · 
  <a href="#architektura">Architektura</a> · 
  <a href="#programowanie">Programowanie</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="Licencja">
  <img src="https://img.shields.io/badge/Node-24%2B-339933" alt="Node.js">
  <img src="https://img.shields.io/badge/pnpm-10.33%2B-F69220" alt="pnpm">
  <img src="https://img.shields.io/badge/Electron-41-47848F" alt="Electron">
</p>

---

## Tłumaczenia

- [English](../README.md)
- [中文 (Chiński)](README.zh-CN.md)
- [Русский (Rosyjski)](README.ru.md)
- [日本語 (Japoński)](README.ja.md)
- [한국어 (Koreański)](README.ko.md)
- [Español (Hiszpański)](README.es.md)
- [العربية (Arabski)](README.ar.md)
- [हिन्दी (Hindi)](README.hi.md)
- [Bahasa Indonesia](README.id.md)
- [தமிழ் (Tamilski)](README.ta.md)
- [Türkçe (Turecki)](README.tr.md)

---

## Czym jest NestCafe?

NestCafe to **lokalny agent AI na pulpit**, który daje modelom AI bezpośredni dostęp do Twojego komputera — za Twoim pozwoleniem. W przeciwieństwie do chatbotów w chmurze, NestCafe potrafi czytać i zapisywać pliki, przeglądać internet, wykonywać polecenia terminala, wysyłać e-maile, zarządzać kalendarzem i wiele więcej.

Pomyśl o tym jak o współpracowniku AI, który faktycznie _robi_ rzeczy, a nie tylko o nich mówi.

## Funkcje

- **Wieloagentowe wykonywanie** — Główny agent koordynuje wyspecjalizowanych pod-agentów do realizacji złożonych, wieloetapowych zadań
- **25+ dostawców AI** — Użyj OpenAI, Anthropic, Google, DeepSeek, Qwen, Perplexity, Ollama, LM Studio lub własnego API
- **Automatyzacja przeglądarki** — Wbudowany Chromium pozwala agentom nawigować po stronach, wypełniać formularze i pobierać dane
- **Dostęp do systemu plików** — Agenci czytają, zapisują i organizują pliki i foldery na Twoim komputerze (za zgodą)
- **Polecenia terminala** — Wykonuj PowerShell, Bash lub dowolne narzędzie CLI z poziomu zadań
- **E-mail i kalendarz** — Połącz Gmail i Kalendarz Google do automatycznej komunikacji i planowania
- **Integracja z WhatsApp** — Wysyłaj wiadomości i odbieraj polecenia przez WhatsApp
- **Harmonogram zadań** — Ustawiaj cykliczne zadania działające według harmonogramu cron
- **Rozszerzalne umiejętności** — Ładuj własną logikę przez umiejętności definiowane w Markdown — ucz swoich agentów nowych sztuczek
- **Tryby piaskownicy** — Uruchamiaj agentów w kontenerach Docker lub natywnie z konfigurowalnymi zabezpieczeniami
- **Jasny/ciemny motyw** — Piękny interfejs z personalizacją wyglądu i motywów
- **Wielojęzyczność** — Interfejs dostępny po angielsku, polsku, chińsku, japońsku i nie tylko

## Obsługiwani dostawcy

NestCafe współpracuje z praktycznie każdym liczącym się dostawcą AI:

| Dostawcy chmurowi     | Lokalni / Self-Hosted      | Enterprise       |
| :-------------------- | :------------------------- | :--------------- |
| OpenAI                | Ollama                     | Azure Foundry    |
| Anthropic             | LM Studio                  | AWS Bedrock      |
| Google (Gemini)       | HuggingFace Local          | Google Vertex AI |
| DeepSeek              | LiteLLM                    | NVIDIA NIM       |
| xAI (Grok)            | Własny (OpenAI-compatible) | Copilot          |
| Groq                  |                            |                  |
| Fireworks             |                            |                  |
| Together AI           |                            |                  |
| OpenRouter            |                            |                  |
| Moonshot              |                            |                  |
| MiniMax               |                            |                  |
| Nebius                |                            |                  |
| Z.AI                  |                            |                  |
| Qwen (Chiny)          |                            |                  |
| Qwen (Międzynarodowy) |                            |                  |
| Perplexity            |                            |                  |
| Xiaomi                |                            |                  |

## Szybki start

**Wymagania:** Node.js 24+, pnpm 10.33+

```bash
# Sklonuj repozytorium
git clone https://github.com/snakex21/NestCafe.git
cd NestCafe

# Zainstaluj zależności
pnpm install

# Uruchom w trybie deweloperskim
pnpm dev
```

Na Windowsie możesz też kliknąć dwukrotnie `start.bat`.

> **Pierwsze uruchomienie?** Zostaniesz poprowadzony przez konfigurację — wybierz dostawcę, dodaj klucz API (lub połącz z modelem lokalnym) i gotowe.

## Architektura

NestCafe używa podzielonej architektury dla bezpieczeństwa i wydajności:

```
┌─────────────────────────────────────────────────────┐
│  apps/web          React UI (Vite + Tailwind)        │
│  apps/desktop      Powłoka Electron (main + preload) │
│  apps/daemon       Wykonywanie zadań w tle           │
│  packages/agent-core    Logika, storage, typy        │
└─────────────────────────────────────────────────────┘
```

- **Web UI** — Samodzielna aplikacja React z zarządzaniem stanem Zustand, komponentami shadcn/ui i animacjami Framer Motion
- **Powłoka Electron** — Cienka nakładka desktopowa, mostek IPC, auto-aktualizator, ikona w zasobniku
- **Daemon** — Długo działający proces w tle, który odpowiada za wykonywanie zadań, uruchamia podprocesy `opencode`
- **Agent Core** — Współdzielona logika biznesowa, migracje bazy danych, narzędzia MCP, integracje dostawców, typy

Klucze API są przechowywane lokalnie z **szyfrowaniem AES-256-GCM**. Nic nie opuszcza Twojego komputera, chyba że to skonfigurujesz.

## Budowanie

```bash
pnpm build            # Zbuduj wszystkie pakiety
pnpm build:desktop    # Spakuj jako aplikację desktopową (Windows/Mac/Linux)
```

## Programowanie

```bash
pnpm typecheck        # Walidacja TypeScript
pnpm lint:eslint      # ESLint
pnpm format:check     # Sprawdzenie Prettier
pnpm -F @nestcafe/web test        # Testy web
pnpm -F @nestcafe/desktop test     # Testy desktop
pnpm -F @nestcafe_ai/agent-core test  # Testy core
```

Zobacz [AGENTS.md](../AGENTS.md) ze szczegółowymi instrukcjami, konwencjami kodu i typowymi przepływami pracy.

## Stack technologiczny

| Warstwa           | Technologia                      |
| :---------------- | :------------------------------- |
| Język             | TypeScript (strict)              |
| Frontend          | React 19, Vite 8, Tailwind CSS 3 |
| Desktop           | Electron 41                      |
| Stan              | Zustand                          |
| Komponenty UI     | shadcn/ui, Radix UI              |
| Animacje          | Framer Motion                    |
| Baza danych       | SQLite (better-sqlite3)          |
| Testy             | Vitest, Playwright               |
| Menadżer pakietów | pnpm (monorepo)                  |
| Środowisko AI     | OpenCode SDK                     |

## Licencja

MIT — zobacz [LICENSE](../LICENSE).
