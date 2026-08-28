# NestCafe UI architecture

Thin browser UI served by SuperCli WebView2. No React/build step.

## Layers

```text
SuperCli runtime.js     protocol (SSE, JSON helpers)
NestCafe (namespace)    public bus — window.NestCafe only
feature modules         chat / settings / plan / OCR host
```

## Script order (`index.html`)

1. `/.__supercli/ui/runtime.js`
2. `js/core/namespace.js` + `appearance.js`
3. chat → app shell → models → composer → plan → sidebar
4. settings shell → settings pages
5. modules host

## Public API

Always use `NestCafe.*` (no `window.*NestCafe*` aliases):

```js
NestCafe.toast(msg)
NestCafe.runPrompt(text, attachments)
NestCafe.settings.openPage("folders")
NestCafe.settings.registerPage(id, title, loader)
NestCafe.settings.ui.json("/api/...")
NestCafe.plan.enqueue(text)
NestCafe.modules.open(manifest)
NestCafe.attachments.renderSent(node, paths)
NestCafe.call("settings.openPage", "general")
```

Module host global (intentional, not NestCafe bus):

```js
window.NestCafeModules[name] = { mount(container, { manifest, api }) }
```

## Settings

| File | Responsibility |
|---|---|
| `settings.js` | dialogs, nav shell, about |
| `settings-pages.js` | page host + workspaces |
| `settings-*.js` | one page registration each |

Rules:

- register each page id once
- use `NestCafe.settings.ui` for shared widgets
- do not import CSS from JS

## CSS

Single file: `css/app.css` (merged cascade). Section banners mark historical
feature sheets. Later sections override earlier ones.

Canonical product look lives in the final **`redesign-v2`** block (Linear-style
shell). Prefer appending there instead of editing early `styles`/`classic`/`legacy`
sections unless fixing a selector that only exists early.

## Modules (OCR etc.)

Host: `js/modules/modules.js`  
Sources: `modules/<name>/` (embedded into launcher at build)

## Build

`build.bat` embeds `native-ui/` + `modules/` into `NestCafe.exe`.  
Runtime extract cache: `supercli-data/nestcafe-ui/<hash>/`.
