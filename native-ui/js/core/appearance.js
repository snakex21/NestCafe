"use strict";

(() => {
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const themeValues = new Set(["system", "light", "dark", "oled", "warm"]);
  const colorValues = new Set([
    "default",
    "coffee",
    "midnight",
    "nord",
    "dracula",
    "ocean",
    "sunset",
    "forest",
    "rose",
    "graphite",
    "amber",
    "emerald",
    "violet",
    "cyan",
    "ruby",
    "sand",
  ]);
  const fontValues = new Set([
    "geist",
    "apparat",
    "system",
    "segoe",
    "bahnschrift",
    "verdana",
    "trebuchet",
    "tahoma",
    "arial",
    "calibri",
    "serif",
    "mono",
    "consolas",
  ]);
  const scaleValues = new Set(["auto", "compact", "normal", "large", "xlarge", "huge"]);
  let currentSettings = {
    "ui.theme": "system",
    "ui.colorTheme": "default",
    "ui.font": "geist",
    "ui.scale": "auto",
    "ui.notifications": true,
    "ui.debugMode": false,
  };

  function normalizedAppearance(settings = {}) {
    const theme = themeValues.has(settings["ui.theme"]) ? settings["ui.theme"] : "system";
    const colorTheme = colorValues.has(settings["ui.colorTheme"])
      ? settings["ui.colorTheme"]
      : "default";
    const font = fontValues.has(settings["ui.font"]) ? settings["ui.font"] : "geist";
    const scale = scaleValues.has(settings["ui.scale"]) ? settings["ui.scale"] : "auto";
    return { theme, colorTheme, font, scale };
  }

  function resolveTheme(theme) {
    if (theme === "system") return media.matches ? "dark" : "light";
    if (theme === "oled" || theme === "warm") return "dark";
    return theme;
  }

  function resolveScale(scale) {
    const selected = { compact: 0.9, normal: 1, large: 1.1, xlarge: 1.25, huge: 1.4 }[scale];
    if (scale !== "auto" && selected) return selected;
    if (window.innerWidth >= 3000 && window.innerHeight >= 1500) return 1.2;
    if (window.innerWidth >= 2300 && window.innerHeight >= 1200) return 1.12;
    if (window.innerWidth >= 1800 && window.innerHeight >= 950) return 1.06;
    return 1;
  }

  function applyViewportScale(scaleSetting) {
    const scale = resolveScale(scaleSetting);
    const width = Math.max(1, window.innerWidth / scale);
    const height = Math.max(1, window.innerHeight / scale);
    root.style.zoom = scale;
    root.style.width = `${width}px`;
    root.style.height = `${height}px`;
    root.style.setProperty("--nc-viewport-width", `${width}px`);
    root.style.setProperty("--nc-viewport-height", `${height}px`);
    root.style.setProperty("--nc-ui-scale", scale);
    root.classList.toggle("nc-scale-compact", width <= 980);
    root.classList.toggle("nc-scale-mobile", width <= 620);
  }

  function apply(settings = currentSettings) {
    currentSettings = { ...currentSettings, ...settings };
    const { theme, colorTheme, font, scale } = normalizedAppearance(currentSettings);
    const resolved = resolveTheme(theme);
    root.dataset.theme = theme;
    root.dataset.resolvedTheme = resolved;
    root.dataset.colorTheme = colorTheme;
    root.dataset.font = font;
    root.dataset.scale = scale;
    applyViewportScale(scale);
    root.style.colorScheme = resolved;
    document.body?.classList.toggle("debug-enabled", currentSettings["ui.debugMode"] === true);
    installDebugInspectMenu(currentSettings["ui.debugMode"] === true);
    const colorScheme = document.querySelector('meta[name="color-scheme"]');
    if (colorScheme) colorScheme.content = resolved;
    window.dispatchEvent(
      new CustomEvent("nestcafe:appearance-changed", {
        detail: { theme, resolved, colorTheme, font, scale },
      }),
    );
  }

  /** When diagnostics are on, keep a clear PPM entry for Inspect (WebView2). */
  function installDebugInspectMenu(enabled) {
    if (installDebugInspectMenu.bound) return;
    installDebugInspectMenu.bound = true;
    document.addEventListener(
      "contextmenu",
      (event) => {
        if (!currentSettings["ui.debugMode"]) return;
        // Let WebView2 show its native menu (includes "Zbadaj" / Inspect when
        // DevTools are enabled by the host). We only mark the target so Elements
        // can be found quickly if the user opens DevTools via keyboard.
        event.target?.setAttribute?.("data-nestcafe-inspect", "1");
        setTimeout(() => event.target?.removeAttribute?.("data-nestcafe-inspect"), 4000);
      },
      true,
    );
    void enabled;
  }

  async function save(patch) {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
    }
    apply(patch);
  }

  async function load() {
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      currentSettings = { ...currentSettings, ...(data.settings || {}) };
      apply(currentSettings);
    } catch {
      apply(currentSettings);
    }
  }

  async function notifyTaskComplete(title, body) {
    if (currentSettings["ui.notifications"] === false || document.hasFocus()) return;
    if (!("Notification" in window)) return;
    try {
      let permission = Notification.permission;
      if (permission === "default") permission = await Notification.requestPermission();
      if (permission === "granted") new Notification(title, { body, icon: "assets/nestcafe-icon.png" });
    } catch {
      // Powiadomienia nie mogą blokować zakończenia zadania.
    }
  }

  media.addEventListener?.("change", () => {
    if (currentSettings["ui.theme"] === "system") apply(currentSettings);
  });
  window.addEventListener("resize", () => applyViewportScale(normalizedAppearance(currentSettings).scale));
  const appearanceApi = {
    apply,
    load,
    save,
    settings: () => ({ ...currentSettings }),
    resolveTheme,
    resolveScale,
    notifyTaskComplete,
  };
  window.NestCafe.export("appearance", appearanceApi);
  apply(currentSettings);
  load();
})();
