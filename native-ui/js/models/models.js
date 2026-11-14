"use strict";

const modelDialog = document.querySelector("#model-dialog");
const modelButton = document.querySelector("#model-button");
const modelSearch = document.querySelector("#model-search");
const modelList = document.querySelector("#model-list");
const modelButtonLabel = document.querySelector("#model-button-label");

let modelCatalog = [];
let activeModel = "";
let activeProvider = "";
let modelSelectionPending = false;
let modelLoadSeq = 0;

// Display names for well-known provider/template ids. The stored id stays
// unchanged; only what the user sees is prettified.
const PROVIDER_DISPLAY_NAMES = {
  openai: "OpenAI", anthropic: "Anthropic", claude: "Claude", google: "Google Gemini",
  gemini: "Gemini", deepseek: "DeepSeek", openrouter: "OpenRouter", anyrouter: "AnyRouter",
  ollama: "Ollama", lmstudio: "LM Studio", mistral: "Mistral", groq: "Groq", xai: "xAI",
  opencode: "OpenCode", "opencode-go": "OpenCode Go", zen: "OpenCode Zen", codex: "Codex",
  kilo: "Kilo", kilocode: "Kilo Code", together: "Together AI", huggingface: "Hugging Face",
  perplexity: "Perplexity", fireworks: "Fireworks", cerebras: "Cerebras", cohere: "Cohere",
  nvidia: "NVIDIA", novita: "Novita", chutes: "Chutes", venice: "Venice", lepton: "Lepton AI",
  zhipu: "Zhipu", moonshot: "Moonshot", dashscope: "DashScope", doubao: "Doubao",
  stepfun: "StepFun", yi: "01.AI Yi", xiaomi: "Xiaomi MiMo", minimax: "MiniMax",
  deepinfra: "DeepInfra", siliconflow: "SiliconFlow", baichuan: "Baichuan",
  tencent: "Tencent Hunyuan", featherless: "Featherless", iflytek: "iFlytek",
  qianfan: "Baidu Qianfan", sensenova: "SenseNova", cline: "Cline", nous: "Nous Portal",
  azure: "Azure OpenAI", bedrock: "Amazon Bedrock", vertex: "Vertex AI", litellm: "LiteLLM",
};

function providerDisplayName(name) {
  const raw = String(name || "").trim();
  return PROVIDER_DISPLAY_NAMES[raw.toLowerCase()] || raw;
}

function compactModelName(model) {
  const original = String(model || "").trim();
  if (!original || original === "no model") return t("models.button.choose");
  let name = original.split("/").pop() || original;
  name = name
    .replace(/[-_:](?:contributor[-_:])?free$/i, "")
    .replace(/[-_:](?:preview|latest)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return name.split(/\s+/).map((part) => {
    if (/^\d|\d$/.test(part)) return part.toUpperCase();
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(" ");
}

function setModelButton(model, provider) {
  modelButtonLabel.textContent = compactModelName(model);
  modelButton.title = provider ? `${model} · ${providerDisplayName(provider)}` : model || t("models.button.choose");
}

async function modelJson(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
  return response.json();
}

function modelCapabilities(model) {
  const caps = [];
  if (model.reasoning) caps.push(t("models.caps.think"));
  return caps.join(" · ");
}

function addProviderButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary-button model-empty-action";
  button.textContent = t("models.list.addProvider");
  button.addEventListener("click", () => {
    if (modelDialog.open) modelDialog.close();
    document.querySelector("#provider-button")?.click();
  });
  return button;
}

function renderModelsLoading() {
  const loading = document.createElement("div");
  loading.className = "model-empty model-loading";
  loading.setAttribute("aria-busy", "true");
  loading.textContent = t("models.list.loading");
  modelList.replaceChildren(loading);
}

function renderModels() {
  const query = modelSearch.value.trim().toLowerCase();
  const visible = modelCatalog.filter((model) => {
    if (model.hidden) return false;
    const haystack = `${model.provider} ${model.id}`.toLowerCase();
    return !query || haystack.includes(query);
  });
  modelList.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "model-empty";
    if (query) {
      empty.textContent = t("models.list.noResults");
    } else {
      const message = document.createElement("p");
      message.textContent = t("models.list.noModels");
      empty.append(message, addProviderButton());
    }
    modelList.appendChild(empty);
    return;
  }
  for (const model of visible) {
    const row = document.createElement("button");
    row.type = "button";
    row.disabled = modelSelectionPending;
    row.className = `model-row${model.id === activeModel && model.provider === activeProvider ? " active" : ""}`;
    const identity = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = model.id;
    const provider = document.createElement("small");
    provider.textContent = model.provider ? providerDisplayName(model.provider) : t("models.list.providerFallback");
    identity.append(name, provider);
    const caps = document.createElement("span");
    caps.className = "caps";
    caps.textContent = modelCapabilities(model);
    row.append(identity, caps);
    row.addEventListener("click", () => selectModel(model));
    modelList.appendChild(row);
  }
}

async function loadModels() {
  if (modelSelectionPending) return false;
  const sequence = ++modelLoadSeq;
  renderModelsLoading();
  let response;
  try {
    response = await modelJson("/api/models");
  } catch (error) {
    if (sequence !== modelLoadSeq || modelSelectionPending) return false;
    throw error;
  }
  if (sequence !== modelLoadSeq || modelSelectionPending) return false;
  modelCatalog = response.models || [];
  activeModel = response.active || "";
  activeProvider = response.provider || "";
  setModelButton(activeModel, activeProvider);
  renderModels();
  window.dispatchEvent(new CustomEvent("nestcafe:model-changed", { detail: getActiveModel() }));
  return true;
}

function setModelBusy(busy) {
  modelSelectionPending = busy;
  modelButton.disabled = busy;
  modelSearch.disabled = busy;
  modelList.querySelectorAll(".model-row").forEach((row) => { row.disabled = busy; });
}

async function selectModel(model) {
  if (modelSelectionPending) return;
  // Ignore catalogs requested before this mutation and prevent overlapping saves.
  modelLoadSeq += 1;
  setModelBusy(true);
  try {
    const result = await modelJson("/api/model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model.id, provider: model.provider || "" }),
    });
    activeModel = result?.model || model.id;
    activeProvider = model.provider || "";
    setModelButton(activeModel, activeProvider);
    modelDialog.close();
    window.dispatchEvent(new CustomEvent("nestcafe:model-changed", { detail: getActiveModel() }));
    await window.NestCafe?.refreshHealth?.();
  } catch (error) {
    const toast = document.querySelector("#toast");
    toast.textContent = error.message;
    toast.hidden = false;
  } finally {
    setModelBusy(false);
  }
}

