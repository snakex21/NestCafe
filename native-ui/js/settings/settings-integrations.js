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
    if (!confirm(`Usunąć integrację „${server.name}”?`)) return;
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
      "Serwery MCP",
      "Jedno miejsce do przeglądania pakietów i edycji pełnej konfiguracji.",
      headerActions,
    ),
    overview,
    packageSection,
    serverSection,
  );
  await refresh();
});
