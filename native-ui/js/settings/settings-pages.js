"use strict";

const settingsPageDialog = document.createElement("dialog");
settingsPageDialog.className = "settings-page-dialog";
settingsPageDialog.id = "settings-page-dialog";
settingsPageDialog.innerHTML = `
  <header class="settings-page-head">
    <h2 id="settings-page-title">Ustawienia</h2>
    <button type="button" aria-label="Zamknij">×</button>
  </header>
  <section class="settings-page-content" id="settings-page-content"></section>`;
document.body.appendChild(settingsPageDialog);

const settingsPageNavigation = window.NestCafe?.settings?.createNavigation?.("");
if (settingsPageNavigation) {
  settingsPageDialog.prepend(settingsPageNavigation);
  settingsPageNavigation.addEventListener("click", (event) =>
    window.NestCafe?.settings?.handleNavigation?.(event, settingsPageDialog),
  );
}

const settingsPages = new Map();
const settingsPageContent = settingsPageDialog.querySelector("#settings-page-content");
const settingsPageTitle = settingsPageDialog.querySelector("#settings-page-title");
let settingsPageLoadID = 0;

function scopedSettingsRoot(action, loadID) {
  return {
    get isConnected() {
      return Boolean(
        settingsPageDialog.open &&
        settingsPageContent.isConnected &&
        settingsPageLoadID === loadID &&
        settingsPageContent.dataset.page === action
      );
    },
    get dataset() {
      return settingsPageContent.dataset;
    },
    replaceChildren(...nodes) {
      if (!this.isConnected) return;
      settingsPageContent.replaceChildren(...nodes);
    },
  };
}

async function settingsPageJson(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text.trim() ? JSON.parse(text) : null;
}

function settingsEmpty(title, description) {
  const empty = document.createElement("div");
  empty.className = "settings-empty";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const copy = document.createElement("p");
  copy.textContent = description;
  empty.append(heading, copy);
  return empty;
}

function settingsButton(label, className = "settings-secondary-button") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  return button;
}

function settingsSectionHeader(title, description, action) {
  const header = document.createElement("div");
  header.className = "settings-section-header";
  const copy = document.createElement("div");
  const heading = document.createElement("h3");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = description;
  copy.append(heading, paragraph);
  header.append(copy);
  if (action) header.append(action);
  return header;
}

function registerSettingsPage(action, title, loader) {
  settingsPages.set(action, { title, loader });
}

async function openSettingsPage(action) {
  const page = settingsPages.get(action);
  if (!page) return;
  const loadID = ++settingsPageLoadID;
  settingsPageTitle.textContent = page.title;
  settingsPageDialog.dataset.page = action;
  settingsPageContent.dataset.page = action;
  settingsPageNavigation?.querySelectorAll("[data-settings-action]").forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsAction === action);
  });
  settingsPageContent.replaceChildren(settingsEmpty("Ładowanie…", "Pobieram aktualne dane."));
  if (!settingsPageDialog.open) settingsPageDialog.showModal();
  const scopedRoot = scopedSettingsRoot(action, loadID);
  try {
    await page.loader(scopedRoot);
  } catch (error) {
    scopedRoot.replaceChildren(settingsEmpty("Nie udało się wczytać strony", error.message));
  }
}

settingsPageDialog.querySelector(".settings-page-head button").addEventListener("click", () => settingsPageDialog.close());
settingsPageDialog.addEventListener("close", () => {
  settingsPageLoadID += 1;
});

const settingsUI = {
  json: settingsPageJson,
  empty: settingsEmpty,
  button: settingsButton,
  sectionHeader: settingsSectionHeader,
};
// Merge page host into shell exported by settings.js (nav + about).
const settingsShell = window.NestCafe?.settings || {};
window.NestCafe.export("settings", {
  ...settingsShell,
  openPage: openSettingsPage,
  registerPage: registerSettingsPage,
  ui: settingsUI,
});

function projectRow(project, refresh) {
  const row = document.createElement("article");
  row.className = `settings-list-row${project.active ? " active" : ""}`;
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = project.name || "Przestrzeń robocza";
  const path = document.createElement("span");
  path.textContent = project.path;
  copy.append(title, path);
  const actions = document.createElement("div");
  if (project.active) {
    const badge = document.createElement("span");
    badge.className = "settings-status-badge";
    badge.textContent = "Aktywna";
    actions.append(badge);
  } else {
    const use = settingsButton("Użyj");
    use.addEventListener("click", async () => {
      if (window.NestCafe?.isRunning?.()) {
        window.NestCafe?.toast?.("Zakończ aktywne zadanie przed zmianą przestrzeni.");
        return;
      }
      await settingsPageJson("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "use", target: project.path }),
      });
      await Promise.all([
        window.NestCafe?.refreshHealth?.(),
        window.NestCafe?.models?.refresh?.(),
      ]);
      window.NestCafe?.startConversation?.();
      refresh();
    });
    actions.append(use);
  }
  const remove = settingsButton("Usuń", "settings-danger-button");
  remove.disabled = project.active;
  remove.addEventListener("click", async () => {
    if (!confirm(`Usunąć przestrzeń „${project.name}” z listy?`)) return;
    await settingsPageJson("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", target: project.path }),
    });
    refresh();
  });
  actions.append(remove);
  row.append(copy, actions);
  return row;
}

registerSettingsPage("workspaces", "Przestrzenie robocze", async (root) => {
  const add = settingsButton("+ Dodaj przestrzeń", "settings-primary-button");
  const list = document.createElement("div");
  list.className = "settings-list";
  const refresh = async () => {
    const data = await settingsPageJson("/api/projects");
    list.replaceChildren();
    for (const project of data.projects || []) list.append(projectRow(project, refresh));
    if (!data.projects?.length) {
      list.append(settingsEmpty("Brak przestrzeni", "Dodaj folder, aby utworzyć pierwszą przestrzeń roboczą."));
    }
  };
  add.addEventListener("click", async () => {
    if (window.NestCafe?.isRunning?.()) {
      window.NestCafe?.toast?.("Zakończ aktywne zadanie przed zmianą przestrzeni.");
      return;
    }
    const picked = await settingsPageJson("/api/folder-picker");
    if (!picked.path) return;
    const name = picked.path.split(/[\\/]/).filter(Boolean).pop() || "Przestrzeń";
    await settingsPageJson("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", target: picked.path, name }),
    });
    window.NestCafe?.startConversation?.();
    await Promise.all([
      window.NestCafe?.refreshHealth?.(),
      window.NestCafe?.models?.refresh?.(),
    ]);
    refresh();
  });
  root.replaceChildren(
    settingsSectionHeader(
      "Twoje przestrzenie",
      "Każda przestrzeń ma własny folder, historię rozmów i pamięć projektu.",
      add,
    ),
    list,
  );
  await refresh();
});

// "memory" is registered in settings-memory.js (loaded after this file).
// Old unused folders page was removed; live folders UI is settings-folders.js.
