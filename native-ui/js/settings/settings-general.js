"use strict";

const generalUI = window.NestCafe?.settings?.ui;

const generalKnobLabels = {
  orchestrator: "Delegowanie pracy",
  stable_toolset: "Stały zestaw narzędzi",
  task_parallel: "Równoległe zadania",
  memory_briefing_tokens: "Budżet pamięci startowej",
  task_max_steps: "Maksymalna liczba kroków workera",
  task_model: "Model zadań delegowanych",
};

const themeOptions = [
  ["system", "System"],
  ["light", "Jasny"],
  ["dark", "Ciemny"],
  ["oled", "OLED — czarny"],
  ["warm", "Ciepły ciemny"],
];

const colorOptions = [
  ["default", "Domyślny"],
  ["coffee", "Kawa"],
  ["midnight", "Północ"],
  ["nord", "Nord"],
  ["dracula", "Dracula"],
  ["ocean", "Ocean"],
  ["sunset", "Zachód słońca"],
  ["forest", "Las"],
  ["rose", "Róża"],
  ["graphite", "Grafit"],
  ["amber", "Bursztyn"],
  ["emerald", "Szmaragd"],
  ["violet", "Fiolet"],
  ["cyan", "Cyjan"],
  ["ruby", "Rubin"],
  ["sand", "Piasek"],
];

const fontOptions = [
  ["geist", "Geist"],
  ["apparat", "KMR Apparat"],
  ["system", "Systemowa"],
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
  ["auto", "Automatyczna"],
  ["compact", "90%"],
  ["normal", "100%"],
  ["large", "110%"],
  ["xlarge", "125%"],
  ["huge", "140%"],
];

function settingSelect(options, value, ariaLabel) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", ariaLabel);
  for (const [optionValue, label] of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = label;
    select.append(option);
  }
  select.value = value;
  return select;
}

function settingSwitch(checked, ariaLabel) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "settings-switch-input";
  input.checked = checked;
  input.setAttribute("aria-label", ariaLabel);
  return input;
}

function generalControlRow(title, description, control, icon = "") {
  const row = document.createElement("div");
  row.className = "settings-control-row";
  const copy = document.createElement("span");
  const heading = document.createElement("strong");
  if (icon) {
    const mark = document.createElement("i");
    mark.className = "settings-row-icon";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = icon;
    heading.append(mark);
  }
  heading.append(document.createTextNode(title));
  const detail = document.createElement("small");
  detail.textContent = description;
  copy.append(heading, detail);
  row.append(copy, control);
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
    status.textContent = "Zapisywanie…";
  }
  try {
    await generalUI.json("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (status) {
      status.className = "settings-save-status success";
      status.textContent = "Zapisano";
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
    "Wygląd",
    "Zmiany są widoczne od razu i zachowywane między uruchomieniami aplikacji.",
    "settings-appearance-section",
  );
  const state = { ...settings };
  const status = statusLine();
  const theme = settingSelect(themeOptions, settings["ui.theme"] || "system", "Motyw");
  const color = settingSelect(
    colorOptions,
    settings["ui.colorTheme"] || "default",
    "Kolor motywu",
  );
  const font = settingSelect(fontOptions, settings["ui.font"] || "geist", "Czcionka");
  const scale = settingSelect(scaleOptions, settings["ui.scale"] || "auto", "Skala interfejsu");
  bindAppearanceControl(theme, "ui.theme", state, status);
  bindAppearanceControl(color, "ui.colorTheme", state, status);
  bindAppearanceControl(font, "ui.font", state, status);
  bindAppearanceControl(scale, "ui.scale", state, status);
  appearance.append(
    generalControlRow(
      "Motyw",
      "System dopasowuje wygląd do ustawień Windows. Możesz też wymusić jasny lub ciemny.",
      theme,
      "◐",
    ),
    generalControlRow(
      "Kolor motywu",
      "Wybierz paletę akcentów dla przycisków, stanów aktywnych i zaznaczeń.",
      color,
      "◈",
    ),
    generalControlRow(
      "Czcionka",
      "Zmień krój używany w całym interfejsie NestCafe.",
      font,
      "Aa",
    ),
    generalControlRow(
      "Skala interfejsu",
      "Powiększ lub zmniejsz cały interfejs bez ukrywania pola wysyłania i pozostałych kontrolek.",
      scale,
      "↕",
    ),
    status,
  );
  return appearance;
}