function positionModelMenu() {
  const scale = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--nc-ui-scale"),
  ) || 1;
  const physicalRect = modelButton.getBoundingClientRect();
  const rect = {
    top: physicalRect.top / scale,
    right: physicalRect.right / scale,
    bottom: physicalRect.bottom / scale,
  };
  const viewportWidth = window.innerWidth / scale;
  const viewportHeight = window.innerHeight / scale;
  const gutter = 12;
  const gap = 8;
  const width = Math.min(420, viewportWidth - gutter * 2);
  const below = viewportHeight - rect.bottom - gutter - gap;
  const above = rect.top - gutter - gap;
  const openBelow = below >= Math.min(330, above);
  const available = Math.max(0, openBelow ? below : above);
  const viewportLimit = Math.max(160, viewportHeight - gutter * 2);
  let maxHeight = Math.min(440, available, viewportLimit);
  let top;

  // With very little room the panel becomes an overlay inside the viewport
  // instead of spilling below the bottom edge of the app.
  if (maxHeight < Math.min(220, viewportLimit)) {
    maxHeight = Math.min(440, viewportLimit);
    top = Math.max(gutter, (viewportHeight - maxHeight) / 2);
  } else {
    top = openBelow
      ? rect.bottom + gap
      : Math.max(gutter, rect.top - maxHeight - gap);
  }
  const left = Math.min(
    viewportWidth - width - gutter,
    Math.max(gutter, rect.right - width),
  );
  modelDialog.style.setProperty("--model-menu-left", `${left}px`);
  modelDialog.style.setProperty("--model-menu-top", `${top}px`);
  modelDialog.style.setProperty("--model-menu-max-height", `${maxHeight}px`);
}

function getActiveModel() {
  return modelCatalog.find((model) => model.id === activeModel && model.provider === activeProvider)
    || modelCatalog.find((model) => model.id === activeModel)
    || null;
}

modelButton.addEventListener("click", async () => {
  positionModelMenu();
  // Open first with a lightweight placeholder so there is never a bare backdrop.
  if (!modelCatalog.length) renderModelsLoading();
  modelDialog.showModal();
  modelSearch.value = "";
  try {
    if (await loadModels() && modelDialog.open) modelSearch.focus();
  } catch (error) {
    const empty = document.createElement("div");
    empty.className = "model-empty";
    empty.textContent = error.message;
    modelList.replaceChildren(empty);
  }
});

modelDialog.addEventListener("click", (event) => {
  if (event.target === modelDialog) modelDialog.close();
});
window.addEventListener("resize", () => {
  if (modelDialog.open) positionModelMenu();
});
window.addEventListener("nestcafe:appearance-changed", () => {
  if (modelDialog.open) positionModelMenu();
});
modelSearch.addEventListener("input", renderModels);
loadModels().catch(() => {});
const modelsApi = {
  refresh: loadModels,
  getActive: getActiveModel,
  list: () => modelCatalog.map((model) => ({ ...model })),
  providerDisplayName,
};
window.NestCafe.export("models", modelsApi);
// Flat aliases (export() binds the object, not these function names).
