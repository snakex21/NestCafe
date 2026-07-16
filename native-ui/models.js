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
  if (model.tool_use) caps.push("tools");
  if (model.reasoning) caps.push("think");
  if (model.vision) caps.push("vision");
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
    empty.textContent = "Nie znaleziono modeli.";
    modelList.appendChild(empty);
    return;
  }
  for (const model of visible) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `model-row${model.id === activeModel && model.provider === activeProvider ? " active" : ""}`;
    const dot = document.createElement("span");
    dot.className = "dot";
    const identity = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = model.id;
    const provider = document.createElement("small");
    provider.textContent = model.provider || "provider";
    identity.append(name, provider);
    const caps = document.createElement("span");
    caps.className = "caps";
    caps.textContent = modelCapabilities(model);
    row.append(dot, identity, caps);
    row.addEventListener("click", () => selectModel(model));
    modelList.appendChild(row);
  }
}

async function loadModels() {
  const response = await modelJson("/api/models");
  modelCatalog = response.models || [];
  activeModel = response.active || "";
  activeProvider = response.provider || "";
  modelButton.textContent = activeModel && activeModel !== "no model" ? activeModel : "Wybierz model";
  renderModels();
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
    modelDialog.close();
    await window.refreshNestCafeHealth?.();
  } catch (error) {
    const toast = document.querySelector("#toast");
    toast.textContent = error.message;
    toast.hidden = false;
  } finally {
    modelButton.disabled = false;
  }
}

modelButton.addEventListener("click", async () => {
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

modelSearch.addEventListener("input", renderModels);
loadModels().catch(() => {});
window.refreshNestCafeModels = loadModels;
