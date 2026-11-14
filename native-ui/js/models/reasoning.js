"use strict";

const reasoningControl = document.querySelector("#reasoning-control");
const reasoningButton = document.querySelector("#reasoning-button");
const reasoningLevel = document.querySelector("#reasoning-level");
const reasoningMenu = document.querySelector("#reasoning-menu");
const reasoningOptions = document.querySelector("#reasoning-options");
const reasoningEffective = document.querySelector("#reasoning-effective");

// Catalog keys per level; "" is the automatic (engine default) level.
const reasoningLevelKeys = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

function reasoningKey(prefix, level) {
  return `${prefix}.${level === "" ? "auto" : level}`;
}

function reasoningShortLabel(level) {
  if (level === "" || reasoningLevelKeys.includes(level)) return t(reasoningKey("reasoning.short", level));
  return level;
}

let reasoningSaving = false;
let reasoningState = null;

async function reasoningJson(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
  return response.json();
}

function reasoningLabel(level) {
  if (!level) return t("reasoning.level.auto");
  if (reasoningLevelKeys.includes(level)) return t(reasoningKey("reasoning.level", level));
  return level;
}

function renderReasoning(view) {
  reasoningState = view || {};
  const configured = reasoningState.configured || "";
  const effective = reasoningState.effective || configured || "";
  reasoningControl.hidden = false;
  reasoningLevel.textContent = reasoningShortLabel(configured);
  reasoningButton.classList.toggle("active", !!configured);
  reasoningButton.title = reasoningState.adjusted
    ? t("reasoning.button.titleAdjusted", { level: reasoningLabel(configured), effective: reasoningLabel(effective) })
    : t("reasoning.button.title", { level: reasoningLabel(configured) });
  reasoningEffective.textContent = reasoningState.adjusted
    ? t("reasoning.effective.adjusted", { level: reasoningLabel(configured), effective: reasoningLabel(effective) })
    : t("reasoning.effective.active", { level: reasoningLabel(effective) });

  const choices = [{ value: "", label: reasoningLabel("") }];
  for (const level of reasoningState.levels || []) {
    if (!choices.some((choice) => choice.value === level)) {
      choices.push({ value: level, label: reasoningLabel(level) });
    }
  }
  reasoningOptions.replaceChildren();
  for (const choice of choices) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = `reasoning-option${choice.value === configured ? " selected" : ""}`;
    option.dataset.level = choice.value;
    option.setAttribute("role", "menuitemradio");
    option.setAttribute("aria-checked", choice.value === configured ? "true" : "false");
    option.tabIndex = choice.value === configured ? 0 : -1;
    const check = document.createElement("span");
    check.className = "reasoning-check";
    check.textContent = "◆";
    const label = document.createElement("span");
    label.textContent = choice.label;
    option.append(check, label);
    reasoningOptions.appendChild(option);
  }
}

async function loadReasoning() {
  try {
    renderReasoning(await reasoningJson("/api/reasoning"));
  } catch (error) {
    window.NestCafe?.toast?.(t("reasoning.toast.loadFailed", { error: error.message }));
  }
}

function toggleReasoningMenu(show) {
  const want = show === undefined ? reasoningMenu.hidden : show;
  reasoningMenu.hidden = !want;
  reasoningButton.setAttribute("aria-expanded", want ? "true" : "false");
  if (want) {
    setTimeout(() => {
      reasoningOptions.querySelector(".selected")?.focus();
    }, 0);
  }
}

reasoningButton.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!reasoningSaving) toggleReasoningMenu();
});

reasoningOptions.addEventListener("click", async (event) => {
  const option = event.target.closest("button[data-level]");
  if (!option || reasoningSaving) return;
  reasoningSaving = true;
  toggleReasoningMenu(false);
  reasoningButton.setAttribute("aria-busy", "true");
  reasoningButton.focus();
  try {
    const view = await reasoningJson("/api/reasoning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: option.dataset.level || "default" }),
    });
    renderReasoning(view);
  } catch (error) {
    window.NestCafe?.toast?.(error.message);
    renderReasoning(reasoningState);
  } finally {
    reasoningSaving = false;
    reasoningButton.removeAttribute("aria-busy");
  }
});

reasoningMenu.addEventListener("keydown", (event) => {
  const options = [...reasoningOptions.querySelectorAll(".reasoning-option")];
  if (!options.length) return;
  let index = options.indexOf(document.activeElement);
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    toggleReasoningMenu(false);
    reasoningButton.focus();
    return;
  }
  if (!["Home", "End", "ArrowDown", "ArrowUp"].includes(event.key)) return;
  event.preventDefault();
  if (event.key === "Home") index = 0;
  else if (event.key === "End") index = options.length - 1;
  else if (event.key === "ArrowDown") index = (index + 1 + options.length) % options.length;
  else index = (index - 1 + options.length) % options.length;
  options[index].focus();
});

document.addEventListener("click", (event) => {
  if (!reasoningControl.contains(event.target)) toggleReasoningMenu(false);
});

window.addEventListener("nestcafe:model-changed", loadReasoning);
loadReasoning();

window.NestCafe.export("reasoning", {
  refresh: loadReasoning,
  state: () => reasoningState ? { ...reasoningState } : null,
});
