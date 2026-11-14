"use strict";

(() => {
  const ui = window.NestCafe?.settings?.ui;
  const register = window.NestCafe?.settings?.registerPage;
  if (!ui || !register) return;

  const tokenLabel = (value) => {
    const tokens = Number(value || 0);
    const format = (value) => window.NestCafe?.i18n?.formatNumber?.(value) ?? String(value);
    if (!tokens) return t("settings.models.notDetected");
    if (tokens >= 1_000_000) return t("settings.models.tokensMillions", { value: format(tokens / 1_000_000) });
    if (tokens >= 1_000) return t("settings.models.tokensThousands", { value: format(Math.round(tokens / 1_000)) });
    return format(tokens);
  };

  register("models", t("settings.nav.models"), async (root) => {
    const search = document.createElement("input");
    search.type = "search";
    search.className = "settings-search-input";
    search.placeholder = t("settings.models.searchPlaceholder");
    search.setAttribute("aria-label", t("settings.models.searchLabel"));
    const list = document.createElement("div");
    list.className = "settings-model-context-list";
    let models = [];

    const render = () => {
      const query = search.value.trim().toLowerCase();
      list.replaceChildren();
      for (const model of models) {
        if (query && !`${model.id} ${model.provider}`.toLowerCase().includes(query)) continue;
        const row = document.createElement("article");
        row.className = `settings-model-context-row${model.active ? " active" : ""}`;
        const identity = document.createElement("div");
        identity.className = "settings-model-context-copy";
        const name = document.createElement("strong");
        name.textContent = model.id;
        const meta = document.createElement("span");
        const abilities = [model.reasoning && t("settings.models.reasoning")].filter(Boolean);
        meta.textContent = `${model.provider || t("settings.models.providerFallback")} · ${t("settings.models.autoContext", { value: tokenLabel(model.context_length) })}${abilities.length ? ` · ${abilities.join(" · ")}` : ""}`;
        identity.append(name, meta);

        const control = document.createElement("div");
        control.className = "settings-model-context-control";
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "text";
        input.value = model.manual_context_length ? String(model.manual_context_length) : "auto";
        input.placeholder = t("settings.models.contextPlaceholder");
        input.setAttribute("aria-label", t("settings.models.contextLabel", { model: model.id }));
        const save = ui.button(t("common.save"), "settings-primary-button");
        const status = document.createElement("small");
        status.textContent = model.manual_context_length
          ? t("settings.models.manual", { value: tokenLabel(model.manual_context_length) })
          : t("settings.models.automatic");
        save.addEventListener("click", async () => {
          save.disabled = true;
          try {
            await ui.json("/api/model/context", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ provider: model.provider, model: model.id, value: input.value.trim() || "auto" }),
            });
            window.NestCafe?.toast?.(t("settings.models.saved", { model: `${model.provider}/${model.id}` }));
            await load();
          } catch (error) {
            window.NestCafe?.toast?.(error.message);
          } finally {
            save.disabled = false;
          }
        });
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") save.click();
        });
        control.append(input, save, status);
        row.append(identity, control);
        list.append(row);
      }
      if (!list.children.length) list.append(ui.empty(t("settings.models.emptyTitle"), t("settings.models.emptyHint")));
    };

    const load = async () => {
      const data = await ui.json("/api/models");
      models = [...(data.models || [])].sort((a, b) => Number(b.active) - Number(a.active) || a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id));
      render();
    };
    search.addEventListener("input", render);
    const shell = document.createElement("div");
    shell.className = "settings-model-context-page";
    shell.append(
      ui.sectionHeader(
        t("settings.models.heading"),
        t("settings.models.description"),
      ),
      search,
      list,
    );
    root.replaceChildren(shell);
    await load();
  });
})();
