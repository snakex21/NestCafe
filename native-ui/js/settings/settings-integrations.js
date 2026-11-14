"use strict";

const settingsIntegrationsUI = window.NestCafe?.settings?.ui;

function integrationStatus(text, active = false, error = false) {
  const badge = document.createElement("span");
  badge.className = `settings-status-badge${active ? " online" : ""}${error ? " error" : ""}`;
  badge.textContent = text;
  return badge;
}

function compactEmpty(title, description) {
  const empty = document.createElement("div");
  empty.className = "settings-compact-empty";
  empty.innerHTML = `<strong></strong><span></span>`;
  empty.querySelector("strong").textContent = title;
  empty.querySelector("span").textContent = description;
  return empty;
}

function integrationPackageRow(pkg) {
  const row = document.createElement("article");
  row.className = "mcp-package-row";
  const icon = document.createElement("span");
  icon.className = "mcp-row-icon";
  icon.textContent = "◇";
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = pkg.name || pkg.id;
  const meta = document.createElement("span");
  meta.textContent = pkg.description || pkg.manifest || "Przenośny pakiet MCP";
  copy.append(title, meta);
  const state = pkg.error
    ? integrationStatus("Błąd", false, true)
    : pkg.running
      ? integrationStatus(`${pkg.tools || 0} narzędzi`, true)
      : integrationStatus(pkg.available ? "Gotowy" : "Brak zależności");
  row.append(icon, copy, state);
  return row;
}

function integrationServerRow(server, openEditor, refresh) {
  const row = document.createElement("article");
  row.className = "mcp-server-row";
  const icon = document.createElement("span");
  icon.className = "mcp-row-icon";
  icon.textContent = "↗";
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = server.name;
  const meta = document.createElement("code");
  meta.textContent = `${server.command} ${(server.args || []).join(" ")}`.trim();
  copy.append(title, meta);
  const actions = document.createElement("div");
  actions.append(
    server.runtime_error
      ? integrationStatus("Błąd uruchomienia", false, true)
      : server.running
        ? integrationStatus(`${server.tools || 0} narzędzi`, true)
        : integrationStatus("Leniwy"),
  );
  const edit = settingsIntegrationsUI.button("Edytuj");
  edit.addEventListener("click", () => openEditor(server.name));
  const remove = settingsIntegrationsUI.button("Usuń", "settings-danger-button");
  remove.addEventListener("click", async () => {
    const approved = await window.NestCafe?.dialogs?.confirm?.({
      title: "Usunąć integrację?",
      message: `Serwer „${server.name}” zostanie usunięty z lokalnej konfiguracji MCP.`,
      confirmLabel: "Usuń integrację",
    });
    if (!approved) return;
    await settingsIntegrationsUI.json("/api/mcp/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: server.name }),
    });
    window.NestCafe?.toast?.("Serwer MCP został usunięty.");
    refresh();
  });
  actions.append(edit, remove);
  row.append(icon, copy, actions);
  return row;
}

