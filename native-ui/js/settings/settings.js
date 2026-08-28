"use strict";

const settingsDialog = document.querySelector("#provider-dialog");
const settingsModelDialog = document.querySelector("#model-dialog");
const settingsSkillsDialog = document.querySelector("#skills-dialog");
const settingsPlanDialog = document.querySelector("#plan-dialog");
const settingsModelButton = document.querySelector("#model-button");
const settingsProviderButton = document.querySelector("#provider-button");
const settingsProviderList = document.querySelector("#provider-list");
const settingsProviderSidebar = document.querySelector(".provider-sidebar");
const settingsProviderForm = document.querySelector("#provider-form");

document.querySelector(".provider-dialog-head h2").textContent = "Dostawcy";
document.querySelector("#add-provider").textContent = "+ Dodaj";

const settingsNavigationItems = [
  ["providers", "◇", "Dostawcy"],
  ["models", "◫", "Modele i kontekst"],
  ["skills", "ϟ", "Umiejętności"],
  ["plan", "◎", "Plan pracy"],
  ["integrations", "○", "Integracje"],
  ["scheduler", "◷", "Harmonogram"],
  ["memory", "▤", "Pamięć"],
  ["instructions", "≡", "Instrukcje AI"],
  ["folders", "⌕", "Pliki i foldery"],
  ["workspaces", "⌂", "Przestrzenie"],
  ["general", "⚙", "Ogólne"],
  ["about", "ⓘ", "O programie"],
];

