"use strict";

const providerDialog = document.querySelector("#provider-dialog");
const providerList = document.querySelector("#provider-list");
const providerForm = document.querySelector("#provider-form");
const providerTemplate = document.querySelector("#provider-template");
const providerName = document.querySelector("#provider-name");
const providerType = document.querySelector("#provider-type");
const providerUrl = document.querySelector("#provider-url");
const providerModel = document.querySelector("#provider-model");
const providerKey = document.querySelector("#provider-key");
const providerDisabled = document.querySelector("#provider-disabled");
const providerClearKey = document.querySelector("#provider-clear-key");
const providerOptions = document.querySelector("#provider-options");
const providerStatus = document.querySelector("#provider-status");
const providerDiagnostic = document.querySelector("#provider-diagnostic");
const providerModels = document.querySelector("#provider-models");
const providerModelsCount = document.querySelector("#provider-models-count");
const providerModelSearch = document.querySelector("#provider-model-search");
const providerModelList = document.querySelector("#provider-model-list");
const providerModelsEnable = document.querySelector("#provider-models-enable");
const providerModelsDisable = document.querySelector("#provider-models-disable");
const deleteProvider = document.querySelector("#delete-provider");
const checkProvider = document.querySelector("#check-provider");
const saveProvider = document.querySelector("#save-provider");

let providers = [];
let providerTemplates = [];
let providerModelCatalog = [];
let selectedProvider = null;

const providerLogoAliases = {
  kilo: "kilocode",
  kilocode: "kilocode",
  opencode: "opencode",
  zen: "opencode",
  opencodego: "opencode",
  custom: "custom",
  codex: "openai",
};

