"use strict";

const generalUI = window.NestCafe?.settings?.ui;

const generalKnobLabels = {
  orchestrator: t("settings.general.knob.orchestrator"),
  stable_toolset: t("settings.general.knob.stableToolset"),
  task_parallel: t("settings.general.knob.taskParallel"),
  memory_briefing_tokens: t("settings.general.knob.memoryBriefingTokens"),
  task_max_steps: t("settings.general.knob.taskMaxSteps"),
  task_model: t("settings.general.knob.taskModel"),
};

const themeOptions = [
  ["system", t("settings.general.theme.system")],
  ["light", t("settings.general.theme.light")],
  ["dark", t("settings.general.theme.dark")],
  ["oled", t("settings.general.theme.oled")],
  ["warm", t("settings.general.theme.warm")],
];

const colorOptions = [
  ["default", t("settings.general.color.default")],
  ["coffee", t("settings.general.color.coffee")],
  ["midnight", t("settings.general.color.midnight")],
  ["nord", "Nord"],
  ["dracula", "Dracula"],
  ["ocean", t("settings.general.color.ocean")],
  ["sunset", t("settings.general.color.sunset")],
  ["forest", t("settings.general.color.forest")],
  ["rose", t("settings.general.color.rose")],
  ["graphite", t("settings.general.color.graphite")],
  ["amber", t("settings.general.color.amber")],
  ["emerald", t("settings.general.color.emerald")],
  ["violet", t("settings.general.color.violet")],
  ["cyan", t("settings.general.color.cyan")],
  ["ruby", t("settings.general.color.ruby")],
  ["sand", t("settings.general.color.sand")],
];

const fontOptions = [
  ["geist", "Geist"],
  ["apparat", "KMR Apparat"],
  ["system", t("settings.general.font.system")],
  ["segoe", "Segoe UI"],
  ["bahnschrift", "Bahnschrift"],
  ["verdana", "Verdana"],
  ["trebuchet", "Trebuchet MS"],
  ["tahoma", "Tahoma"],
  ["arial", "Arial"],
  ["calibri", "Calibri"],
  ["serif", "Georgia"],
  ["mono", "Cascadia Code"],
  ["consolas", "Consolas"],
];

const scaleOptions = [
  ["auto", t("settings.general.scale.auto")],
  ["compact", "90%"],
  ["normal", "100%"],
  ["large", "110%"],
  ["xlarge", "125%"],
  ["huge", "140%"],
];

let generalControlSeq = 0;

// The accessible name comes from the row title (aria-labelledby, set by generalControlRow).
function settingSelect(options, value) {
  const select = document.createElement("select");
  for (const [optionValue, label] of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = label;
    select.append(option);
  }
  select.value = value;
  return select;
}

function settingSwitch(checked) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "settings-switch-input";
  input.checked = checked;
  return input;
}

/** Row with a title, a description, the control and its own save status next to the control. */
function generalControlRow(title, description, control, icon = "") {
  const id = `settings-general-control-${++generalControlSeq}`;
  const row = document.createElement("div");
  row.className = "settings-control-row";
  const copy = document.createElement("span");
  const heading = document.createElement("strong");
  heading.id = `${id}-label`;
  if (icon) {
    const mark = document.createElement("i");
    mark.className = "settings-row-icon";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = icon;
    heading.append(mark);
  }
  heading.append(document.createTextNode(title));
  const detail = document.createElement("small");
  detail.id = `${id}-hint`;
  detail.textContent = description;
  copy.append(heading, detail);
  control.id = id;
  control.removeAttribute("aria-label");
  control.setAttribute("aria-labelledby", heading.id);
  control.setAttribute("aria-describedby", detail.id);
  const cell = document.createElement("div");
  cell.style.display = "grid";
  cell.style.justifyItems = "end";
  cell.style.gap = "4px";
  const status = statusLine();
  status.style.padding = "0";
  status.setAttribute("role", "status");
  cell.append(control, status);
  row.append(copy, cell);
  row.saveStatus = status;
  return row;
}

function section(title, description, className = "") {
  const node = document.createElement("section");
  node.className = `settings-panel general-settings-section ${className}`.trim();
  const head = document.createElement("div");
  const heading = document.createElement("h4");
  heading.textContent = title;
  const copy = document.createElement("p");
  copy.textContent = description;
  head.append(heading, copy);
  node.append(head);
  return node;
}

