"use strict";

const modelDialog = document.querySelector("#model-dialog");
const modelButton = document.querySelector("#model-button");
const modelSearch = document.querySelector("#model-search");
const modelList = document.querySelector("#model-list");

let modelCatalog = [];
let activeModel = "";
let activeProvider = "";

async function modelJson(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
  return response.json();
}

function modelCapabilities(model) {
  const caps = [];
  if (model.reasoning) caps.push("think");
  return caps.join(" · ");
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
    empty.textContent = query
      ? "Brak wyników dla tego wyszukiwania."
      : "Brak modeli. Dodaj dostawcę w Ustawieniach.";
    modelList.appendChild(empty);
    return;
  }
  for (const model of visible) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `model-row${model.id === activeModel && model.provider === activeProvider ? " active" : ""}`;
    const identity = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = model.id;
    const provider = document.createElement("small");
    provider.textContent = model.provider || "provider";
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
  modelList.innerHTML = `<div class="model-empty">Ładowanie modeli…</div>`;
  const response = await modelJson("/api/models");
  modelCatalog = response.models || [];
  activeModel = response.active || "";
  activeProvider = response.provider || "";
  modelButton.textContent = activeModel && activeModel !== "no model" ? activeModel : "Wybierz model";
  modelButton.title = activeProvider ? `${activeModel} · ${activeProvider}` : activeModel || "Wybierz model";
  renderModels();
  window.dispatchEvent(new CustomEvent("nestcafe:model-changed", { detail: getActiveModel() }));
}

async function selectModel(model) {
  try {
    modelButton.disabled = true;
    await modelJson("/api/model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model.id, provider: model.provider || "" }),
    });
    activeModel = model.id;
    activeProvider = model.provider || "";
    modelButton.textContent = model.id;
    modelButton.title = activeProvider ? `${model.id} · ${activeProvider}` : model.id;
    modelDialog.close();
    window.dispatchEvent(new CustomEvent("nestcafe:model-changed", { detail: getActiveModel() }));
    await window.NestCafe?.refreshHealth?.();
  } catch (error) {
    const toast = document.querySelector("#toast");
    toast.textContent = error.message;
    toast.hidden = false;
  } finally {
    modelButton.disabled = false;
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

  // Przy bardzo małej ilości miejsca panel staje się nakładką w obrębie
  // viewportu zamiast wychodzić pod dolną krawędź aplikacji.
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
  modelDialog.showModal();
  modelSearch.value = "";
  try {
    await loadModels();
    modelSearch.focus();
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
};
window.NestCafe.export("models", modelsApi);
// Flat aliases (export() binds the object, not these function names).
