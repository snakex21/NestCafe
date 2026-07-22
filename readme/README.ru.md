[← Назад к README](../README.md)

# NestCafe

Нативный Windows AI-ассистент — SuperCli engine + WebView2 UI.
Без Node.js, без Electron, без npm, без Vite.

---

## Быстрый старт

Дважды щёлкните на **`NestCafe.exe`**. Это всё.

При первом запуске NestCafe считывает язык системы Windows и настраивает интерфейс. Измените в любое время в **Настройки → Общие → Язык**.

---

## Версия

| Где | Как |
|---|---|
| Файл на диске | Root файл `VERSION` (например, `1.0.5`) |
В приложении | **Настройки → О программе** — версия продукта, версия engine, язык интерфейса |
| После сборки | `native-ui/version.json` — синхронизировано из `VERSION` с помощью `build.bat` |

---

## Поддерживаемые языки (20)

Полный перевод интерфейса. Язык системы автоматически определяется при первом запуске.

| Код | Язык | Код | Язык |
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

## Структура проекта

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

## Функции

### Чат
Напишите сообщение и нажмите Enter. Поддерживает текстовые и графические вложения с предварительным просмотром. Просмотрщик галереи для просмотра изображений с помощью клавиш со стрелками.

### Провайдеры и модели
Добавьте OpenAI-совместимых провайдеров в **Настройки → Провайдеры**. Каждый требует имени, базового URL, необязательного ключа API и модели по умолчанию. Включите/выключите отдельные модели.

### OCR Viewer
Модуль **OCR Viewer** (`modules/ocr-viewer/`) обрабатывает изображения и PDF-документы:
- Панель предварительного просмотра как в Word
- Ограничение страниц PDF (1–100)
- Сохранять в `supercli-data\exports\ocr\` или пользовательскую папку
- Автоматическое открытие папки в **Настройки → OCR**

### Настройки
- **Общие** — язык, тема, переключатель диагностических деталей
- **Провайдеры** — добавить/редактировать/удалить AI провайдеров, проверить соединение
- **Модели и контекст** — поиск моделей, установка лимитов контекста
- **О программе** — информация о версии, версия engine, детали системы

### DevTools
Видим только когда **Настройки → Общие → Szczegóły diagnostyczne** включено. Затем щёлкните правой кнопкой мыши → "Zbadaj element" открывает WebView2 DevTools.

---

## Сборка

```bat
cd NestCafe
build.bat
```

Заменить только SuperCli engine:

```bat
build.bat C:\path\to\supercli-web.exe
```

---

## Проверка

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Данные

Все данные хранятся в `supercli-data/` рядом с исполняемым файлом:
- `sessions/` — сессии чата
- `config/` — ключи провайдеров, настройки
- `exports/ocr/` — вывод OCR

Никакие данные не записываются за пределы папки приложения.

---

## Лицензия

Смотрите `LICENSE` в корне проекта.