function statusLine(message = "", tone = "") {
  const line = document.createElement("p");
  line.className = `settings-save-status${tone ? ` ${tone}` : ""}`;
  line.textContent = message;
  return line;
}

async function saveUISetting(key, value, status) {
  if (status) {
    status.className = "settings-save-status saving";
    status.textContent = t("common.saving");
  }
  try {
    await generalUI.json("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (status) {
      status.className = "settings-save-status success";
      status.textContent = t("common.saved");
    }
  } catch (error) {
    if (status) {
      status.className = "settings-save-status error";
      status.textContent = error.message;
    }
    throw error;
  }
}

function bindAppearanceControl(control, key, state, status) {
  control.addEventListener("change", async () => {
    const previous = state[key];
    const next = control.type === "checkbox" ? control.checked : control.value;
    state[key] = next;
    window.NestCafe?.appearance?.apply(state);
    try {
      await saveUISetting(key, next, status);
    } catch {
      state[key] = previous;
      if (control.type === "checkbox") control.checked = previous;
      else control.value = previous;
      window.NestCafe?.appearance?.apply(state);
    }
  });
}

function appearanceSection(settings) {
  const appearance = section(
    t("settings.general.appearance.title"),
    t("settings.general.appearance.description"),
    "settings-appearance-section",
  );
  const state = { ...settings };
  const theme = settingSelect(themeOptions, settings["ui.theme"] || "system");
  const color = settingSelect(colorOptions, settings["ui.colorTheme"] || "default");
  const font = settingSelect(fontOptions, settings["ui.font"] || "geist");
  const scale = settingSelect(scaleOptions, settings["ui.scale"] || "auto");
  const rows = [
    [theme, "ui.theme", generalControlRow(t("settings.general.theme.label"), t("settings.general.theme.hint"), theme, "◐")],
    [color, "ui.colorTheme", generalControlRow(t("settings.general.color.label"), t("settings.general.color.hint"), color, "◈")],
    [font, "ui.font", generalControlRow(t("settings.general.font.label"), t("settings.general.font.hint"), font, "Aa")],
    [scale, "ui.scale", generalControlRow(t("settings.general.scale.label"), t("settings.general.scale.hint"), scale, "↕")],
  ];
  for (const [control, key, row] of rows) {
    bindAppearanceControl(control, key, state, row.saveStatus);
    appearance.append(row);
  }
  return appearance;
}

