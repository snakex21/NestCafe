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

document.querySelector(".provider-dialog-head h2").textContent = t("settings.nav.providers");
document.querySelector("#add-provider").textContent = t("settings.providers.add");

const settingsNavigationItems = [
  ["providers", "◇", t("settings.nav.providers")],
  ["models", "◫", t("settings.nav.models")],
  ["skills", "ϟ", t("settings.nav.skills")],
  ["plan", "◎", t("settings.nav.plan")],
  ["integrations", "○", t("settings.nav.integrations")],
  ["scheduler", "◷", t("settings.nav.scheduler")],
  ["memory", "▤", t("settings.nav.memory")],
  ["instructions", "≡", t("settings.nav.instructions")],
  ["folders", "⌕", t("settings.nav.folders")],
  ["workspaces", "⌂", t("settings.nav.workspaces")],
  ["general", "⚙", t("settings.nav.general")],
  ["about", "ⓘ", t("settings.nav.about")],
];

function createSettingsNavigation(active) {
  const navigation = document.createElement("aside");
  navigation.className = "settings-navigation";
  navigation.innerHTML = `
    <div class="settings-brand"><img src="assets/nestcafe-icon.png" alt="" /><strong>NestCafe</strong></div>
    <button class="settings-back" type="button" data-settings-action="back"><span aria-hidden="true">←</span> ${t("common.backToChat")}</button>
    <nav aria-label="${t("settings.nav.label")}">
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
    <h2>${t("settings.nav.about")}</h2>
    <button type="button" aria-label="${t("common.close")}">×</button>
  </header>
  <section class="about-content">
    <div class="about-identity">
      <img src="assets/nestcafe-icon.png" alt="" />
      <div><h3>NestCafe</h3><p>${t("settings.about.tagline")}</p></div>
    </div>
    <p class="about-copy">${t("settings.about.engineCopy")}</p>
    <div class="about-facts">
      <div class="about-fact"><span>${t("settings.about.version")}</span><strong id="about-version">…</strong></div>
      <div class="about-fact"><span>${t("settings.about.engine")}</span><strong id="about-engine">SuperCli</strong></div>
      <div class="about-fact"><span>${t("settings.about.appMode")}</span><strong>${t("settings.about.appModeNative")}</strong></div>
      <div class="about-fact"><span>${t("settings.about.uiLanguage")}</span><strong id="about-language">…</strong></div>
      <div class="about-fact"><span>${t("settings.about.activeModel")}</span><strong id="about-model">${t("settings.about.checking")}</strong></div>
      <div class="about-fact"><span>${t("settings.about.workspaceDir")}</span><strong id="about-workspace">${t("settings.about.checking")}</strong></div>
    </div>
    <section class="about-update-panel">
      <div><strong>${t("settings.about.updates")}</strong><span id="about-update-status">${t("settings.about.updateIntro")}</span></div>
      <div class="about-update-actions">
        <button id="about-check-update" type="button">${t("settings.about.checkUpdates")}</button>
        <a id="about-download-update" href="#" target="_blank" rel="noopener" hidden>${t("settings.about.downloadInstaller")}</a>
      </div>
      <small>${t("settings.about.autoUpdaterNote")}</small>
    </section>
    <p class="about-copy">${t("settings.about.dataLocal")}</p>
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
  <div class="provider-browse-title"><div><strong>${t("settings.nav.providers")}</strong><span>${t("settings.providers.browseHint")}</span></div></div>
  <input type="search" placeholder="${t("settings.providers.searchPlaceholder")}" aria-label="${t("settings.providers.searchLabel")}" />`;
settingsProviderSidebar.prepend(providerBrowseHead);
providerBrowseHead.querySelector(".provider-browse-title").append(document.querySelector("#add-provider"));

const providerEmptyState = document.createElement("div");
providerEmptyState.className = "provider-empty-state";
providerEmptyState.innerHTML = `<strong>${t("settings.providers.emptyTitle")}</strong><span>${t("settings.providers.emptyHint")}</span>`;
document.querySelector(".provider-layout").appendChild(providerEmptyState);

const providerMobileBack = document.createElement("button");
providerMobileBack.className = "provider-mobile-back";
providerMobileBack.type = "button";
providerMobileBack.textContent = `← ${t("settings.providers.backToList")}`;
settingsProviderForm.prepend(providerMobileBack);
providerMobileBack.addEventListener("click", () => settingsDialog.classList.add("no-selection"));

async function checkNestCafeUpdate() {
  const status = settingsAboutDialog.querySelector("#about-update-status");
  const button = settingsAboutDialog.querySelector("#about-check-update");
  const download = settingsAboutDialog.querySelector("#about-download-update");
  button.disabled = true;
  status.textContent = t("settings.about.checkingRelease");
  download.hidden = true;
  try {
    const versionApi = window.NestCafe?.version;
    const product = (await versionApi?.load?.()) || versionApi?.get?.() || { version: "" };
    const current = product.version || "";
    const response = await fetch(`/api/nestcafe/update?current=${encodeURIComponent(current)}`, { cache: "no-store" });
    if (!response.ok) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
    const data = await response.json();
    if (data.update_available) {
      status.textContent = t("settings.about.updateAvailable", { latest: data.latest, current: data.current || current });
      if (data.installer_url) {
        download.href = data.installer_url;
        download.hidden = false;
      }
    } else {
      status.textContent = data.latest
        ? t("settings.about.upToDate", { latest: data.latest })
        : t("settings.about.noReleaseInfo");
    }
  } catch (error) {
    status.textContent = t("settings.about.updateCheckFailed", { detail: error.message });
  } finally {
    button.disabled = false;
  }
}

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

  const langCode = i18n?.lang || document.documentElement.lang || "";
  settingsAboutDialog.querySelector("#about-language").textContent =
    (langCode && i18n?.labelFor?.(langCode)) || langCode || "—";

  try {
    const [healthResponse, runtimeResponse] = await Promise.all([
      fetch("/api/health"),
      fetch("/api/runtime"),
    ]);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      settingsAboutDialog.querySelector("#about-model").textContent =
        health.model || t("settings.about.notSelected");
      settingsAboutDialog.querySelector("#about-workspace").textContent =
        health.home || t("settings.about.notSelected");
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
    settingsAboutDialog.querySelector("#about-model").textContent = t("settings.about.noConnection");
    settingsAboutDialog.querySelector("#about-workspace").textContent = t("settings.about.noConnection");
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
    // Open the next view before closing the previous one so the chat does not flash underneath.
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
    // Moving between regular settings pages happens inside the same dialog.
    if (currentDialog?.id === "settings-page-dialog") {
      window.NestCafe?.settings?.openPage?.(action);
      return;
    }

    // openPage() calls showModal() synchronously before its first await.
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
settingsAboutDialog.querySelector("#about-check-update").addEventListener("click", checkNestCafeUpdate);

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