function providerLogoSource(name) {
  const normalized = String(name || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  const known = [
    "openai", "anthropic", "google", "groq", "together", "deepseek", "openrouter",
    "xai", "huggingface", "lmstudio", "ollama", "azure", "bedrock", "vertex",
    "litellm", "minimax", "moonshot", "nebius", "nim", "fireworks", "zai",
    "mistral", "perplexity", "cerebras", "cohere", "nvidia", "novita", "chutes",
    "venice", "lepton", "zhipu", "dashscope", "doubao", "stepfun", "yi",
    "xiaomi", "deepinfra", "siliconflow", "baichuan", "tencent", "featherless",
    "iflytek", "qianfan", "sensenova", "opencode", "kilocode", "zen",
  ];
  const match = known.find((key) => normalized.includes(key));
  const logo = providerLogoAliases[normalized] || match || "custom";
  const pngOnly = ["lmstudio", "chutes"];
  return `assets/ai-logos/${logo}.${pngOnly.includes(logo) ? "png" : "svg"}`;
}

function providerLogo(name, className = "provider-logo") {
  const image = document.createElement("img");
  image.className = className;
  image.src = providerLogoSource(name);
  image.alt = "";
  image.addEventListener("error", () => {
    image.src = "assets/ai-logos/custom.svg";
  }, { once: true });
  return image;
}

const providerTitleCopy = document.querySelector(".provider-form-title > div");
const providerHeaderIcon = providerLogo("custom", "provider-header-logo");
providerTitleCopy.prepend(providerHeaderIcon);

async function providerJson(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
  return response.json();
}

function field(item, name) {
  return item?.[name] ?? item?.[name[0].toUpperCase() + name.slice(1)] ?? "";
}

function providerView(item) {
  return {
    name: field(item, "name"),
    type: field(item, "type") || "openai",
    baseUrl: field(item, "baseURL") || field(item, "base_url"),
    model: field(item, "model"),
    hasKey: Boolean(field(item, "hasKey")),
    disabled: Boolean(field(item, "disabled")),
    models: field(item, "models") || [],
  };
}

function setProviderBusy(busy) {
  saveProvider.disabled = busy;
  checkProvider.disabled = busy;
  deleteProvider.disabled = busy;
  saveProvider.textContent = busy ? "Sprawdzam…" : selectedProvider ? "Zapisz zmiany" : "Dodaj i sprawdź";
}

function showProviderMessage(text, state = "") {
  providerStatus.textContent = state === "online" ? "Dostępny" : state === "offline" ? "Niedostępny" : "Nie sprawdzono";
  providerStatus.className = `provider-status${state ? ` ${state}` : ""}`;
  providerDiagnostic.textContent = text;
}

function modelsForProvider(name) {
  return providerModelCatalog.filter((model) => model.provider === name);
}

async function reloadProviderModelCatalog() {
  const catalog = await providerJson("/api/models");
  providerModelCatalog = (catalog.models || []).map((model) => ({
    ...model,
    id: String(model.id || ""),
    provider: String(model.provider || ""),
  }));
  renderProviderModels();
}

function renderProviderModels() {
  const allModels = selectedProvider ? modelsForProvider(selectedProvider.name) : [];
  providerModels.hidden = !selectedProvider || !allModels.length;
  providerModelList.replaceChildren();
  if (!allModels.length) return;

  const query = providerModelSearch.value.trim().toLowerCase();
  const visibleModels = allModels.filter((model) => model.id.toLowerCase().includes(query));
  const enabled = allModels.filter((model) => !model.hidden).length;
  providerModelsCount.textContent = `${enabled} / ${allModels.length} włączone`;

  if (!visibleModels.length) {
    const empty = document.createElement("div");
    empty.className = "provider-model-empty";
    empty.textContent = "Brak modeli pasujących do wyszukiwania.";
    providerModelList.appendChild(empty);
    return;
  }

  for (const model of visibleModels) {
    const row = document.createElement("div");
    row.className = `provider-model-row${model.active ? " active" : ""}`;
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    const meta = document.createElement("small");
    name.textContent = model.id;
    meta.textContent = [
      model.active ? "aktywny" : "",
      model.reasoning ? "reasoning" : "",
    ].filter(Boolean).join(" · ") || "model dostawcy";
    copy.append(name, meta);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "provider-model-toggle";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-checked", String(!model.hidden));
    toggle.setAttribute("aria-label", `${model.hidden ? "Włącz" : "Wyłącz"} model ${model.id}`);
    toggle.title = model.hidden ? "Włącz model" : "Wyłącz model";
    toggle.addEventListener("click", async () => {
      toggle.disabled = true;
      try {
        const result = await providerJson("/api/model/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: model.provider, model: model.id }),
        });
        model.hidden = Boolean(result.hidden);
        renderProviderModels();
        await window.NestCafe?.models?.refresh?.();
      } catch (error) {
        window.NestCafe?.toast?.(error.message);
      } finally {
        toggle.disabled = false;
      }
    });
    row.append(copy, toggle);
    providerModelList.appendChild(row);
  }
}

async function setProviderModelsHidden(hidden) {
  if (!selectedProvider) return;
  const models = modelsForProvider(selectedProvider.name);
  if (!models.length) return;
  providerModelsEnable.disabled = true;
  providerModelsDisable.disabled = true;
  try {
    await providerJson("/api/model/visibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refs: models.map((model) => ({ provider: model.provider, model: model.id })),
        hidden,
      }),
    });
    models.forEach((model) => { model.hidden = hidden; });
    renderProviderModels();
    await window.NestCafe?.models?.refresh?.();
  } catch (error) {
    window.NestCafe?.toast?.(error.message);
  } finally {
    providerModelsEnable.disabled = false;
    providerModelsDisable.disabled = false;
  }
}

