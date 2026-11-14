"use strict";

const settingsIntegrationsUI = window.NestCafe?.settings?.ui;

function integrationStatus(text, active = false, error = false) {
  const badge = document.createElement("span");
  badge.className = `settings-status-badge${active ? " online" : ""}${error ? " error" : ""}`;
  badge.textContent = text;
  return badge;
}

// Inline empty state: one title line and one hint line (styled by .settings-empty-inline).
function compactEmpty(title, description) {
  const empty = document.createElement("div");
  empty.className = "settings-empty-inline";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const hint = document.createElement("span");
  hint.textContent = description;
  empty.append(heading, hint);
  return empty;
}

const THUNDERBIRD_ADDRESS = "127.0.0.1:47831";

// Known fixed English messages from the engine's Thunderbird bridge, mapped by exact match.
const THUNDERBIRD_ENGINE_MESSAGES = {
  "Enter the code in Thunderbird: Add-ons -> Thunderbird AI Bridge -> Options -> Pair.": "integrations.thunderbird.engine.enterCode",
  "Not paired. Pair this SuperCli with Thunderbird AI Bridge 0.10.0 or newer.": "integrations.thunderbird.engine.notPaired",
  "Paired and connected.": "integrations.thunderbird.engine.connected",
  "Thunderbird Bridge is not connected: start Thunderbird with Thunderbird AI Bridge 0.10.0 or newer paired with this SuperCli (Add-ons -> Thunderbird AI Bridge -> Options shows the connection)": "integrations.thunderbird.engine.notRunning",
};

function thunderbirdEngineMessage(text) {
  const key = THUNDERBIRD_ENGINE_MESSAGES[String(text || "").trim()];
  return key ? t(key) : text;
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
  meta.textContent = pkg.description || pkg.manifest || t("integrations.mcp.package.fallbackDescription");
  copy.append(title, meta);
  const state = pkg.error
    ? integrationStatus(t("common.error"), false, true)
    : pkg.running
      ? integrationStatus(tn("integrations.mcp.toolCount", pkg.tools || 0), true)
      : integrationStatus(pkg.available ? t("integrations.mcp.package.ready") : t("integrations.mcp.package.missingDependencies"));
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
      ? integrationStatus(t("integrations.mcp.server.startError"), false, true)
      : server.running
        ? integrationStatus(tn("integrations.mcp.toolCount", server.tools || 0), true)
        : integrationStatus(t("integrations.mcp.server.lazy")),
  );
  const edit = settingsIntegrationsUI.button(t("common.edit"));
  edit.addEventListener("click", () => openEditor(server.name));
  const remove = settingsIntegrationsUI.button(t("common.delete"), "settings-danger-button");
  remove.addEventListener("click", async () => {
    const approved = await window.NestCafe?.dialogs?.confirm?.({
      title: t("integrations.mcp.server.removeConfirm.title"),
      message: t("integrations.mcp.server.removeConfirm.message", { name: server.name }),
      confirmLabel: t("integrations.mcp.server.removeConfirm.confirm"),
    });
    if (!approved) return;
    await settingsIntegrationsUI.json("/api/mcp/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: server.name }),
    });
    window.NestCafe?.toast?.(t("integrations.mcp.server.removed"));
    refresh();
  });
  actions.append(edit, remove);
  row.append(icon, copy, actions);
  return row;
}

