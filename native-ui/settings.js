"use strict";

const settingsDialog = document.querySelector("#provider-dialog");
const settingsModelDialog = document.querySelector("#model-dialog");
const settingsSkillsDialog = document.querySelector("#skills-dialog");
const settingsPlanDialog = document.querySelector("#plan-dialog");
const settingsModelButton = document.querySelector("#model-button");
const settingsProviderButton = document.querySelector("#provider-button");
const settingsProviderList = document.querySelector("#provider-list");
const settingsProviderSidebar = document.querySelector(".provider-sidebar");

document.querySelector(".provider-dialog-head h2").textContent = "Dostawcy";
document.querySelector("#add-provider").textContent = "+";

function createSettingsNavigation(active) {
  const navigation = document.createElement("aside");
  navigation.className = "settings-navigation";
  navigation.innerHTML = `
    <div class="settings-brand"><img src="nestcafe-icon.png" alt="" /><strong>NestCafe</strong></div>
    <button type="button" data-settings-action="back">Wróć do czatu</button>
    <nav>
      <button type="button" data-settings-action="providers">Dostawcy</button>
      <button type="button" data-settings-action="models">Modele</button>
      <button type="button" data-settings-action="plan">Plan pracy</button>
      <button type="button" data-settings-action="memory">Pamięć</button>
      <hr />
      <button type="button" data-settings-action="workspace">Folder roboczy</button>
      <button class="settings-secondary" type="button" data-settings-action="skills">Umiejętności</button>
      <button class="settings-secondary" type="button" data-settings-action="about">O programie</button>
    </nav>`;
  navigation.querySelector(`[data-settings-action="${active}"]`)?.classList.add("active");
  return navigation;
}

const settingsNavigation = createSettingsNavigation("providers");
const modelSettingsNavigation = createSettingsNavigation("models");
const skillSettingsNavigation = createSettingsNavigation("skills");
const planSettingsNavigation = createSettingsNavigation("plan");
settingsDialog.prepend(settingsNavigation);
settingsModelDialog.prepend(modelSettingsNavigation);
settingsSkillsDialog.prepend(skillSettingsNavigation);
settingsPlanDialog.prepend(planSettingsNavigation);

const providerBrowseHead = document.createElement("div");
providerBrowseHead.className = "provider-browse-head";
providerBrowseHead.innerHTML = `
  <div><strong>Dostawcy</strong><span>Wybierz dostawcę do konfiguracji.</span></div>
  <input type="search" placeholder="Szukaj dostawców…" aria-label="Szukaj dostawców" />`;
settingsProviderSidebar.prepend(providerBrowseHead);

const providerEmptyState = document.createElement("div");
providerEmptyState.className = "provider-empty-state";
providerEmptyState.innerHTML = `<strong>Wybierz dostawcę</strong><span>Wybierz połączenie z listy, aby zmienić jego ustawienia.</span>`;
document.querySelector(".provider-layout").appendChild(providerEmptyState);

function setPlanNavigation(page) {
  planSettingsNavigation.querySelectorAll("nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsAction === page);
  });
}

window.setNestCafePlanNavigation = setPlanNavigation;

function openPlanPage(page, currentDialog) {
  currentDialog.close();
  setPlanNavigation(page);
  window.openNestCafePlan?.(page === "memory" ? "memory" : "goal");
}

function handleSettingsNavigation(event, currentDialog) {
  const action = event.target.closest("[data-settings-action]")?.dataset.settingsAction;
  if (!action) return;
  if (action === "back") currentDialog.close();
  if (action === "providers" && currentDialog !== settingsDialog) {
    currentDialog.close();
    settingsProviderButton.click();
  }
  if (action === "models" && currentDialog !== settingsModelDialog) {
    currentDialog.close();
    settingsModelButton.click();
  }
  if (action === "skills" && currentDialog !== settingsSkillsDialog) {
    currentDialog.close();
    settingsSkillsDialog.showModal();
    window.loadNestCafeSkills?.();
  }
  if (action === "workspace") {
    currentDialog.close();
    document.querySelector("#workspace-button").click();
  }
  if (action === "plan" || action === "memory") openPlanPage(action, currentDialog);
  if (action === "about") {
    currentDialog.close();
    window.showNestCafeToast?.("NestCafe korzysta z lekkiego silnika SuperCli.");
  }
}

for (const [navigation, dialog] of [
  [settingsNavigation, settingsDialog],
  [modelSettingsNavigation, settingsModelDialog],
  [skillSettingsNavigation, settingsSkillsDialog],
  [planSettingsNavigation, settingsPlanDialog],
]) {
  navigation.addEventListener("click", (event) => handleSettingsNavigation(event, dialog));
}

providerBrowseHead.querySelector("input").addEventListener("input", (event) => {
  const query = event.target.value.trim().toLowerCase();
  settingsProviderList.querySelectorAll(".provider-row").forEach((row) => {
    row.hidden = query && !row.textContent.toLowerCase().includes(query);
  });
});

settingsProviderButton.addEventListener("click", () => {
  settingsDialog.classList.add("no-selection");
  providerBrowseHead.querySelector("input").value = "";
});
document.querySelector("#add-provider").addEventListener("click", () => settingsDialog.classList.remove("no-selection"));
settingsProviderList.addEventListener("click", (event) => {
  if (event.target.closest(".provider-row")) settingsDialog.classList.remove("no-selection");
});
document.querySelector("#module-add")?.addEventListener("click", () => {
  settingsSkillsDialog.showModal();
  window.loadNestCafeSkills?.();
});
