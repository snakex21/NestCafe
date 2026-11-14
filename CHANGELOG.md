# Changelog

## 2.2.0

**Requires and bundles SuperCli 1.0.26** (`SUPERCLI_REF` = `v1.0.26`). The bundled
Thunderbird AI Bridge stays 0.10.0 (same pinned XPI SHA-256
`1821574b39a2fec111bcf1f13da29dcb102edbb9f08e1dc56433ec09423512c2`).

### NestCafe in 27 languages

The whole interface is translated: chat, composer, approval and question cards, model
picker, providers, plan, every settings page, the Thunderbird pairing card and the OCR
module. Languages (the same set as SuperCli): English, Български, Čeština, Dansk,
Deutsch, Ελληνικά, Español, Eesti, Suomi, Français, Hrvatski, Magyar, Italiano,
Lietuvių, Latviešu, Norsk bokmål, Nederlands, Polski, Português (Brasil), Română,
Русский, Slovenčina, Slovenščina, Srpski (latinica), Svenska, Türkçe, Українська.

- Language order: your saved choice, then the Windows/browser language, then English.
  Change it in **Settings → General → Language**; the window reloads in the new language
  and the engine (agent system prompts, approval cards) follows the same setting.
- Catalogs in `native-ui/locales/<code>.json`: Polish is the source, English the fallback,
  messages use named parameters and CLDR plural forms (`Intl.PluralRules`), so "1 plik /
  2 pliki / 5 plików" and "1 file / 2 files" are both right.
- Tests check that every catalog has every key, the same placeholders and the plural
  forms its language needs, that every key used in the code exists, and that no Polish
  text is left hardcoded in the UI.

### Refreshed interface

- Contrast meets WCAG AA (4.5:1) for text in the light, dark, OLED and warm themes; a
  headless audit of the main screens finds no text below 4.5:1 and none below 12 px.
- One type scale (12/13/14/16/20/28 px), primary buttons with a proper accent fill and
  readable text on it, status badges tinted for both themes.
- First run without a model: the start screen offers **Połącz model / Connect a model**.
- Model picker opens immediately with a loading state; the empty state has an
  **Add provider** button; the model button no longer truncates to "Wybierz m…".
- Providers: correct names (OpenAI, DeepSeek, OpenRouter, xAI…), translated descriptions,
  an empty state with the most common choices.
- Approval card: an expired request stays in the conversation as "expired, nothing was
  done" instead of disappearing; reversibility badges are no longer in the button colour;
  Esc = deny; larger text. An interrupted multi-question answer marks the unsent answers.
- Settings: labelled controls for screen readers, "Saved" shown next to the changed
  control, the same close button on every page.
- Thunderbird card: numbered install and pairing steps, GitHub as a link, buttons the same
  size as the rest of the settings; readable empty states for MCP servers.
- The toast no longer covers the composer.

### From SuperCli 1.0.26

- One runtime for the desktop window, the terminal and batch runs.
- Contrast and design tokens in the shared UI, localized approval cards and notices.
- Local models: the context size is read from llama-server / Ollama, silent context
  truncation is detected, and the prompt cache stays valid on local backends.
- A turn that exceeds the context window tells you how to continue.

Security is unchanged: Thunderbird pairing and signed bridge messages, the approval
gate for risky actions, DPAPI-protected secrets, CSP and Host/Origin checks.

## 2.1.2

**Security release. Requires and bundles SuperCli 1.0.25** (`SUPERCLI_REF` = `v1.0.25`)
**and Thunderbird AI Bridge 0.10.0** (vendored XPI, SHA-256
`1821574b39a2fec111bcf1f13da29dcb102edbb9f08e1dc56433ec09423512c2`).

Until now NestCafe/SuperCli and the Thunderbird extension trusted each other through a
fixed token that was the same in every copy, on port 47831, with CORS open to any page.
Another program, a second NestCafe/SuperCli or a web page could take the port and
Thunderbird attached to it (during a review a test copy of NestCafe received the real
mailbox connection). The bridge now uses a one-time pairing and signs every message.

### Pairing Thunderbird (once)

1. Save the bundled XPI (**Ustawienia → Integracje → Zapisz wbudowane XPI**) and install
   it in Thunderbird (**Dodatki i motywy → koło zębate → Zainstaluj dodatek z pliku**).
   Extension 0.9.x cannot connect to this version.
2. In NestCafe: **Ustawienia → Integracje → Thunderbird AI Bridge → Paruj z Thunderbirdem**.
   A 16-character code appears, valid for 5 minutes.
3. In Thunderbird: **Dodatki i motywy → Thunderbird AI Bridge → Opcje**, enter the code,
   click **Paruj**. NestCafe shows *Połączony*, the extension shows *Połączono*.

### From SuperCli 1.0.25