function languageAndNotificationsSection(settings) {
  const behavior = section(
    "Język i powiadomienia",
    "Preferencje komunikacji aplikacji i informacji o zakończonych zadaniach.",
  );
  const status = statusLine();
  const i18n = window.NestCafe?.i18n;
  const languageChoices =
    i18n?.options?.() ||
    [
      ["pl", "Polski (pl)"],
      ["en", "English (en)"],
    ];
  const currentLang =
    i18n?.normalize?.(settings["ui.lang"]) ||
    i18n?.detectSystem?.() ||
    settings["ui.lang"] ||
    "en";
  const language = settingSelect(languageChoices, currentLang, "Język");
  language.addEventListener("change", async () => {
    const previous = settings["ui.lang"] || currentLang;
    try {
      await saveUISetting("ui.lang", language.value, status);
      settings["ui.lang"] = language.value;
      i18n?.applyDocumentLang?.(language.value);
      if (status) {
        status.className = "settings-save-status success";
        status.textContent =
          "Zapisano. Język silnika od następnej rozmowy. Pełne tłumaczenie UI: patrz folder readme/.";
      }
    } catch {
      language.value = previous;
    }
  });
  const notifications = settingSwitch(
    settings["ui.notifications"] !== false,
    "Powiadomienia na pulpicie",
  );
  notifications.addEventListener("change", async () => {
    const previous = settings["ui.notifications"] !== false;
    try {
      if (notifications.checked && "Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      await saveUISetting("ui.notifications", notifications.checked, status);
      settings["ui.notifications"] = notifications.checked;
      window.NestCafe?.appearance?.apply?.(settings);
    } catch {
      notifications.checked = previous;
    }
  });
  behavior.append(
    generalControlRow(
      "Język",
      "Język poleceń systemowych agenta i komunikatów obsługiwanych przez silnik.",
      language,
      "◎",
    ),
    generalControlRow(
      "Powiadomienia na pulpicie",
      "Pokaż powiadomienie systemowe po ukończeniu zadania, gdy aplikacja jest w tle.",
      notifications,
      "◉",
    ),
    status,
  );
  return behavior;
}

function backupSection(status, settings) {
  const backup = section(
    "Backup i przywracanie",
    "Pełne archiwum przenosi całe NestCafe. Wariant bez danych dostępowych służy do bezpiecznego udostępniania.",
  );
  const saveStatus = statusLine();
  let selectedScope = settings["backup.scope"] === "safe" ? "safe" : "full";
  let renderScope = () => {};
  const summary = document.createElement("div");
  summary.className = "settings-data-strip";
  for (const [label, value] of [
    ["Rozmowy", status.sessions || 0],
    ["Fakty pamięci", status.memory_entries || 0],
    ["Cele", status.goals || 0],
    ["Kolejka", status.queued_tasks || 0],
    ["Harmonogramy", status.schedules || 0],
    ["Źródła", status.folder_sources || 0],
  ]) {
    const item = document.createElement("div");
    const number = document.createElement("strong");
    number.textContent = value;
    const name = document.createElement("span");
    name.textContent = label;
    item.append(number, name);
    summary.append(item);
  }

  const mode = document.createElement("fieldset");
  mode.className = "settings-backup-mode";
  const legend = document.createElement("legend");
  legend.textContent = "Zakres backupu";
  mode.append(legend);
  const modeOptions = [
    [
      "full",
      "Pełny backup",
      "Rozmowy, pamięć, źródła, ustawienia, modele, klucze API, MCP, umiejętności i narzędzia.",
    ],
    [
      "safe",
      "Bez danych dostępowych",
      "Pomija klucze API oraz konfigurację dostawców. Dobry wariant do udostępnienia komuś innemu.",
    ],
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
  scopeTitle.textContent = "Zawartość archiwum";
  const scopeItems = document.createElement("div");
  const securityNote = document.createElement("p");
  securityNote.className = "settings-backup-security";
  scope.append(scopeTitle, scopeItems, securityNote);
  renderScope = () => {
    const items = [
      ["Rozmowy, cele i kolejka", true],
      ["Pamięć i preferencje", true],
      ["Źródła dokumentów i harmonogramy", true],
      ["Wygląd oraz ustawienia aplikacji", true],
      ["Dostawcy, klucze API, MCP i umiejętności", selectedScope === "full"],
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
      ? "Pełny backup zawiera klucze API. Przechowuj plik w bezpiecznym miejscu."
      : "Ten wariant nie zawiera kluczy API ani przenośnej konfiguracji dostawców.";
    securityNote.classList.toggle("sensitive", selectedScope === "full");
    exportButton.textContent = selectedScope === "full"
      ? "Eksportuj pełny backup"
      : "Eksportuj bez kluczy";
    exportButton.dataset.backupScope = selectedScope;
    exportButton.dataset.exportPath = selectedScope === "full"
      ? "/api/data/export/full"
      : "/api/data/export";
  };
  const actions = document.createElement("div");
  actions.className = "settings-actions-row";
  const exportButton = generalUI.button("Eksportuj pełny backup", "settings-primary-button");
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
  const importButton = generalUI.button("Wczytaj backup");
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".zip,application/zip";
  input.hidden = true;
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
          ? "Backup jest gotowy. Uruchom ponownie NestCafe, aby zastosować dane."
          : "Backup został wczytany.",
      );
    } finally {
      importButton.disabled = false;
      input.value = "";
    }
  });
  actions.append(exportButton, importButton, input);
  backup.append(
    summary,
    mode,
    scope,
    actions,
    saveStatus,
  );
  return backup;
}