function renderProviderList() {
  providerList.replaceChildren();
  if (providers.length) {
    const label = document.createElement("div");
    label.className = "provider-group-label";
    label.textContent = "SKONFIGUROWANE";
    providerList.appendChild(label);
  }
  for (const provider of providers) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `provider-row${selectedProvider?.name === provider.name ? " active" : ""}${provider.disabled ? " disabled" : ""}`;
    const text = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = provider.name;
    const meta = document.createElement("small");
    meta.textContent = provider.disabled ? "wyłączony" : `${provider.models.length} modeli`;
    text.append(name, meta);
    const state = document.createElement("span");
    state.className = `provider-row-state${provider.disabled ? "" : " ready"}`;
    state.textContent = provider.disabled ? "Wyłączony" : "Gotowe";
    row.append(providerLogo(provider.name), text, state);
    row.addEventListener("click", () => editProvider(provider));
    providerList.appendChild(row);
  }
  const available = providerTemplates.filter((template) => {
    const name = field(template, "name");
    return name && name !== "custom" && !providers.some((provider) => provider.name === name);
  });
  if (available.length) {
    const label = document.createElement("div");
    label.className = "provider-group-label";
    label.textContent = "DOSTĘPNE";
    providerList.appendChild(label);
  }
  for (const template of available) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "provider-row template";
    const text = document.createElement("span");
    const name = document.createElement("strong");
    const description = document.createElement("small");
    text.append(name, description);
    row.append(providerLogo(field(template, "name")), text);
    name.textContent = field(template, "name");
    description.textContent = field(template, "desc") || "Gotowy szablon";
    row.addEventListener("click", () => {
      resetProviderForm();
      providerTemplate.value = field(template, "name");
      providerTemplate.dispatchEvent(new Event("change"));
    });
    providerList.appendChild(row);
  }
}

function resetProviderForm() {
  selectedProvider = null;
  providerForm.reset();
  providerTemplate.value = "";
  providerName.disabled = false;
  providerType.value = "openai";
  providerOptions.hidden = true;
  providerModels.hidden = true;
  providerModelSearch.value = "";
  providerModelList.replaceChildren();
  deleteProvider.hidden = true;
  checkProvider.hidden = true;
  document.querySelector("#provider-mode").textContent = "NOWE POŁĄCZENIE";
  document.querySelector("#provider-title").textContent = "Dodaj dostawcę";
  providerHeaderIcon.src = providerLogoSource("custom");
  document.querySelector("#provider-key-hint").textContent = "pozostaw pusty, jeśli serwer go nie wymaga";
  showProviderMessage("Po zapisaniu NestCafe sprawdzi endpoint modeli bez uruchamiania inferencji.");
  renderProviderList();
}

function editProvider(provider) {
  selectedProvider = provider;
  providerTemplate.value = "";
  providerName.value = provider.name;
  providerName.disabled = true;
  providerType.value = provider.type;
  providerUrl.value = provider.baseUrl;
  providerModel.value = provider.model;
  providerKey.value = "";
  providerDisabled.checked = provider.disabled;
  providerClearKey.checked = false;
  providerOptions.hidden = false;
  providerModelSearch.value = "";
  deleteProvider.hidden = false;
  checkProvider.hidden = provider.disabled;
  document.querySelector("#provider-mode").textContent = "KONFIGURACJA";
  document.querySelector("#provider-title").textContent = provider.name;
  providerHeaderIcon.src = providerLogoSource(provider.name);
  document.querySelector("#provider-key-hint").textContent = provider.hasKey
    ? "klucz jest zapisany — wpisz nowy tylko, aby go zastąpić"
    : "brak zapisanego klucza";
  showProviderMessage(provider.disabled ? "Dostawca jest zachowany, ale wyłączony." : "Możesz sprawdzić połączenie bez uruchamiania modelu.");
  renderProviderModels();
  renderProviderList();
  if (!provider.disabled) diagnoseProvider(provider.name);
}

function fillTemplates() {
  providerTemplate.querySelectorAll("option:not(:first-child)").forEach((option) => option.remove());
  for (const template of providerTemplates) {
    const option = document.createElement("option");
    option.value = field(template, "name");
    option.textContent = `${field(template, "name")} — ${field(template, "desc")}`;
    providerTemplate.appendChild(option);
  }
}

