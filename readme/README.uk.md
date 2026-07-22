[← Назад до README](../README.md)

# NestCafe

Нативний Windows AI-асистент — SuperCli engine + WebView2 UI.
Без Node.js, без Electron, без npm, без Vite.

---

## Швидкий старт

Двічі клацніть на **`NestCafe.exe`**. Це все.

При першому запуску NestCafe зчитує мову системи Windows та налаштовує інтерфейс. Змініть будь-якої миті в **Налаштування → Загальне → Мова**.

---

## Версія

| Де | Як |
|---|---|
| Файл на диску | Root файл `VERSION` (наприклад, `1.0.5`) |
В додатку | **Налаштування → Про програму** — версія продукту, версія engine, мова інтерфейсу |
| Після збірки | `native-ui/version.json` — синхронізовано з `VERSION` за допомогою `build.bat` |

---

## Підтримувані мови (20)

Повний переклад інтерфейсу. Мова системи автоматично визначається при першому запуску.

| Код | Мова | Код | Мова |
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

## Структура проекту

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

## Функції

### Чат
Напишіть повідомлення та натисніть Enter. Підтримує текстові та графічні вкладення з попереднім переглядом. Переглядач галереї для перегляду зображень за допомогою клавіш зі стрілками.

### Провайдери та моделі
Додайте OpenAI-сумісних провайдерів у **Налаштування → Провайдери**. Кожен потребує назви, базової URL-адреси, необов'язкового ключа API та моделі за замовчуванням. Увімкніть/вимкніть окремі моделі.

### OCR Viewer
Модуль **OCR Viewer** (`modules/ocr-viewer/`) обробляє зображення та PDF-документи:
- Панель попереднього перегляду як у Word
- Обмеження сторінок PDF (1–100)
- Зберігати в `supercli-data\exports\ocr\` або користувацьку папку
- Автоматичне відкриття папки в **Налаштування → OCR**

### Налаштування
- **Загальне** — мова, тема, перемикач діагностичних деталей
- **Провайдери** — додати/редагувати/видалити AI провайдерів, перевірити з'єднання
- **Моделі та контекст** — пошук моделей, встановлення лімітів контексту
- **Про програму** — інформація про версію, версія engine, деталі системи

### DevTools
Видимий лише коли **Налаштування → Загальне → Szczegóły diagnostyczne** увімкнено. Потім клацніть правою кнопкою миші → "Zbadaj element" відкриває WebView2 DevTools.

---

## Збірка

```bat
cd NestCafe
build.bat
```

Замінити лише SuperCli engine:

```bat
build.bat C:\path\to\supercli-web.exe
```

---

## Перевірка

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-supercli-bridge.ps1 -Launcher .\NestCafe.exe
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

---

## Дані

Всі дані зберігаються в `supercli-data/` поруч з виконуваним файлом:
- `sessions/` — сесії чату
- `config/` — ключі провайдерів, налаштування
- `exports/ocr/` — вивід OCR

Жодні дані не записуються за межами папки додатку.

---

## Ліцензія

Див. `LICENSE` в корені проекту.