function formatUptime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) return `${hours} godz. ${minutes} min`;
  if (minutes) return `${minutes} min ${secs} s`;
  return `${secs} s`;
}

function runtimeSection(runtime) {
  const engine = section(
    "Silnik w tle",
    "Stan procesu SuperCli, który obsługuje rozmowy, pamięć, narzędzia i moduły.",
    "settings-runtime-section",
  );
  const row = document.createElement("div");
  row.className = "settings-runtime-row";
  const state = document.createElement("div");
  state.className = "settings-runtime-state";
  const dot = document.createElement("i");
  const copy = document.createElement("span");
  const title = document.createElement("strong");
  title.textContent = runtime.status === "running" ? "Uruchomiony" : "Niedostępny";
  const uptime = document.createElement("small");
  let elapsed = runtime.uptime_seconds || 0;
  const updateUptime = () => {
    const access = runtime.full_filesystem_access ? "pełny dostęp do plików użytkownika" : "ograniczony dostęp do plików";
    uptime.textContent = `Czas działania: ${formatUptime(elapsed)} · ${runtime.engine || "SuperCli"} ${runtime.version || ""} · ${access}`;
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
  const logs = generalUI.button("Pobierz logi");
  logs.addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = "/api/runtime/logs";
    link.download = "";
    link.click();
  });
  const refresh = generalUI.button("Odśwież");
  refresh.addEventListener("click", () => window.NestCafe?.settings?.openPage?.("general"));
  actions.append(refresh, logs);
  row.append(state, actions);
  const services = document.createElement("div");
  services.className = "settings-runtime-services";
  for (const label of ["Rozmowy", "Pamięć", "Narzędzia", "Moduły", "Pliki użytkownika"]) {
    const service = document.createElement("span");
    service.innerHTML = `<i aria-hidden="true"></i><strong></strong><small>Aktywne</small>`;
    service.querySelector("strong").textContent = label;
    services.append(service);
  }
  engine.append(row, services);
  return engine;
}

