"use strict";

/**
 * NestCafe product version (from native-ui/version.json, synced with VERSION at build).
 */
(() => {
  let cached = {
    name: "NestCafe",
    version: "dev",
    product: "NestCafe",
  };

  async function load() {
    try {
      const response = await fetch("version.json", { cache: "no-store" });
      if (!response.ok) return cached;
      const data = await response.json();
      cached = {
        name: data.name || "NestCafe",
        version: String(data.version || "dev").trim() || "dev",
        product: data.product || "NestCafe",
      };
    } catch {
      // Embedded UI may still work without version.json in odd caches.
    }
    document.documentElement.dataset.appVersion = cached.version;
    window.dispatchEvent(
      new CustomEvent("nestcafe:version-loaded", { detail: { ...cached } }),
    );
    return { ...cached };
  }

  function get() {
    return { ...cached };
  }

  function label() {
    return `${cached.name} ${cached.version}`;
  }

  const api = { load, get, label };
  window.NestCafe.export("version", api);
  load();
})();
