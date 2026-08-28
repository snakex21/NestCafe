"use strict";

(function () {
  const list = document.querySelector("#module-list");
  const empty = document.querySelector("#module-empty");
  const workspace = document.querySelector("#module-workspace");
  const content = document.querySelector("#module-workspace-content");
  const title = document.querySelector("#module-workspace-title");
  const closeButton = document.querySelector("#module-close");
  if (!list || !workspace || !content || !title || !closeButton) return;

  let cleanup = null;
  let settingsQueue = Promise.resolve();

  async function request(path, options) {
    const response = await fetch(path, options);
    if (!response.ok) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
    return response.json();
  }

  function modulePath(manifest, file) {
    return `/modules/${encodeURIComponent(manifest.name)}/${file}`;
  }

  function loadAsset(tag, attributes) {
    return new Promise((resolve, reject) => {
      const key = attributes["data-module-asset"];
      if (document.querySelector(`${tag}[data-module-asset="${key}"]`)) {
        resolve();
        return;
      }
      const node = document.createElement(tag);
      Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
      node.addEventListener("load", resolve, { once: true });
      node.addEventListener("error", () => reject(new Error(`Nie można załadować ${attributes.src || attributes.href}`)), { once: true });
      document.head.appendChild(node);
    });
  }

  async function readAllSettings() {
    const response = await request("/api/settings");
    return response.settings && typeof response.settings === "object" ? response.settings : {};
  }

  function createAPI(manifest) {
    return {
      async listModels() {
        return request("/api/models");
      },
      async visionTranscribe(payload) {
        return request("/api/vision/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      },
      async storeSource(file) {
        const body = new FormData();
        body.append("file", file, file.name || "dokument");
        const result = await request("/api/attachment/upload?scope=profile", { method: "POST", body });
        const path = Array.isArray(result.paths) ? result.paths[0] : "";
        if (!path) throw new Error("Silnik nie zwrocil sciezki zapisanego dokumentu.");
        return path;
      },
      async loadSource(path) {
        const response = await fetch(`/api/attachment/preview?scope=profile&path=${encodeURIComponent(path)}`);
        if (!response.ok) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
        return response.blob();
      },
      async exportDocument(payload) {
        const response = await fetch("/api/document/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
        return response.blob();
      },
      async saveDocument(payload) {
        return request("/api/document/export/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      },
      async pickFolder() {
        return request("/api/folder-picker");
      },
      async openFolder(path) {
        return request("/api/folder/open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        });
      },
      async openPath(path) {
        return request("/api/path/open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        });
      },
      async getSettings() {
        const all = await readAllSettings();
        return all.modules?.[manifest.name] || {};
      },
      async setSetting(key, value) {
        settingsQueue = settingsQueue.then(async () => {
          const all = await readAllSettings();
          const modules = all.modules && typeof all.modules === "object" ? { ...all.modules } : {};
          const current = modules[manifest.name] && typeof modules[manifest.name] === "object"
            ? { ...modules[manifest.name] }
            : {};
          if (value === undefined || value === null || value === "") delete current[key];
          else current[key] = value;
          modules[manifest.name] = current;
          await request("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...all, modules }),
          });
        });
        return settingsQueue;
      },
      toast(message) {
        window.NestCafe?.toast?.(message);
      },
    };
  }

  async function ensureModuleLoaded(manifest) {
    window.NestCafeModules = window.NestCafeModules || {};
    if (window.NestCafeModules[manifest.name]) return;
    if (manifest.nativeStyle) {
      await loadAsset("link", {
        rel: "stylesheet",
        href: modulePath(manifest, manifest.nativeStyle),
        "data-module-asset": `${manifest.name}-style`,
      });
    }
    await loadAsset("script", {
      src: modulePath(manifest, manifest.nativeEntry),
      "data-module-asset": `${manifest.name}-script`,
    });
    if (!window.NestCafeModules[manifest.name]?.mount) {
      throw new Error(`Moduł ${manifest.name} nie udostępnił funkcji mount().`);
    }
  }

  function closeModule() {
    if (cleanup) {
      try {
        cleanup();
      } catch {
        // Module cleanup is best-effort.
      }
    }
    cleanup = null;
    content.replaceChildren();
    workspace.hidden = true;
    document.body.classList.remove("module-open");
    document.querySelectorAll(".module-item").forEach((button) => button.classList.remove("active"));
  }

  async function openModule(manifest) {
    closeModule();
    try {
      await ensureModuleLoaded(manifest);
      title.textContent = manifest.title || manifest.name;
      workspace.hidden = false;
      document.body.classList.add("module-open");
      document.querySelectorAll(".module-item").forEach((button) => {
        button.classList.toggle("active", button.dataset.module === manifest.name);
      });
      const result = await window.NestCafeModules[manifest.name].mount(content, {
        manifest,
        api: createAPI(manifest),
      });
      cleanup = typeof result === "function" ? result : null;
    } catch (error) {
      content.innerHTML = `<div style="padding:32px;color:#b5433b">${error.message}</div>`;
      workspace.hidden = false;
      document.body.classList.add("module-open");
    }
  }

  function renderCatalog(catalog) {
    list.replaceChildren();
    const modules = (Array.isArray(catalog) ? catalog : []).filter((item) => item?.name && item?.nativeEntry);
    empty.hidden = modules.length > 0;
    for (const manifest of modules) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "module-item";
      button.dataset.module = manifest.name;
      button.innerHTML = '<span class="module-item-icon">▤</span><span><strong></strong><small></small></span>';
      button.querySelector("strong").textContent = manifest.title || manifest.name;
      button.querySelector("small").textContent = manifest.description || `v${manifest.version || "1.0.0"}`;
      button.addEventListener("click", () => openModule(manifest));
      list.appendChild(button);
    }
  }

  async function loadCatalog() {
    try {
      renderCatalog(await request("/modules/catalog.json"));
    } catch {
      empty.textContent = "Nie znaleziono zgodnych modułów.";
      empty.hidden = false;
    }
  }

  closeButton.addEventListener("click", closeModule);
  document.querySelector("#new-chat")?.addEventListener("click", closeModule);
  const modulesApi = {
    open: openModule,
    close: closeModule,
    load: loadCatalog,
  };
  window.NestCafe.export("modules", modulesApi);
  loadCatalog();
})();
