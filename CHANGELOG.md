# Changelog

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