window.NestCafe?.settings?.registerPage?.("integrations", t("integrations.pageTitle"), async (root) => {
  let configDocument = { servers: {} };

  const thunderbirdCard = document.createElement("section");
  thunderbirdCard.className = "integration-feature-card";
  const thunderbirdCopy = document.createElement("div");
  thunderbirdCopy.className = "integration-feature-copy";
  const thunderbirdTitle = document.createElement("div");
  thunderbirdTitle.className = "integration-feature-title";
  const thunderbirdName = document.createElement("strong");
  thunderbirdName.textContent = "Thunderbird AI Bridge";
  const thunderbirdStatus = integrationStatus(t("integrations.thunderbird.status.checking"));
  const thunderbirdDescription = document.createElement("p");
  thunderbirdDescription.textContent = t("integrations.thunderbird.description");
  const thunderbirdMeta = document.createElement("small");
  thunderbirdMeta.textContent = t("integrations.thunderbird.meta.initial", { address: THUNDERBIRD_ADDRESS });
  // Installation and pairing steps, shown while Thunderbird is not connected.
  const thunderbirdSteps = document.createElement("ol");
  thunderbirdSteps.className = "integration-steps";
  thunderbirdSteps.hidden = true;
  const renderThunderbirdSteps = (bundled) => {
    const keys = [
      bundled ? "integrations.thunderbird.steps.saveXpi" : "integrations.thunderbird.steps.downloadXpi",
      "integrations.thunderbird.steps.install",
      "integrations.thunderbird.steps.pair",
      "integrations.thunderbird.steps.check",
    ];
    thunderbirdSteps.replaceChildren(...keys.map((key) => {
      const item = document.createElement("li");
      item.textContent = t(key);
      return item;
    }));
  };
  renderThunderbirdSteps(false);
  // One-time pairing code (shown only here, never stored by the page).
  const thunderbirdCode = document.createElement("div");
  thunderbirdCode.className = "integration-pairing-code";
  thunderbirdCode.hidden = true;
  const thunderbirdRepo = document.createElement("a");
  thunderbirdRepo.className = "integration-text-link";
  thunderbirdRepo.href = "https://github.com/snakex21/Thunderbird-AI-Bridge";
  thunderbirdRepo.target = "_blank";
  thunderbirdRepo.rel = "noopener";
  thunderbirdRepo.textContent = t("integrations.thunderbird.repoLink");
  thunderbirdTitle.append(thunderbirdName, thunderbirdStatus);
  thunderbirdCopy.append(thunderbirdTitle, thunderbirdDescription, thunderbirdMeta, thunderbirdSteps, thunderbirdCode, thunderbirdRepo);
  const thunderbirdActions = document.createElement("div");
  thunderbirdActions.className = "integration-feature-actions";
  const thunderbirdRefresh = settingsIntegrationsUI.button(t("integrations.thunderbird.action.check"));
  const thunderbirdPair = settingsIntegrationsUI.button(t("integrations.thunderbird.action.pair"), "settings-primary-button");
  const thunderbirdUnpair = settingsIntegrationsUI.button(t("integrations.thunderbird.action.unpair"), "settings-danger-button");
  thunderbirdUnpair.hidden = true;
  let thunderbirdPairTimer = null;
  const thunderbirdBundle = document.createElement("a");
  thunderbirdBundle.className = "settings-primary-button integration-download";
  thunderbirdBundle.href = "/api/integrations/thunderbird/xpi";
  thunderbirdBundle.download = "Thunderbird-AI-Bridge.xpi";
  thunderbirdBundle.textContent = t("integrations.thunderbird.action.saveXpi");
  thunderbirdBundle.hidden = true;
  thunderbirdActions.append(thunderbirdPair, thunderbirdUnpair, thunderbirdRefresh, thunderbirdBundle);
  thunderbirdCard.append(thunderbirdCopy, thunderbirdActions);

  const refreshThunderbird = async () => {
    thunderbirdRefresh.disabled = true;
    thunderbirdStatus.className = "settings-status-badge";
    thunderbirdStatus.textContent = t("integrations.thunderbird.status.checking");
    try {
      const data = await settingsIntegrationsUI.json("/api/integrations/thunderbird");
      const bridge = data.bridge || null;
      thunderbirdBundle.hidden = !data.bundled_available;
      renderThunderbirdSteps(Boolean(data.bundled_available));
      thunderbirdSteps.hidden = Boolean(data.connected);
      thunderbirdUnpair.hidden = !bridge?.paired;
      thunderbirdPair.textContent = bridge?.paired
        ? t("integrations.thunderbird.action.pairAgain")
        : t("integrations.thunderbird.action.pair");
      if (bridge && !bridge.pairing_active) thunderbirdCode.hidden = true;
      if (bridge && !bridge.paired && !bridge.pairing_active) {
        // A host from before pairing does not send "bridge"; then the old view stays.
        thunderbirdStatus.className = "settings-status-badge error";
        thunderbirdStatus.textContent = t("integrations.thunderbird.status.unpaired");
        if (bridge.state === "port_busy") {
          thunderbirdMeta.textContent = t("integrations.thunderbird.meta.portBusy", { detail: bridge.message });
        } else if (bridge.legacy_extension) {
          thunderbirdMeta.textContent = t("integrations.thunderbird.meta.legacyUnpaired");
        } else {
          thunderbirdMeta.textContent = t("integrations.thunderbird.meta.unpaired");
        }
        if (data.repo_url) thunderbirdRepo.href = data.repo_url;
        return;
      }
      if (data.connected) {
        thunderbirdStatus.className = "settings-status-badge online";
        thunderbirdStatus.textContent = t("integrations.thunderbird.status.connected");
        const details = data.status && typeof data.status === "object"
          ? (data.status.account || data.status.accountName || data.status.message || t("integrations.thunderbird.meta.responding"))
          : t("integrations.thunderbird.meta.responding");
        thunderbirdMeta.textContent = data.bundled_available
          ? t("integrations.thunderbird.meta.connectedBundled", { address: THUNDERBIRD_ADDRESS, details })
          : t("integrations.thunderbird.meta.connected", { address: THUNDERBIRD_ADDRESS, details });
      } else {
        thunderbirdStatus.className = "settings-status-badge error";
        thunderbirdStatus.textContent = bridge?.pairing_active
          ? t("integrations.thunderbird.status.waitingForCode")
          : t("integrations.thunderbird.status.disconnected");
        const reason = thunderbirdEngineMessage(bridge?.message || data.error) || t("integrations.thunderbird.meta.startThunderbird");
        thunderbirdMeta.textContent = bridge?.legacy_extension
          ? t("integrations.thunderbird.meta.legacyExtension")
          : (bridge?.paired ? t("integrations.thunderbird.meta.pairedNotConnected", { reason }) : reason);
      }
      if (data.repo_url) thunderbirdRepo.href = data.repo_url;
    } catch (error) {
      thunderbirdStatus.className = "settings-status-badge error";
      thunderbirdStatus.textContent = t("common.error");
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
      if (!got?.ok) throw new Error(got?.error || t("integrations.thunderbird.pairing.startFailed"));
      const until = new Date(got.expires_at);
      thunderbirdCode.replaceChildren();
      const code = document.createElement("strong");
      code.textContent = got.code;
      code.style.cssText = "font:600 20px ui-monospace,monospace;letter-spacing:.08em;user-select:all;display:block;margin-top:8px";
      const help = document.createElement("small");
      const time = window.NestCafe?.i18n?.formatDate
        ? window.NestCafe.i18n.formatDate(until, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : until.toLocaleTimeString();
      help.textContent = t("integrations.thunderbird.pairing.codeHelp", { time });
      thunderbirdCode.append(code, help);
      thunderbirdCode.hidden = false;
      thunderbirdStatus.className = "settings-status-badge";
      thunderbirdStatus.textContent = t("integrations.thunderbird.status.waitingForCode");
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
            if (now.bridge.paired) window.NestCafe?.toast?.(t("integrations.thunderbird.pairing.paired"));
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
      title: t("integrations.thunderbird.unpairConfirm.title"),
      message: t("integrations.thunderbird.unpairConfirm.message"),
      confirmLabel: t("integrations.thunderbird.action.unpair"),
    });
    if (!approved) return;
    await settingsIntegrationsUI.json("/api/integrations/thunderbird/unpair", { method: "POST" });
    window.NestCafe?.toast?.(t("integrations.thunderbird.unpaired"));
    refreshThunderbird();
  });

  const openFolder = settingsIntegrationsUI.button(t("integrations.mcp.openFolder"));
  openFolder.addEventListener("click", async () => {
    await settingsIntegrationsUI.json("/api/mcp/folder", { method: "POST" });
  });
  const editJSON = settingsIntegrationsUI.button(t("integrations.mcp.editJson"), "settings-primary-button");

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
      <div><strong data-i18n="integrations.mcp.editor.title"></strong><span data-i18n="integrations.mcp.editor.hint"></span></div>
      <span class="mcp-json-state">JSON</span>
    </div>
    <textarea class="mcp-json-editor" spellcheck="false" data-i18n-aria-label="integrations.mcp.editor.ariaLabel"></textarea>
    <div class="mcp-json-footer">
      <span><span data-i18n="integrations.mcp.editor.formatLabel"></span> <code data-i18n="integrations.mcp.editor.formatExample"></code></span>
      <div>
        <button class="settings-secondary-button mcp-format-json" type="button" data-i18n="integrations.mcp.editor.format"></button>
        <button class="settings-secondary-button mcp-cancel-json" type="button" data-i18n="common.cancel"></button>
        <button class="settings-primary-button mcp-save-json" type="button" data-i18n="integrations.mcp.editor.save"></button>
      </div>
    </div>`;
  window.NestCafe?.i18n?.apply?.(editor);
  const textarea = editor.querySelector(".mcp-json-editor");
  const jsonState = editor.querySelector(".mcp-json-state");

  const validateEditor = () => {
    try {
      const parsed = JSON.parse(textarea.value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || typeof parsed.servers !== "object" || Array.isArray(parsed.servers)) {
        throw new Error(t("integrations.mcp.editor.missingServers"));
      }
      jsonState.textContent = t("integrations.mcp.editor.valid");
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
      const baseName = t("integrations.mcp.template.serverName");
      let name = baseName;
      let suffix = 2;
      while (documentCopy.servers[name]) name = `${baseName}-${suffix++}`;
      documentCopy.servers[name] = {
        command: t("integrations.mcp.template.command"),
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
      packages.append(compactEmpty(t("integrations.mcp.packages.emptyTitle"), t("integrations.mcp.packages.emptyHint")));
    }
    if (!data.servers?.length) {
      servers.append(compactEmpty(t("integrations.mcp.servers.emptyTitle"), t("integrations.mcp.servers.emptyHint")));
    }
    const running = (data.servers || []).filter((server) => server.running).length +
      (data.packages || []).filter((pkg) => pkg.running).length;
    overview.innerHTML = `
      <div><strong>${(data.servers || []).length}</strong><span data-i18n="integrations.mcp.overview.servers"></span></div>
      <div><strong>${(data.packages || []).length}</strong><span data-i18n="integrations.mcp.overview.packages"></span></div>
      <div><strong>${running}</strong><span data-i18n="integrations.mcp.overview.running"></span></div>
      <p data-i18n="integrations.mcp.overview.lazyNote"></p>`;
    window.NestCafe?.i18n?.apply?.(overview);
  };

  editor.querySelector(".mcp-save-json").addEventListener("click", async () => {
    const parsed = validateEditor();
    if (!parsed) return;
    const button = editor.querySelector(".mcp-save-json");
    button.disabled = true;
    button.textContent = t("common.saving");
    try {
      await settingsIntegrationsUI.json("/api/mcp/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      editor.hidden = true;
      window.NestCafe?.toast?.(t("integrations.mcp.editor.saved"));
      await refresh();
    } finally {
      button.disabled = false;
      button.textContent = t("integrations.mcp.editor.save");
    }
  });

  editJSON.addEventListener("click", () => openJSONEditor());
  const addServer = settingsIntegrationsUI.button(t("integrations.mcp.addServer"));
  addServer.addEventListener("click", () => openJSONEditor("", true));

  const packageSection = document.createElement("section");
  packageSection.className = "settings-subsection";
  packageSection.innerHTML = `<div class="settings-subsection-head"><div><h4 data-i18n="integrations.mcp.packages.title"></h4><span data-i18n="integrations.mcp.packages.hint"></span></div></div>`;
  window.NestCafe?.i18n?.apply?.(packageSection);
  packageSection.append(packages);

  const serverSection = document.createElement("section");
  serverSection.className = "settings-subsection";
  const serverHead = document.createElement("div");
  serverHead.className = "settings-subsection-head";
  serverHead.innerHTML = `<div><h4 data-i18n="integrations.mcp.servers.title"></h4><span data-i18n="integrations.mcp.servers.hint"></span></div>`;
  window.NestCafe?.i18n?.apply?.(serverHead);
  serverHead.append(addServer);
  serverSection.append(serverHead, servers, editor);

  const headerActions = document.createElement("div");
  headerActions.className = "settings-header-actions";
  headerActions.append(openFolder, editJSON);
  root.replaceChildren(
    settingsIntegrationsUI.sectionHeader(
      t("integrations.pageTitle"),
      t("integrations.pageDescription"),
      headerActions,
    ),
    thunderbirdCard,
    overview,
    packageSection,
    serverSection,
  );
  await Promise.all([refreshThunderbird(), refresh()]);
});