window.NestCafe?.settings?.registerPage?.("integrations", "Integracje", async (root) => {
  let configDocument = { servers: {} };

  const thunderbirdCard = document.createElement("section");
  thunderbirdCard.className = "integration-feature-card";
  const thunderbirdCopy = document.createElement("div");
  thunderbirdCopy.className = "integration-feature-copy";
  const thunderbirdTitle = document.createElement("div");
  thunderbirdTitle.className = "integration-feature-title";
  const thunderbirdName = document.createElement("strong");
  thunderbirdName.textContent = "Thunderbird AI Bridge";
  const thunderbirdStatus = integrationStatus("Sprawdzanie…");
  const thunderbirdDescription = document.createElement("p");
  thunderbirdDescription.textContent = "Lokalny most do poczty Thunderbird: wyszukiwanie, odczyt, załączniki, foldery, kontakty i bezpieczne operacje na wiadomościach.";
  const thunderbirdMeta = document.createElement("small");
  thunderbirdMeta.textContent = "Host NestCafe: 127.0.0.1:47831 · Thunderbird musi mieć rozszerzenie Thunderbird AI Bridge 0.10.0 lub nowsze, sparowane z NestCafe.";
  // One-time pairing code (shown only here, never stored by the page).
  const thunderbirdCode = document.createElement("div");
  thunderbirdCode.className = "integration-pairing-code";
  thunderbirdCode.hidden = true;
  thunderbirdTitle.append(thunderbirdName, thunderbirdStatus);
  thunderbirdCopy.append(thunderbirdTitle, thunderbirdDescription, thunderbirdMeta, thunderbirdCode);
  const thunderbirdActions = document.createElement("div");
  thunderbirdActions.className = "integration-feature-actions";
  const thunderbirdRefresh = settingsIntegrationsUI.button("Sprawdź połączenie");
  const thunderbirdPair = settingsIntegrationsUI.button("Paruj z Thunderbirdem", "settings-primary-button");
  const thunderbirdUnpair = settingsIntegrationsUI.button("Rozparuj", "settings-danger-button");
  thunderbirdUnpair.hidden = true;
  let thunderbirdPairTimer = null;
  const thunderbirdBundle = document.createElement("a");
  thunderbirdBundle.className = "settings-primary-button integration-download";
  thunderbirdBundle.href = "/api/integrations/thunderbird/xpi";
  thunderbirdBundle.download = "Thunderbird-AI-Bridge.xpi";
  thunderbirdBundle.textContent = "Zapisz wbudowane XPI";
  thunderbirdBundle.hidden = true;
  const thunderbirdRepo = document.createElement("a");
  thunderbirdRepo.href = "https://github.com/snakex21/Thunderbird-AI-Bridge";
  thunderbirdRepo.target = "_blank";
  thunderbirdRepo.rel = "noopener";
  thunderbirdRepo.textContent = "GitHub";
  thunderbirdActions.append(thunderbirdPair, thunderbirdUnpair, thunderbirdRefresh, thunderbirdBundle, thunderbirdRepo);
  thunderbirdCard.append(thunderbirdCopy, thunderbirdActions);

  const refreshThunderbird = async () => {
    thunderbirdRefresh.disabled = true;
    thunderbirdStatus.className = "settings-status-badge";
    thunderbirdStatus.textContent = "Sprawdzanie…";
    try {
      const data = await settingsIntegrationsUI.json("/api/integrations/thunderbird");
      const bridge = data.bridge || null;
      thunderbirdBundle.hidden = !data.bundled_available;
      thunderbirdUnpair.hidden = !bridge?.paired;
      thunderbirdPair.textContent = bridge?.paired ? "Paruj ponownie" : "Paruj z Thunderbirdem";
      if (bridge && !bridge.pairing_active) thunderbirdCode.hidden = true;
      if (bridge && !bridge.paired && !bridge.pairing_active) {
        // A host from before pairing does not send "bridge"; then the old view stays.
        thunderbirdStatus.className = "settings-status-badge error";
        thunderbirdStatus.textContent = "Niesparowany";
        thunderbirdMeta.textContent = bridge.state === "port_busy"
          ? bridge.message
          : "Kliknij „Paruj z Thunderbirdem”, a w Thunderbirdzie: Dodatki i motywy → Thunderbird AI Bridge → Opcje, wpisz pokazany kod i kliknij „Paruj”. Wymagane rozszerzenie 0.10.0 lub nowsze.";
        if (bridge.legacy_extension) thunderbirdMeta.textContent += " Thunderbird ma stare rozszerzenie 0.9.x: najpierw je zaktualizuj (wbudowane XPI poniżej).";
        if (data.repo_url) thunderbirdRepo.href = data.repo_url;
        return;
      }
      if (data.connected) {
        thunderbirdStatus.className = "settings-status-badge online";
        thunderbirdStatus.textContent = "Połączony";
        const details = data.status && typeof data.status === "object"
          ? (data.status.account || data.status.accountName || data.status.message || "Thunderbird odpowiada")
          : "Thunderbird odpowiada";
        thunderbirdMeta.textContent = data.bundled_available
          ? `127.0.0.1:47831 · ${details} · pakiet XPI jest dołączony do NestCafe`
          : `127.0.0.1:47831 · ${details}`;
      } else {
        thunderbirdStatus.className = "settings-status-badge error";
        thunderbirdStatus.textContent = bridge?.pairing_active ? "Czeka na kod" : "Niepołączony";
        const reason = bridge?.message || data.error || "Uruchom Thunderbird i włącz rozszerzenie Thunderbird AI Bridge.";
        thunderbirdMeta.textContent = bridge?.legacy_extension
          ? "Thunderbird ma stare rozszerzenie 0.9.x, które nie umie się uwierzytelnić. Zapisz wbudowane XPI 0.10.0, zainstaluj je w Thunderbirdzie (Dodatki i motywy → Zainstaluj dodatek z pliku) i sparuj."
          : (bridge?.paired ? `Sparowany, ale bez połączenia: ${reason}` : reason);
      }
      if (data.repo_url) thunderbirdRepo.href = data.repo_url;
    } catch (error) {
      thunderbirdStatus.className = "settings-status-badge error";
      thunderbirdStatus.textContent = "Błąd";
      thunderbirdMeta.textContent = error.message;
    } finally {
      thunderbirdRefresh.disabled = false;
    }
  };
  thunderbirdRefresh.addEventListener("click", refreshThunderbird);

  thunderbirdPair.addEventListener("click", async () => {
    thunderbirdPair.disabled = true;
    clearTimeout(thunderbirdPairTimer);
    try {
      const got = await settingsIntegrationsUI.json("/api/integrations/thunderbird/pair", { method: "POST" });
      if (!got?.ok) throw new Error(got?.error || "Nie udało się rozpocząć parowania.");
      const until = new Date(got.expires_at);
      thunderbirdCode.replaceChildren();
      const code = document.createElement("strong");
      code.textContent = got.code;
      code.style.cssText = "font:600 20px ui-monospace,monospace;letter-spacing:.08em;user-select:all;display:block;margin-top:8px";
      const help = document.createElement("small");
      help.textContent = `W Thunderbirdzie: Dodatki i motywy → Thunderbird AI Bridge → Opcje, wpisz ten kod i kliknij „Paruj”. Kod jest ważny do ${until.toLocaleTimeString()}.`;
      thunderbirdCode.append(code, help);
      thunderbirdCode.hidden = false;
      thunderbirdStatus.className = "settings-status-badge";
      thunderbirdStatus.textContent = "Czeka na kod";
      const poll = async () => {
        if (!thunderbirdCard.isConnected || Date.now() > until.getTime()) {
          thunderbirdCode.hidden = true;
          return;
        }
        try {
          const now = await settingsIntegrationsUI.json("/api/integrations/thunderbird");
          if (now.bridge && !now.bridge.pairing_active) {
            thunderbirdCode.hidden = true;
            await refreshThunderbird();
            if (now.bridge.paired) window.NestCafe?.toast?.("Thunderbird został sparowany z NestCafe.");
            return;
          }
        } catch (_) {}
        thunderbirdPairTimer = setTimeout(poll, 2000);
      };
      thunderbirdPairTimer = setTimeout(poll, 2000);
    } catch (error) {
      window.NestCafe?.toast?.(error.message);
    } finally {
      thunderbirdPair.disabled = false;
    }
  });

  thunderbirdUnpair.addEventListener("click", async () => {
    const approved = await window.NestCafe?.dialogs?.confirm?.({
      title: "Rozparować Thunderbirda?",
      message: "NestCafe zapomni sekret parowania. Thunderbird nie połączy się, dopóki nie sparujesz go ponownie.",
      confirmLabel: "Rozparuj",
    });
    if (!approved) return;
    await settingsIntegrationsUI.json("/api/integrations/thunderbird/unpair", { method: "POST" });
    window.NestCafe?.toast?.("Thunderbird został rozparowany.");
    refreshThunderbird();
  });

  const openFolder = settingsIntegrationsUI.button("Otwórz folder MCP");
  openFolder.addEventListener("click", async () => {
    await settingsIntegrationsUI.json("/api/mcp/folder", { method: "POST" });
  });
  const editJSON = settingsIntegrationsUI.button("Edytuj JSON", "settings-primary-button");

  const overview = document.createElement("div");
  overview.className = "mcp-overview";
  const packages = document.createElement("div");
  packages.className = "mcp-list";
  const servers = document.createElement("div");
  servers.className = "mcp-list";

  const editor = document.createElement("section");
  editor.className = "mcp-json-panel";
  editor.hidden = true;
  editor.innerHTML = `
    <div class="mcp-json-head">
      <div><strong>Konfiguracja MCP</strong><span>Pełny dokument jest walidowany przed zapisaniem.</span></div>
      <span class="mcp-json-state">JSON</span>
    </div>
    <textarea class="mcp-json-editor" spellcheck="false" aria-label="Konfiguracja MCP w JSON"></textarea>
    <div class="mcp-json-footer">
      <span>Format: <code>{"servers":{"nazwa":{"command":"…","args":[],"env":{}}}}</code></span>
      <div>
        <button class="settings-secondary-button mcp-format-json" type="button">Formatuj</button>
        <button class="settings-secondary-button mcp-cancel-json" type="button">Anuluj</button>
        <button class="settings-primary-button mcp-save-json" type="button">Zapisz konfigurację</button>
      </div>
    </div>`;
  const textarea = editor.querySelector(".mcp-json-editor");
  const jsonState = editor.querySelector(".mcp-json-state");

  const validateEditor = () => {
    try {
      const parsed = JSON.parse(textarea.value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || typeof parsed.servers !== "object" || Array.isArray(parsed.servers)) {
        throw new Error('Dokument musi zawierać obiekt "servers".');
      }
      jsonState.textContent = "Poprawny JSON";
      jsonState.className = "mcp-json-state valid";
      return parsed;
    } catch (error) {
      jsonState.textContent = error.message;
      jsonState.className = "mcp-json-state invalid";
      return null;
    }
  };

  const openJSONEditor = (serverName = "", addTemplate = false) => {
    const documentCopy = JSON.parse(JSON.stringify(configDocument));
    if (addTemplate) {
      let name = "nowy-serwer";
      let suffix = 2;
      while (documentCopy.servers[name]) name = `nowy-serwer-${suffix++}`;
      documentCopy.servers[name] = {
        command: "C:\\narzędzia\\server.exe",
        args: [],
        env: {},
      };
      serverName = name;
    }
    textarea.value = JSON.stringify(documentCopy, null, 2);
    editor.hidden = false;
    validateEditor();
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => {
      textarea.focus();
      if (serverName) {
        const position = textarea.value.indexOf(`"${serverName}"`);
        if (position >= 0) textarea.setSelectionRange(position, position + serverName.length + 2);
      }
    });
  };

  textarea.addEventListener("input", validateEditor);
  editor.querySelector(".mcp-format-json").addEventListener("click", () => {
    const parsed = validateEditor();
    if (!parsed) return;
    textarea.value = JSON.stringify(parsed, null, 2);
    validateEditor();
  });
  editor.querySelector(".mcp-cancel-json").addEventListener("click", () => {
    editor.hidden = true;
    textarea.value = "";
  });

  const refresh = async () => {
    const [data, config] = await Promise.all([
      settingsIntegrationsUI.json("/api/mcp/servers"),
      settingsIntegrationsUI.json("/api/mcp/config"),
    ]);
    configDocument = config || { servers: {} };
    packages.replaceChildren();
    servers.replaceChildren();
    for (const pkg of data.packages || []) packages.append(integrationPackageRow(pkg));
    for (const server of data.servers || []) servers.append(integrationServerRow(server, openJSONEditor, refresh));
    if (!data.packages?.length) {
      packages.append(compactEmpty("Brak pakietów", "Skopiuj przenośny pakiet do folderu MCP."));
    }
    if (!data.servers?.length) {
      servers.append(compactEmpty("Brak własnych serwerów", "Dodaj pierwszy serwer bezpośrednio w edytorze JSON."));
    }
    const running = (data.servers || []).filter((server) => server.running).length +
      (data.packages || []).filter((pkg) => pkg.running).length;
    overview.innerHTML = `
      <div><strong>${(data.servers || []).length}</strong><span>Własne serwery</span></div>
      <div><strong>${(data.packages || []).length}</strong><span>Pakiety przenośne</span></div>
      <div><strong>${running}</strong><span>Uruchomione teraz</span></div>
      <p>Serwery startują dopiero wtedy, gdy agent potrzebuje ich narzędzi.</p>`;
  };

  editor.querySelector(".mcp-save-json").addEventListener("click", async () => {
    const parsed = validateEditor();
    if (!parsed) return;
    const button = editor.querySelector(".mcp-save-json");
    button.disabled = true;
    button.textContent = "Zapisywanie…";
    try {
      await settingsIntegrationsUI.json("/api/mcp/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      editor.hidden = true;
      window.NestCafe?.toast?.("Konfiguracja MCP została zapisana.");
      await refresh();
    } finally {
      button.disabled = false;
      button.textContent = "Zapisz konfigurację";
    }
  });

  editJSON.addEventListener("click", () => openJSONEditor());
  const addServer = settingsIntegrationsUI.button("+ Dodaj serwer");
  addServer.addEventListener("click", () => openJSONEditor("", true));

  const packageSection = document.createElement("section");
  packageSection.className = "settings-subsection";
  packageSection.innerHTML = `<div class="settings-subsection-head"><div><h4>Przenośne pakiety</h4><span>Pakiety dołączane bez instalatora i bez Node.js w interfejsie.</span></div></div>`;
  packageSection.append(packages);

  const serverSection = document.createElement("section");
  serverSection.className = "settings-subsection";
  const serverHead = document.createElement("div");
  serverHead.className = "settings-subsection-head";
  serverHead.innerHTML = `<div><h4>Własne serwery</h4><span>Polecenia stdio zapisane w lokalnej konfiguracji Go.</span></div>`;
  serverHead.append(addServer);
  serverSection.append(serverHead, servers, editor);

  const headerActions = document.createElement("div");
  headerActions.className = "settings-header-actions";
  headerActions.append(openFolder, editJSON);
  root.replaceChildren(
    settingsIntegrationsUI.sectionHeader(
      "Integracje",
      "Połączenia lokalne NestCafe oraz serwery MCP używane przez agenta.",
      headerActions,
    ),
    thunderbirdCard,
    overview,
    packageSection,
    serverSection,
  );
  await Promise.all([refreshThunderbird(), refresh()]);
});