async function loadProviders(preferred = "") {
  const [response, catalog] = await Promise.all([
    providerJson("/api/providers"),
    providerJson("/api/models").catch(() => ({ models: [] })),
  ]);
  providers = (response.providers || []).map(providerView);
  providerTemplates = response.templates || [];
  providerModelCatalog = (catalog.models || []).map((model) => ({
    ...model,
    id: String(model.id || ""),
    provider: String(model.provider || ""),
  }));
  fillTemplates();
  const next = providers.find((provider) => provider.name === preferred);
  if (next) editProvider(next);
  else if (selectedProvider) editProvider(providers.find((provider) => provider.name === selectedProvider.name) || providers[0]);
  else renderProviderList();
}

async function diagnoseProvider(name) {
  showProviderMessage("Sprawdzam endpoint modeli…");
  try {
    const result = await providerJson(`/api/provider/diagnostics?name=${encodeURIComponent(name)}`);
    const models = result.models?.length ? `${result.models.length} modeli` : "brak modeli";
    const latency = result.latency_ms ? ` · ${result.latency_ms} ms` : "";
    const endpoint = result.endpoint ? ` · ${result.endpoint}` : "";
    showProviderMessage(`${result.server || "provider"} · ${models}${latency}${endpoint}`, result.status === "online" ? "online" : "offline");
    if (result.status === "online") await reloadProviderModelCatalog();
  } catch (error) {
    showProviderMessage(error.message, "offline");
  }
}

providerTemplate.addEventListener("change", () => {
  const template = providerTemplates.find((item) => field(item, "name") === providerTemplate.value);
  if (!template) return;
  providerName.value = field(template, "name") === "custom" ? "" : field(template, "name");
  providerType.value = field(template, "type") || "openai";
  providerUrl.value = field(template, "baseURL") || field(template, "base_url");
  providerName.focus();
});

providerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setProviderBusy(true);
  try {
    const payload = {
      name: selectedProvider?.name || providerName.value.trim(),
      type: providerType.value,
      base_url: providerUrl.value.trim(),
      model: providerModel.value.trim(),
    };
    if (selectedProvider) {
      payload.disabled = providerDisabled.checked;
      if (providerClearKey.checked) payload.api_key = "";
      else if (providerKey.value) payload.api_key = providerKey.value;
    } else {
      payload.api_key = providerKey.value;
    }
    await providerJson("/api/providers", {
      method: selectedProvider ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadProviders(payload.name);
    await window.NestCafe?.models?.refresh?.();
    await window.NestCafe?.refreshHealth?.();
    window.NestCafe?.toast?.("Konfiguracja dostawcy została zapisana.");
  } catch (error) {
    showProviderMessage(error.message, "offline");
    window.NestCafe?.toast?.(error.message);
  } finally {
    setProviderBusy(false);
  }
});

checkProvider.addEventListener("click", () => selectedProvider && diagnoseProvider(selectedProvider.name));
providerModelSearch.addEventListener("input", renderProviderModels);
providerModelSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") event.preventDefault();
});
providerModelsEnable.addEventListener("click", () => setProviderModelsHidden(false));
providerModelsDisable.addEventListener("click", () => setProviderModelsHidden(true));
deleteProvider.addEventListener("click", async () => {
  if (!selectedProvider || !confirm(`Usunąć dostawcę „${selectedProvider.name}”?`)) return;
  setProviderBusy(true);
  try {
    await providerJson(`/api/providers?name=${encodeURIComponent(selectedProvider.name)}`, { method: "DELETE" });
    resetProviderForm();
    await loadProviders();
    await window.NestCafe?.models?.refresh?.();
  } catch (error) {
    window.NestCafe?.toast?.(error.message);
  } finally {
    setProviderBusy(false);
  }
});

document.querySelector("#provider-button").addEventListener("click", async () => {
  providerDialog.showModal();
  resetProviderForm();
  try { await loadProviders(); } catch (error) { showProviderMessage(error.message, "offline"); }
});
document.querySelector("#close-providers").addEventListener("click", () => providerDialog.close());
document.querySelector("#add-provider").addEventListener("click", resetProviderForm);
