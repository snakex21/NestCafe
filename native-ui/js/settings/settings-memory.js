"use strict";

const memorySettingsUI = window.NestCafe?.settings?.ui;

function memoryScopeLabel(scope) {
  return {
    fact: t("settings.memory.scope.fact"),
    preference: t("settings.memory.scope.preference"),
    decision: t("settings.memory.scope.decision"),
    "task-log": t("settings.memory.scope.taskLog"),
  }[scope] || scope || t("settings.nav.memory");
}

window.NestCafe?.settings?.registerPage?.("memory", t("settings.nav.memory"), async (root) => {
  const refreshButton = memorySettingsUI.button(t("common.refresh"));
  const dedupButton = memorySettingsUI.button(t("settings.memory.dedup"));
  const addButton = memorySettingsUI.button(t("settings.memory.addFact"));
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
    <span><strong>${t("settings.memory.autoTitle")}</strong><small>${t("settings.memory.autoHint")}</small></span>`;
  automatic.append(toggle);

  const editor = document.createElement("form");
  editor.className = "memory-add-form";
  editor.hidden = true;
  editor.innerHTML = `
    <label class="settings-form-wide"><span>${t("settings.memory.contentLabel")}</span><textarea name="content" rows="3" required placeholder="${t("settings.memory.contentPlaceholder")}"></textarea></label>
    <label><span>${t("settings.memory.typeLabel")}</span><select name="type"><option value="fact">${t("settings.memory.scope.fact")}</option><option value="preference">${t("settings.memory.scope.preference")}</option><option value="decision">${t("settings.memory.scope.decision")}</option><option value="task-log">${t("settings.memory.scope.taskLog")}</option></select></label>
    <label><span>${t("settings.memory.targetLabel")}</span><select name="target"><option value="project">${t("settings.memory.targetProject")}</option><option value="global">${t("settings.memory.targetGlobal")}</option></select></label>
    <div class="settings-form-actions"><button class="settings-secondary-button memory-cancel" type="button">${t("common.cancel")}</button><button class="settings-primary-button" type="submit">${t("settings.memory.saveEntry")}</button></div>`;

  const load = async () => {
    const items = await memorySettingsUI.json("/api/memory?limit=150");
    list.replaceChildren();
    const preferences = (items || []).filter((item) => item.scope === "preference" && item.target === "global").length;
    const indexed = (items || []).filter((item) => item.tags?.includes("folder-index")).length;
    const count = (value) => window.NestCafe?.i18n?.formatNumber?.(value) ?? value;
    summary.innerHTML = `
      <div><strong>${count((items || []).length)}</strong><span>${t("settings.memory.stat.entries")}</span></div>
      <div><strong>${count(preferences)}</strong><span>${t("settings.memory.stat.globalPreferences")}</span></div>
      <div><strong>${count(indexed)}</strong><span>${t("settings.memory.stat.folderIndex")}</span></div>
      <p><span class="memory-runtime-dot"></span> ${t("settings.memory.toolsActive", { remember: "<code>remember</code>", recall: "<code>recall</code>" })}</p>`;
    for (const item of items || []) {
      const row = document.createElement("article");
      row.className = "memory-settings-row";
      const copy = document.createElement("div");
      const top = document.createElement("div");
      const badge = document.createElement("span");
      badge.className = "settings-status-badge";
      badge.textContent = memoryScopeLabel(item.scope);
      const date = document.createElement("time");
      date.textContent = item.updated_at
        ? window.NestCafe?.i18n?.formatDate?.(item.updated_at, { dateStyle: "short", timeStyle: "medium" }) ?? new Date(item.updated_at).toLocaleString()
        : "";
      top.append(badge, date);
      const content = document.createElement("p");
      content.textContent = item.content;
      const meta = document.createElement("span");
      const targetLabel = item.target === "global" ? t("settings.memory.metaGlobal") : t("settings.memory.metaProject");
      meta.textContent = [targetLabel, item.source, ...(item.tags || [])].filter(Boolean).join(" · ");
      copy.append(top, content, meta);
      const remove = memorySettingsUI.button(t("common.delete"), "settings-danger-button");
      remove.addEventListener("click", async () => {
        const approved = await window.NestCafe?.dialogs?.confirm?.({
          title: t("settings.memory.removeTitle"),
          message: t("settings.memory.removeMessage"),
          confirmLabel: t("settings.memory.removeConfirm"),
        });
        if (!approved) return;
        const target = item.target ? `&target=${encodeURIComponent(item.target)}` : "";
        await memorySettingsUI.json(`/api/memory?id=${encodeURIComponent(item.id)}${target}`, { method: "DELETE" });
        load();
      });
      row.append(copy, remove);
      list.append(row);
    }
    if (!items?.length) {
      list.append(memorySettingsUI.empty(t("settings.memory.emptyTitle"), t("settings.memory.emptyHint")));
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
      window.NestCafe?.toast?.(checked ? t("settings.memory.autoOn") : t("settings.memory.autoOff"));
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
    window.NestCafe?.toast?.(t("settings.memory.saved"));
    load();
  });
  refreshButton.addEventListener("click", load);
  dedupButton.addEventListener("click", async () => {
    dedupButton.disabled = true;
    try {
      const result = await memorySettingsUI.json("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dedup" }),
      });
      window.NestCafe?.toast?.(t("settings.memory.deduped", { count: result.removed || 0 }));
      await load();
    } finally {
      dedupButton.disabled = false;
    }
  });

  const headerActions = document.createElement("div");
  headerActions.className = "settings-header-actions";
  headerActions.append(refreshButton, dedupButton, addButton);
  root.replaceChildren(
    memorySettingsUI.sectionHeader(
      t("settings.memory.heading"),
      t("settings.memory.description"),
      headerActions,
    ),
    summary,
    automatic,
    editor,
    list,
  );
  await load();
});