function languageAndNotificationsSection(settings) {
  const behavior = section(
    t("settings.general.behavior.title"),
    t("settings.general.behavior.description"),
  );
  const i18n = window.NestCafe?.i18n;
  const languageChoices = (i18n?.options?.() || []).map(([code, name]) => [code, `${name} (${code})`]);
  const currentLang = i18n?.lang || "en";
  const language = settingSelect(languageChoices, currentLang);
  const languageRow = generalControlRow(
    t("settings.language.label"),
    t("settings.language.hint"),
    language,
    "◎",
  );
  const languageStatus = languageRow.saveStatus;
  language.addEventListener("change", async () => {
    const next = language.value;
    language.disabled = true;
    languageStatus.className = "settings-save-status saving";
    languageStatus.textContent = t("common.saving");
    try {
      await i18n.setLanguage(next);
      settings["ui.lang"] = next;
      languageStatus.className = "settings-save-status success";
      languageStatus.textContent = t("settings.language.saved");
    } catch (error) {
      language.value = currentLang;
      languageStatus.className = "settings-save-status error";
      languageStatus.textContent = t("common.errorWithDetail", { detail: error.message });
    } finally {
      language.disabled = false;
    }
  });
  const notifications = settingSwitch(settings["ui.notifications"] !== false);
  const notificationsRow = generalControlRow(
    t("settings.general.notifications.label"),
    t("settings.general.notifications.hint"),
    notifications,
    "◉",
  );
  notifications.addEventListener("change", async () => {
    const previous = settings["ui.notifications"] !== false;
    try {
      if (notifications.checked && "Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      await saveUISetting("ui.notifications", notifications.checked, notificationsRow.saveStatus);
      settings["ui.notifications"] = notifications.checked;
      window.NestCafe?.appearance?.apply?.(settings);
    } catch {
      notifications.checked = previous;
    }
  });
  behavior.append(languageRow, notificationsRow);
  return behavior;
}

function backupSection(status, settings) {
  const backup = section(
    t("settings.general.backup.title"),
    t("settings.general.backup.description"),
  );
  const saveStatus = statusLine();
  saveStatus.setAttribute("role", "status");
  let selectedScope = settings["backup.scope"] === "safe" ? "safe" : "full";
  let renderScope = () => {};
  const summary = document.createElement("div");
  summary.className = "settings-data-strip";
  for (const [label, value] of [
    [t("settings.general.backup.stat.sessions"), status.sessions || 0],
    [t("settings.general.backup.stat.memory"), status.memory_entries || 0],
    [t("settings.general.backup.stat.goals"), status.goals || 0],
    [t("settings.general.backup.stat.queue"), status.queued_tasks || 0],
    [t("settings.general.backup.stat.schedules"), status.schedules || 0],
    [t("settings.general.backup.stat.sources"), status.folder_sources || 0],
  ]) {
    const item = document.createElement("div");
    const number = document.createElement("strong");
    number.textContent = window.NestCafe?.i18n?.formatNumber?.(value) ?? value;
    const name = document.createElement("span");
    name.textContent = label;
    item.append(number, name);
    summary.append(item);
  }

  const mode = document.createElement("fieldset");
  mode.className = "settings-backup-mode";
  const legend = document.createElement("legend");
  legend.textContent = t("settings.general.backup.scopeLegend");
  mode.append(legend);
  const modeOptions = [
    ["full", t("settings.general.backup.full.title"), t("settings.general.backup.full.description")],
    ["safe", t("settings.general.backup.safe.title"), t("settings.general.backup.safe.description")],
  ];
  const modeInputs = new Map();
  for (const [value, title, description] of modeOptions) {
    const option = document.createElement("label");
    option.className = "settings-backup-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "backup-scope";
    input.value = value;
    input.checked = value === selectedScope;
    const copy = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = title;
    const small = document.createElement("small");
    small.textContent = description;
    copy.append(strong, small);
    option.append(input, copy);
    mode.append(option);
    modeInputs.set(value, input);
  }

  const scope = document.createElement("div");
  scope.className = "settings-backup-scope";
  const scopeTitle = document.createElement("strong");
  scopeTitle.className = "settings-backup-scope-title";
  scopeTitle.textContent = t("settings.general.backup.contents");
  const scopeItems = document.createElement("div");
  const securityNote = document.createElement("p");
  securityNote.className = "settings-backup-security";
  scope.append(scopeTitle, scopeItems, securityNote);
  renderScope = () => {
    const items = [
      [t("settings.general.backup.item.sessions"), true],
      [t("settings.general.backup.item.memory"), true],
      [t("settings.general.backup.item.sources"), true],
      [t("settings.general.backup.item.appearance"), true],
      [t("settings.general.backup.item.providers"), selectedScope === "full"],
    ];
    scopeItems.replaceChildren();
    for (const [label, included] of items) {
      const row = document.createElement("span");
      row.className = included ? "included" : "excluded";
      row.innerHTML = `<i aria-hidden="true">${included ? "✓" : "—"}</i><strong></strong>`;
      row.querySelector("strong").textContent = label;
      scopeItems.append(row);
    }
    securityNote.textContent = selectedScope === "full"
      ? t("settings.general.backup.full.security")
      : t("settings.general.backup.safe.security");
    securityNote.classList.toggle("sensitive", selectedScope === "full");
    exportButton.textContent = selectedScope === "full"
      ? t("settings.general.backup.exportFull")
      : t("settings.general.backup.exportSafe");
    exportButton.dataset.backupScope = selectedScope;
    exportButton.dataset.exportPath = selectedScope === "full"
      ? "/api/data/export/full"
      : "/api/data/export";
  };
  const actions = document.createElement("div");
  actions.className = "settings-actions-row";
  const exportButton = generalUI.button(t("settings.general.backup.exportFull"), "settings-primary-button");
  exportButton.addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = exportButton.dataset.exportPath;
    link.download = "";
    link.click();
  });
  for (const [value, input] of modeInputs) {
    input.addEventListener("change", async () => {
      if (!input.checked || value === selectedScope) return;
      const previous = selectedScope;
      selectedScope = value;
      renderScope();
      try {
        await saveUISetting("backup.scope", value, saveStatus);
        settings["backup.scope"] = value;
      } catch {
        selectedScope = previous;
        modeInputs.get(previous).checked = true;
        renderScope();
      }
    });
  }
  renderScope();
  const importButton = generalUI.button(t("settings.general.backup.import"));
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".zip,application/zip";
  input.hidden = true;
  input.setAttribute("aria-label", t("settings.general.backup.import"));
  importButton.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    importButton.disabled = true;
    const body = new FormData();
    body.append("backup", file);
    try {
      const result = await generalUI.json("/api/data/import", { method: "POST", body });
      window.NestCafe?.toast?.(
        result.restart_required
          ? t("settings.general.backup.importRestart")
          : t("settings.general.backup.imported"),
      );
    } finally {
      importButton.disabled = false;
      input.value = "";
    }
  });
  actions.append(exportButton, importButton, input);
  // The scope save status sits right under the scope choice it reports on.
  backup.append(
    summary,
    mode,
    saveStatus,
    scope,
    actions,
  );
  return backup;
}

