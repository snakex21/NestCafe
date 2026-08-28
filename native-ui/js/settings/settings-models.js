"use strict";

(() => {
  const ui = window.NestCafe?.settings?.ui;
  const register = window.NestCafe?.settings?.registerPage;
  if (!ui || !register) return;

  const tokenLabel = (value) => {
    const tokens = Number(value || 0);
    if (!tokens) return "Nie wykryto";
    if (tokens >= 1_000_000) return `${tokens / 1_000_000} mln`;
    if (tokens >= 1_000) return `${Math.round(tokens / 1_000)} tys.`;
    return String(tokens);
  };

  register("models", "Modele i kontekst", async (root) => {
    const search = document.createElement("input");
    search.type = "search";
    search.className = "settings-search-input";
    search.placeholder = "Szukaj modelu lub dostawcy…";
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
        const abilities = [model.reasoning && "myślenie"].filter(Boolean);
        meta.textContent = `${model.provider || "dostawca"} · auto: ${tokenLabel(model.context_length)}${abilities.length ? ` · ${abilities.join(" · ")}` : ""}`;
        identity.append(name, meta);

        const control = document.createElement("div");
        control.className = "settings-model-context-control";
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "text";
        input.value = model.manual_context_length ? String(model.manual_context_length) : "auto";
        input.placeholder = "auto, 100k lub 1m";
        input.setAttribute("aria-label", `Kontekst modelu ${model.id}`);
        const save = ui.button("Zapisz", "settings-primary-button");
        const status = document.createElement("small");
        status.textContent = model.manual_context_length ? `Ręcznie: ${tokenLabel(model.manual_context_length)}` : "Automatycznie";
        save.addEventListener("click", async () => {
          save.disabled = true;
          try {
            await ui.json("/api/model/context", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ provider: model.provider, model: model.id, value: input.value.trim() || "auto" }),
            });
            window.NestCafe?.toast?.(`Zapisano kontekst dla ${model.provider}/${model.id}.`);
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
      if (!list.children.length) list.append(ui.empty("Brak modeli", "Zmień wyszukiwanie albo skonfiguruj dostawcę."));
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
        "Kontekst modeli",
        "Ręczny limit dotyczy pary dostawca/model. „auto” wraca do wartości z API lub katalogu.",
      ),
      search,
      list,
    );
    root.replaceChildren(shell);
    await load();
  });
})();