function updateSection(runtime, settings) {
  const updates = section(
    "Aktualizacje",
    "Informacje o wydaniu natywnej kompilacji NestCafe.",
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
  const engineBit = runtime.version ? ` · silnik ${runtime.version}` : "";
  const nativeUpdater = appVersion !== "dev";
  detail.textContent = nativeUpdater
    ? `Automatyczne aktualizacje z GitHub Releases są aktywne${engineBit}.`
    : `Kompilacja deweloperska — aktualizacje są wyłączone${engineBit}.`;
  copy.append(title, detail);
  const badge = document.createElement("span");
  badge.className = `settings-status-badge${nativeUpdater ? " online" : ""}`;
  badge.textContent = nativeUpdater ? "Automatyczne" : "Dev";
  row.append(copy, badge);
  updates.append(row);
  const note = document.createElement("div");
  note.className = "settings-native-note";
  note.innerHTML = nativeUpdater
    ? "<strong>Aktualizacja bez Node.js</strong><span>Launcher sprawdza nowe wydanie przy starcie, weryfikuje SHA-256 i uruchamia natywny instalator. Dane w supercli-data pozostają na miejscu.</span>"
    : "<strong>Tryb deweloperski</strong><span>Wersja dev nie pobiera wydań automatycznie.</span>";
  updates.append(note);
  return updates;
}

function debugSection(settings) {
  const developer = section(
    "Diagnostyka",
    "Dodatkowe informacje techniczne dla problemów z silnikiem i integracjami.",
  );
  const status = statusLine();
  const debug = settingSwitch(settings["ui.debugMode"] === true, "Szczegóły diagnostyczne");
  debug.addEventListener("change", async () => {
    const previous = settings["ui.debugMode"] === true;
    try {
      await saveUISetting("ui.debugMode", debug.checked, status);
      settings["ui.debugMode"] = debug.checked;
      window.NestCafe?.appearance?.apply?.(settings);
      if (debug.checked) {
        setDebugStatus(
          status,
          "Zapisano. Zrestartuj NestCafe — potem: Ctrl+Shift+I / F12 albo PPM → Zbadaj.",
        );
        window.NestCafe?.toast?.(
          "Diagnostyka włączona. Zrestartuj NestCafe, potem Ctrl+Shift+I lub PPM → Zbadaj.",
        );
      } else {
        setDebugStatus(status, "Zapisano. Po restarcie DevTools i menu Zbadaj będą wyłączone.");
        window.NestCafe?.toast?.("Diagnostyka wyłączona. Zrestartuj NestCafe.");
      }
    } catch {
      debug.checked = previous;
    }
  });
  developer.append(
    generalControlRow(
      "Szczegóły diagnostyczne",
      "Po restarcie: Ctrl+Shift+I / F12 oraz prawy przycisk → Zbadaj element (DevTools WebView2).",
      debug,
      "⌘",
    ),
    status,
  );
  if (settings["ui.debugMode"] === true) {
    setDebugStatus(
      status,
      "Aktywne. Skróty: Ctrl+Shift+I, F12, albo PPM → Zbadaj element.",
    );
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
        ["default", "Automatycznie"],
        ["on", "Włączone"],
        ["off", "Wyłączone"],
      ],
      knob.state || "default",
      knob.label,
    );
  } else {
    control = document.createElement("input");
    control.type = knob.kind === "int" ? "number" : "text";
    control.value = knob.raw || "";
    control.placeholder = knob.value || "Domyślne";
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
    knob.next_session ? `${knob.desc} Zmiana od następnej rozmowy.` : knob.desc,
    control,
  );
}

function advancedSection(config) {
  const details = document.createElement("details");
  details.className = "settings-advanced";
  const summary = document.createElement("summary");
  summary.innerHTML =
    "<span><strong>Zaawansowane ustawienia silnika</strong><small>Delegowanie, równoległość i limity pracy SuperCli.</small></span><i aria-hidden=\"true\">⌄</i>";
  const content = document.createElement("div");
  const refresh = () => window.NestCafe?.settings?.openPage?.("general");
  for (const knob of config.knobs || []) {
    if (generalKnobLabels[knob.key]) content.append(configControl(knob, refresh));
  }
  details.append(summary, content);
  return details;
}

window.NestCafe?.settings?.registerPage?.("general", "Ogólne", async (root) => {
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
      "Ustawienia aplikacji",
      "Wygląd, zachowanie, dane i diagnostyka natywnej wersji NestCafe.",
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
