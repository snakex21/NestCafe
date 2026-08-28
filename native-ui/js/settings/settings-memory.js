"use strict";

const memorySettingsUI = window.NestCafe?.settings?.ui;

function memoryScopeLabel(scope) {
  return {
    fact: "Fakt",
    preference: "Preferencja",
    decision: "Decyzja",
    "task-log": "Dziennik zadania",
  }[scope] || scope || "Pamięć";
}

window.NestCafe?.settings?.registerPage?.("memory", "Pamięć", async (root) => {
  const refreshButton = memorySettingsUI.button("Odśwież");
  const addButton = memorySettingsUI.button("+ Dodaj fakt");
  const list = document.createElement("div");
  list.className = "memory-settings-list";
  const summary = document.createElement("div");
  summary.className = "memory-summary";

  const settings = await memorySettingsUI.json("/api/settings");
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.className = "settings-switch-input";
  toggle.checked = settings.settings?.["nestcafe.autoMemory"] !== false;
  const automatic = document.createElement("label");
  automatic.className = "settings-control-row memory-auto-row";
  automatic.innerHTML = `
    <span><strong>Automatyczna pamięć rozmów</strong><small>Po zakończeniu pracy agent zapisuje krótkie, trwałe fakty narzędziem remember.</small></span>`;
  automatic.append(toggle);

  const editor = document.createElement("form");
  editor.className = "memory-add-form";
  editor.hidden = true;
  editor.innerHTML = `
    <label class="settings-form-wide"><span>Treść pamięci</span><textarea name="content" rows="3" required placeholder="Np. Użytkownik preferuje odpowiedzi po polsku."></textarea></label>
    <label><span>Rodzaj</span><select name="type"><option value="fact">Fakt</option><option value="preference">Preferencja</option><option value="decision">Decyzja</option><option value="task-log">Dziennik zadania</option></select></label>
    <label><span>Zasięg</span><select name="target"><option value="project">Bieżąca rozmowa i jej kontekst</option><option value="global">Wspólna pamięć NestCafe</option></select></label>
    <div class="settings-form-actions"><button class="settings-secondary-button memory-cancel" type="button">Anuluj</button><button class="settings-primary-button" type="submit">Zapisz w pamięci</button></div>`;

  const load = async () => {
    const items = await memorySettingsUI.json("/api/memory?limit=150");
    list.replaceChildren();
    const preferences = (items || []).filter((item) => item.scope === "preference").length;
    const indexed = (items || []).filter((item) => item.tags?.includes("folder-index")).length;
    summary.innerHTML = `
      <div><strong>${(items || []).length}</strong><span>Wpisy pamięci</span></div>
      <div><strong>${preferences}</strong><span>Preferencje globalne</span></div>
      <div><strong>${indexed}</strong><span>Fragmenty indeksów folderów</span></div>
      <p><span class="memory-runtime-dot"></span> Narzędzia <code>remember</code> i <code>recall</code> są aktywne w silniku Go.</p>`;
    for (const item of items || []) {
      const row = document.createElement("article");
      row.className = "memory-settings-row";
      const copy = document.createElement("div");
      const top = document.createElement("div");
      const badge = document.createElement("span");
      badge.className = "settings-status-badge";
      badge.textContent = memoryScopeLabel(item.scope);
      const date = document.createElement("time");
      date.textContent = item.updated_at ? new Date(item.updated_at).toLocaleString("pl-PL") : "";
      top.append(badge, date);
      const content = document.createElement("p");
      content.textContent = item.content;
      const meta = document.createElement("span");
      meta.textContent = [item.source, ...(item.tags || [])].filter(Boolean).join(" · ");
      copy.append(top, content, meta);
      const remove = memorySettingsUI.button("Usuń", "settings-danger-button");
      remove.addEventListener("click", async () => {
        if (!confirm("Usunąć ten wpis z pamięci?")) return;
        await memorySettingsUI.json(`/api/memory?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
        load();
      });
      row.append(copy, remove);
      list.append(row);
    }
    if (!items?.length) {
      list.append(memorySettingsUI.empty("Pamięć jest pusta", "Dodaj fakt ręcznie albo poproś agenta, aby coś zapamiętał."));
    }
  };

  toggle.addEventListener("change", async () => {
    const checked = toggle.checked;
    toggle.disabled = true;
    try {
      await memorySettingsUI.json("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "nestcafe.autoMemory": checked }),
      });
      window.NestCafe?.toast?.(checked ? "Automatyczna pamięć została włączona." : "Automatyczna pamięć została wyłączona.");
    } catch (error) {
      toggle.checked = !checked;
      window.NestCafe?.toast?.(error.message);
    } finally {
      toggle.disabled = false;
    }
  });

  addButton.addEventListener("click", () => {
    editor.hidden = false;
    editor.querySelector("textarea").focus();
  });
  editor.querySelector(".memory-cancel").addEventListener("click", () => {
    editor.hidden = true;
    editor.reset();
  });
  editor.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(editor);
    await memorySettingsUI.json("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: String(data.get("content") || "").trim(),
        type: String(data.get("type") || "fact"),
        target: String(data.get("target") || "project"),
      }),
    });
    editor.reset();
    editor.hidden = true;
    window.NestCafe?.toast?.("Wpis został zapisany w trwałej pamięci.");
    load();
  });
  refreshButton.addEventListener("click", load);

  const headerActions = document.createElement("div");
  headerActions.className = "settings-header-actions";
  headerActions.append(refreshButton, addButton);
  root.replaceChildren(
    memorySettingsUI.sectionHeader(
      "Pamięć NestCafe",
      "Trwałe fakty są zapisywane w SQLite i wstrzykiwane do kolejnych rozmów.",
      headerActions,
    ),
    summary,
    automatic,
    editor,
    list,
  );
  await load();
});