function createSettingsNavigation(active) {
  const navigation = document.createElement("aside");
  navigation.className = "settings-navigation";
  navigation.innerHTML = `
    <div class="settings-brand"><img src="assets/nestcafe-icon.png" alt="" /><strong>NestCafe</strong></div>
    <button class="settings-back" type="button" data-settings-action="back"><span aria-hidden="true">←</span> Wróć do czatu</button>
    <nav>
      ${settingsNavigationItems
        .map(
          ([action, icon, label]) =>
            `<button type="button" data-settings-action="${action}"><span class="settings-nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`,
        )
        .join("")}
    </nav>`;
  navigation.querySelector(`[data-settings-action="${active}"]`)?.classList.add("active");
  return navigation;
}

const settingsAboutDialog = document.createElement("dialog");
settingsAboutDialog.className = "about-dialog";
settingsAboutDialog.id = "about-dialog";
settingsAboutDialog.innerHTML = `
  <header class="about-head">
    <h2>O programie</h2>
    <button type="button" aria-label="Zamknij">×</button>
  </header>
  <section class="about-content">
    <div class="about-identity">
      <img src="assets/nestcafe-icon.png" alt="" />
      <div><h3>NestCafe</h3><p>Spokojne miejsce do pracy z dokumentami i agentem AI.</p></div>
    </div>
    <p class="about-copy">NestCafe korzysta z lekkiego silnika SuperCli. Interfejs, rozmowy, narzędzia, pamięć i dostawcy modeli działają lokalnie w jednej aplikacji.</p>
    <div class="about-facts">
      <div class="about-fact"><span>Wersja</span><strong id="about-version">…</strong></div>
      <div class="about-fact"><span>Silnik</span><strong id="about-engine">SuperCli</strong></div>
      <div class="about-fact"><span>Tryb aplikacji</span><strong>Natywna aplikacja Windows</strong></div>
      <div class="about-fact"><span>Język UI</span><strong id="about-language">…</strong></div>
      <div class="about-fact"><span>Aktywny model</span><strong id="about-model">Sprawdzam…</strong></div>
      <div class="about-fact"><span>Katalog techniczny</span><strong id="about-workspace">Sprawdzam…</strong></div>
    </div>
    <p class="about-copy">Dane aplikacji są przechowywane przenośnie obok programu w folderze <code>supercli-data</code>.</p>
  </section>`;
document.body.appendChild(settingsAboutDialog);

const settingsNavigation = createSettingsNavigation("providers");
const skillSettingsNavigation = createSettingsNavigation("skills");
const planSettingsNavigation = createSettingsNavigation("plan");
const aboutSettingsNavigation = createSettingsNavigation("about");
settingsDialog.prepend(settingsNavigation);
settingsSkillsDialog.prepend(skillSettingsNavigation);
settingsPlanDialog.prepend(planSettingsNavigation);
settingsAboutDialog.prepend(aboutSettingsNavigation);

const providerBrowseHead = document.createElement("div");
providerBrowseHead.className = "provider-browse-head";
providerBrowseHead.innerHTML = `
  <div class="provider-browse-title"><div><strong>Dostawcy</strong><span>Wybierz dostawcę do konfiguracji.</span></div></div>
  <input type="search" placeholder="Szukaj dostawców…" aria-label="Szukaj dostawców" />`;
settingsProviderSidebar.prepend(providerBrowseHead);
providerBrowseHead.querySelector(".provider-browse-title").append(document.querySelector("#add-provider"));

const providerEmptyState = document.createElement("div");
providerEmptyState.className = "provider-empty-state";
providerEmptyState.innerHTML = `<strong>Wybierz dostawcę</strong><span>Wybierz połączenie z listy, aby zmienić jego ustawienia.</span>`;
document.querySelector(".provider-layout").appendChild(providerEmptyState);

const providerMobileBack = document.createElement("button");
providerMobileBack.className = "provider-mobile-back";
providerMobileBack.type = "button";
providerMobileBack.textContent = "← Wróć do listy dostawców";
settingsProviderForm.prepend(providerMobileBack);
providerMobileBack.addEventListener("click", () => settingsDialog.classList.add("no-selection"));

async function loadAboutDetails() {
  const versionApi = window.NestCafe?.version;
  const i18n = window.NestCafe?.i18n;
  try {
    const product = (await versionApi?.load?.()) || versionApi?.get?.() || { version: "dev" };
    settingsAboutDialog.querySelector("#about-version").textContent =
      product.version || "dev";
  } catch {
    settingsAboutDialog.querySelector("#about-version").textContent = "dev";
  }

  try {
    const settingsResponse = await fetch("/api/settings", { cache: "no-store" });
    const settingsPayload = settingsResponse.ok ? await settingsResponse.json() : {};
    const langCode =
      i18n?.normalize?.(settingsPayload.settings?.["ui.lang"]) ||
      i18n?.detectSystem?.() ||
      document.documentElement.lang ||
      "en";
    settingsAboutDialog.querySelector("#about-language").textContent =
      i18n?.labelFor?.(langCode) || langCode;
  } catch {
    settingsAboutDialog.querySelector("#about-language").textContent =
      document.documentElement.lang || "—";
  }

  try {
    const [healthResponse, runtimeResponse] = await Promise.all([
      fetch("/api/health"),
      fetch("/api/runtime"),
    ]);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      settingsAboutDialog.querySelector("#about-model").textContent =
        health.model || "Nie wybrano";
      settingsAboutDialog.querySelector("#about-workspace").textContent =
        health.home || "Nie wybrano";
    } else {
      throw new Error(`HTTP ${healthResponse.status}`);
    }
    if (runtimeResponse.ok) {
      const runtime = await runtimeResponse.json();
      const engineVersion = runtime.version ? ` ${runtime.version}` : "";
      settingsAboutDialog.querySelector("#about-engine").textContent =
        `${runtime.engine || "SuperCli"}${engineVersion}`.trim();
    }
  } catch {
    settingsAboutDialog.querySelector("#about-model").textContent = "Brak połączenia";
    settingsAboutDialog.querySelector("#about-workspace").textContent = "Brak połączenia";
  }
}

function setPlanNavigation(page) {
  planSettingsNavigation.querySelectorAll("nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsAction === page);
  });
}

function openPlanPage(page, currentDialog) {
  currentDialog.close();
  setPlanNavigation(page);
  window.NestCafe?.plan?.open?.(page === "memory" ? "memory" : "goal");
}

function handleSettingsNavigation(event, currentDialog) {
  const action = event.target.closest("[data-settings-action]")?.dataset.settingsAction;
  if (!action) return;

  if (action === "back") {
    currentDialog.close();
    return;
  }

  if (action === "providers" && currentDialog !== settingsDialog) {
    // Otwórz następny widok zanim zamkniemy poprzedni, żeby czat nie mignął pod spodem.
    settingsProviderButton.click();
    if (currentDialog.open) currentDialog.close();
    return;
  }

  if (action === "skills" && currentDialog !== settingsSkillsDialog) {
    if (!settingsSkillsDialog.open) settingsSkillsDialog.showModal();
    window.NestCafe?.skills?.load?.();
    if (currentDialog.open) currentDialog.close();
    return;
  }

  if (action === "about" && currentDialog !== settingsAboutDialog) {
    if (!settingsAboutDialog.open) settingsAboutDialog.showModal();
    loadAboutDetails();
    if (currentDialog.open) currentDialog.close();
    return;
  }

  if (
    ["models", "plan", "integrations", "scheduler", "memory", "instructions", "folders", "workspaces", "general"].includes(
      action,
    )
  ) {
    // Przejścia między zwykłymi stronami ustawień odbywają się w tym samym dialogu.
    if (currentDialog?.id === "settings-page-dialog") {
      window.NestCafe?.settings?.openPage?.(action);
      return;
    }

    // openPage() wywołuje showModal() synchronicznie przed pierwszym await.
    window.NestCafe?.settings?.openPage?.(action);
    if (currentDialog.open) currentDialog.close();
  }
}

for (const [navigation, dialog] of [
  [settingsNavigation, settingsDialog],
  [skillSettingsNavigation, settingsSkillsDialog],
  [planSettingsNavigation, settingsPlanDialog],
  [aboutSettingsNavigation, settingsAboutDialog],
]) {
  navigation.addEventListener("click", (event) => handleSettingsNavigation(event, dialog));
}

settingsAboutDialog.querySelector(".about-head button").addEventListener("click", () => settingsAboutDialog.close());

const settingsApi = {
  createNavigation: createSettingsNavigation,
  handleNavigation: handleSettingsNavigation,
  setPlanNavigation,
};
window.NestCafe.export("settings", settingsApi);

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
  window.NestCafe?.modules?.load?.();
  settingsSkillsDialog.showModal();
  window.NestCafe?.skills?.load?.();
});