function formatUptime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) return t("settings.general.uptime.hoursMinutes", { hours, minutes });
  if (minutes) return t("settings.general.uptime.minutesSeconds", { minutes, seconds: secs });
  return t("settings.general.uptime.seconds", { seconds: secs });
}

function runtimeSection(runtime) {
  const engine = section(
    t("settings.general.runtime.title"),
    t("settings.general.runtime.description"),
    "settings-runtime-section",
  );
  const row = document.createElement("div");
  row.className = "settings-runtime-row";
  const state = document.createElement("div");
  state.className = "settings-runtime-state";
  const dot = document.createElement("i");
  const copy = document.createElement("span");
  const title = document.createElement("strong");
  title.textContent = runtime.status === "running"
    ? t("settings.general.runtime.running")
    : t("settings.general.runtime.unavailable");
  const uptime = document.createElement("small");
  let elapsed = runtime.uptime_seconds || 0;
  const updateUptime = () => {
    const access = runtime.full_filesystem_access
      ? t("settings.general.runtime.fullAccess")
      : t("settings.general.runtime.limitedAccess");
    uptime.textContent = t("settings.general.runtime.detail", {
      uptime: formatUptime(elapsed),
      engine: `${runtime.engine || "SuperCli"} ${runtime.version || ""}`.trim(),
      access,
    });
  };
  updateUptime();
  const uptimeTimer = setInterval(() => {
    if (!document.body.contains(uptime)) {
      clearInterval(uptimeTimer);
      return;
    }
    elapsed += 1;
    updateUptime();
  }, 1000);
  copy.append(title, uptime);
  state.append(dot, copy);
  const actions = document.createElement("div");
  const logs = generalUI.button(t("settings.general.runtime.downloadLogs"));
  logs.addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = "/api/runtime/logs";
    link.download = "";
    link.click();
  });
  const refresh = generalUI.button(t("common.refresh"));
  refresh.addEventListener("click", () => window.NestCafe?.settings?.openPage?.("general"));
  actions.append(refresh, logs);
  row.append(state, actions);
  const services = document.createElement("div");
  services.className = "settings-runtime-services";
  for (const label of [
    t("settings.general.runtime.service.chats"),
    t("settings.general.runtime.service.memory"),
    t("settings.general.runtime.service.tools"),
    t("settings.general.runtime.service.modules"),
    t("settings.general.runtime.service.files"),
  ]) {
    const service = document.createElement("span");
    service.innerHTML = `<i aria-hidden="true"></i><strong></strong><small></small>`;
    service.querySelector("strong").textContent = label;
    service.querySelector("small").textContent = t("settings.general.runtime.serviceActive");
    services.append(service);
  }
  engine.append(row, services);
  return engine;
}

function updateSection(runtime, settings) {
  const updates = section(
    t("settings.general.updates.title"),
    t("settings.general.updates.description"),
    "settings-update-section",
  );
  const row = document.createElement("div");
  row.className = "settings-update-state";
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  const appVersion =
    window.NestCafe?.version?.get?.()?.version || runtime.version || "dev";
  title.textContent = `NestCafe ${appVersion}`;
  const detail = document.createElement("span");
  const nativeUpdater = appVersion !== "dev";
  const engineVersion = runtime.version || "";
  if (nativeUpdater) {
    detail.textContent = engineVersion
      ? t("settings.general.updates.autoWithEngine", { engine: engineVersion })
      : t("settings.general.updates.auto");
  } else {
    detail.textContent = engineVersion
      ? t("settings.general.updates.devWithEngine", { engine: engineVersion })
      : t("settings.general.updates.dev");
  }
  copy.append(title, detail);
  const badge = document.createElement("span");
  badge.className = `settings-status-badge${nativeUpdater ? " online" : ""}`;
  badge.textContent = nativeUpdater ? t("settings.general.updates.badgeAuto") : "Dev";
  row.append(copy, badge);
  updates.append(row);
  const note = document.createElement("div");
  note.className = "settings-native-note";
  const noteTitle = document.createElement("strong");
  const noteText = document.createElement("span");
  noteTitle.textContent = nativeUpdater
    ? t("settings.general.updates.noteTitle")
    : t("settings.general.updates.devNoteTitle");
  noteText.textContent = nativeUpdater
    ? t("settings.general.updates.noteText")
    : t("settings.general.updates.devNoteText");
  note.append(noteTitle, noteText);
  updates.append(note);
  return updates;
}