- The code authenticates an ECDH P-256 exchange; both sides derive a 256-bit secret,
  stored DPAPI-protected in the engine's data folder (`thunderbird-bridge/pairing.json`).
- Mutual HMAC challenge-response on every connection; every request and response is
  signed with a timestamp and a single-use nonce. Loopback only, exact `Host` header,
  web origins refused, CORS only for the paired extension.
- An unpaired engine does not open the bridge port. A second NestCafe/SuperCli never
  takes it over and says which instance holds it.
- Old 0.9.x extensions get a clear "update the extension" message and nothing else.

### NestCafe

- Thunderbird card in **Ustawienia → Integracje**: *Paruj z Thunderbirdem* / *Paruj
  ponownie* with the one-time code and instructions, *Rozparuj*, and statuses
  *Niesparowany*, *Czeka na kod*, *Połączony*, *Sparowany, ale bez połączenia*, port held by
  another instance, outdated extension.

## 2.1.1

**Requires and bundles SuperCli 1.0.24** (`SUPERCLI_REF` = `v1.0.24`). The bundled
Thunderbird AI Bridge stays 0.9.34.

### From SuperCli 1.0.24

- Cheaper agent runs on hosted models: requests stay append-only so the provider's
  prompt cache covers almost the whole conversation (eval suite on gpt-6-luna: cost
  -63%, model steps -22%, cached input 46% -> 85%, 26/26 tasks passing). The first
  turn already knows the project layout, and long tool outputs page in fewer turns.
  `context_tail_pinning = false` in the engine's `config.toml` restores the old behaviour.
- Approval card: for `thunderbird_mail` calls with exact message ids the card lists up
  to three of those messages (subject, sender, date) and warns when an id is not in the
  folder the request names; account display names are used in the description instead
  of ids such as `account2`; the "outside the workspace" summary is translated.
- When you press **Odrzuć**, the agent is now told plainly that you declined the action
  in NestCafe/SuperCli and nothing was done, instead of reporting that Thunderbird refused it.
- GPT-6 prices (gpt-6-luna, gpt-6-sol, gpt-6.1-sol, gpt-6-astra) in the cost estimates.
- The first message of a resumed session after updating re-reads the conversation once
  (one prompt-cache miss), because the engine's system prompt no longer carries the date.

### Fixes

- `ask_user` with several questions: the "Odpowiedziano" confirmation no longer
  disappears when the agent's answer arrives before the last answer was acknowledged.
- `scripts/build-native.ps1 -RefreshBridge` looked for the XPI under a path containing a
  literal tab; it now uses `..\Thunderbird-AI-Bridge\dist\thunderbird-ai-bridge.xpi`.

## 2.1.0

**Requires and bundles SuperCli 1.0.23** (`SUPERCLI_REF` = `v1.0.23`). The installer
and the portable ZIP ship the engine built from that tag. The bundled Thunderbird AI
Bridge is 0.9.34.

### Approval prompts for risky actions

SuperCli 1.0.23 adds a host-side approval gate. NestCafe now asks you before the
agent runs a risky operation, for example:

- Thunderbird mailbox changes (`thunderbird_mail` writes) and Outlook trash/purge,
- moving files outside the workspace to the trash,
- mutating `headless_control` actions, image/video generation and arming `host_power`.

NestCafe shows these as a dedicated "Wymagana zgoda" card in the conversation: the
operation summary, a "Można cofnąć" / "Nie da się cofnąć" badge, the tool, the target
and the reversibility line, and three buttons: **Odrzuć**, **Zatwierdź podobne w tej
sesji** and **Zatwierdź**. "Odrzuć" is focused by default, so pressing Enter never
approves anything. Denying means the operation is not performed. NestCafe's
allow-all mode does not skip these prompts. An approval that arrives while an
`ask_user` form is open is shown as its own card and does not replace or join that form.

### Other changes since 2.0.2

- Thunderbird AI Bridge card in Settings → Integrations, with the XPI bundled (SHA-256 pinned).
- OCR: local DOCX/MD/TXT import, page-by-page PDF OCR, cleanup of unused history sources,
  layout sized from the module width.
- Composer: compact model picker, reasoning level control, attachment preview, paginated transcript.
- Providers: auto-detect OpenAI/Anthropic, Responses and OpenCode provider types; confirm before removal.
- Manual update check in the About dialog.
- In-app confirm/prompt dialogs for destructive actions; memory dedup and scope labels.
- Polish, actionable error messages and an honest no-model state.
- Sidebar drawer on narrow windows; labels for icon-only buttons; light-theme fixes.
- Queue admission, Stop handling, model selection and session navigation race fixes.
- Build: the engine is built from the pinned SuperCli tag instead of a committed binary;
  portable dist package; the launcher no longer forwards `--no-update` to the engine.
