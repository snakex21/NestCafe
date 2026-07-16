"use strict";

const settingsDialog = document.querySelector("#provider-dialog");
const settingsModelDialog = document.querySelector("#model-dialog");
const settingsModelButton = document.querySelector("#model-button");
const settingsProviderButton = document.querySelector("#provider-button");
const settingsProviderList = document.querySelector("#provider-list");
const settingsProviderSidebar = document.querySelector(".provider-sidebar");
document.querySelector(".provider-dialog-head h2").textContent = "Dostawcy";
document.querySelector("#add-provider").textContent = "+";

const settingsNavigation = document.createElement("aside");
settingsNavigation.className = "settings-navigation";
settingsNavigation.innerHTML = `
  <div class="settings-brand"><img src="nestcafe-icon.png" alt="" /><strong>NestCafe</strong></div>
  <button type="button" data-settings-action="back">▣&nbsp; Wróć do czatu</button>
  <nav>
    <button class="active" type="button" data-settings-action="providers">⌕&nbsp; Dostawcy</button>
    <button type="button" data-settings-action="models">◇&nbsp; Modele</button>
    <button type="button" data-settings-action="skills" disabled>ϟ&nbsp; Umiejętności <small>wkrótce</small></button>
    <button type="button" data-settings-action="workspace">□&nbsp; Przestrzenie robocze</button>
    <button type="button" data-settings-action="plan">◎&nbsp; Plan pracy</button>
    <button type="button" data-settings-action="memory">◫&nbsp; Pamięć</button>
    <button type="button" data-settings-action="about">ⓘ&nbsp; O programie</button>
  </nav>`;
settingsDialog.prepend(settingsNavigation);

const modelSettingsNavigation = settingsNavigation.cloneNode(true);
modelSettingsNavigation.querySelectorAll("nav button").forEach((button) => button.classList.remove("active"));
modelSettingsNavigation.querySelector('[data-settings-action="models"]').classList.add("active");
settingsModelDialog.prepend(modelSettingsNavigation);

const providerBrowseHead = document.createElement("div");
providerBrowseHead.className = "provider-browse-head";
providerBrowseHead.innerHTML = `
  <div><strong>Dostawcy</strong><span>Wybierz dostawcę do konfiguracji.</span></div>
  <input type="search" placeholder="Szukaj dostawców…" aria-label="Szukaj dostawców" />`;
settingsProviderSidebar.prepend(providerBrowseHead);

const providerEmptyState = document.createElement("div");
providerEmptyState.className = "provider-empty-state";
providerEmptyState.innerHTML = `<strong>Wybierz dostawcę</strong><span>Wybierz dostawcę z listy, aby skonfigurować właściwości połączenia i model.</span>`;
document.querySelector(".provider-layout").appendChild(providerEmptyState);

function openPlanTab(name, currentDialog) {
  currentDialog.close();
  document.querySelector("#plan-button").click();
  setTimeout(() => document.querySelector(`[data-plan-tab="${name}"]`)?.click(), 0);
}

function handleSettingsNavigation(event, currentDialog) {
  const action = event.target.closest("[data-settings-action]")?.dataset.settingsAction;
  if (!action) return;
  if (action === "back") currentDialog.close();
  if (action === "providers" && currentDialog !== settingsDialog) {
    currentDialog.close();
    settingsProviderButton.click();
  }
  if (action === "models") {
    if (currentDialog === settingsModelDialog) return;
    currentDialog.close();
    settingsModelButton.click();
  }
  if (action === "workspace") {
    currentDialog.close();
    document.querySelector("#workspace-button").click();
  }
  if (action === "plan") openPlanTab("goal", currentDialog);
  if (action === "memory") openPlanTab("memory", currentDialog);
  if (action === "about") {
    currentDialog.close();
    window.showNestCafeToast?.("NestCafe korzysta z lekkiego silnika SuperCli.");
  }
}

settingsNavigation.addEventListener("click", (event) => handleSettingsNavigation(event, settingsDialog));
modelSettingsNavigation.addEventListener("click", (event) => handleSettingsNavigation(event, settingsModelDialog));

providerBrowseHead.querySelector("input").addEventListener("input", (event) => {
  const query = event.target.value.trim().toLowerCase();
  settingsProviderList.querySelectorAll(".provider-row").forEach((row) => {
    row.hidden = query && !row.textContent.toLowerCase().includes(query);
  });
});

document.querySelector("#provider-button").addEventListener("click", () => {
  settingsDialog.classList.add("no-selection");
  providerBrowseHead.querySelector("input").value = "";
});
document.querySelector("#add-provider").addEventListener("click", () => settingsDialog.classList.remove("no-selection"));
settingsProviderList.addEventListener("click", (event) => {
  if (event.target.closest(".provider-row")) settingsDialog.classList.remove("no-selection");
});