function debugSection(settings) {
  const developer = section(
    t("settings.general.debug.title"),
    t("settings.general.debug.description"),
  );
  const debug = settingSwitch(settings["ui.debugMode"] === true);
  const debugRow = generalControlRow(
    t("settings.general.debug.label"),
    t("settings.general.debug.hint"),
    debug,
    "⌘",
  );
  const status = debugRow.saveStatus;
  debug.addEventListener("change", async () => {
    const previous = settings["ui.debugMode"] === true;
    try {
      await saveUISetting("ui.debugMode", debug.checked, status);
      settings["ui.debugMode"] = debug.checked;
      window.NestCafe?.appearance?.apply?.(settings);
      if (debug.checked) {
        setDebugStatus(status, t("settings.general.debug.savedOn"));
        window.NestCafe?.toast?.(t("settings.general.debug.toastOn"));
      } else {
        setDebugStatus(status, t("settings.general.debug.savedOff"));
        window.NestCafe?.toast?.(t("settings.general.debug.toastOff"));
      }
    } catch {
      debug.checked = previous;
    }
  });
  developer.append(debugRow);
  if (settings["ui.debugMode"] === true) {
    setDebugStatus(status, t("settings.general.debug.active"));
  }
  return developer;
}

function setDebugStatus(status, message) {
  if (!status) return;
  status.className = "settings-save-status success";
  status.textContent = message || "";
}

function configControl(knob, refresh) {
  let control;
  if (["tri", "tri_auto", "nav"].includes(knob.kind)) {
    control = settingSelect(
      [
        ["default", t("settings.general.advanced.auto")],
        ["on", t("common.enabled")],
        ["off", t("common.disabled")],
      ],
      knob.state || "default",
    );
  } else {
    control = document.createElement("input");
    control.type = knob.kind === "int" ? "number" : "text";
    control.value = knob.raw || "";
    control.placeholder = knob.value || t("settings.general.advanced.default");
  }
  control.addEventListener("change", async () => {
    await generalUI.json("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: knob.key, value: control.value }),
    });
    refresh();
  });
  return generalControlRow(
    generalKnobLabels[knob.key] || knob.label,
    knob.next_session ? t("settings.general.advanced.nextSession", { desc: knob.desc }) : knob.desc,
    control,
  );
}

function advancedSection(config) {
  const details = document.createElement("details");
  details.className = "settings-advanced";
  const summary = document.createElement("summary");
  summary.innerHTML = "<span><strong></strong><small></small></span><i aria-hidden=\"true\">⌄</i>";
  summary.querySelector("strong").textContent = t("settings.general.advanced.title");
  summary.querySelector("small").textContent = t("settings.general.advanced.description");
  const content = document.createElement("div");
  const refresh = () => window.NestCafe?.settings?.openPage?.("general");
  for (const knob of config.knobs || []) {
    if (generalKnobLabels[knob.key]) content.append(configControl(knob, refresh));
  }
  details.append(summary, content);
  return details;
}

window.NestCafe?.settings?.registerPage?.("general", t("settings.nav.general"), async (root) => {
  const [stored, dataStatus, config, runtime] = await Promise.all([
    generalUI.json("/api/settings"),
    generalUI.json("/api/data/status"),
    generalUI.json("/api/config"),
    generalUI.json("/api/runtime"),
  ]);
  const settings = stored.settings || {};
  window.NestCafe?.appearance?.apply?.(settings);
  root.replaceChildren(
    generalUI.sectionHeader(
      t("settings.general.title"),
      t("settings.general.description"),
    ),
    appearanceSection(settings),
    languageAndNotificationsSection(settings),
    backupSection(dataStatus, settings),
    updateSection(runtime, settings),
    runtimeSection(runtime),
    debugSection(settings),
    advancedSection(config),
  );
});
