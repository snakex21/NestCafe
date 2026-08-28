"use strict";

/**
 * NestCafe UI language bootstrap.
 * - Detects OS language on first launch (when ui.lang is unset).
 * - Exposes NestCafe.i18n for settings + about screens.
 * Full UI string packs can grow later; engine language uses the same code.
 */
(() => {
  const SUPPORTED = [
    { code: "pl", label: "Polski", native: "Polski" },
    { code: "en", label: "English", native: "English" },
    { code: "de", label: "German", native: "Deutsch" },
    { code: "fr", label: "French", native: "Français" },
    { code: "es", label: "Spanish", native: "Español" },
    { code: "it", label: "Italian", native: "Italiano" },
    { code: "pt", label: "Portuguese", native: "Português" },
    { code: "nl", label: "Dutch", native: "Nederlands" },
    { code: "sv", label: "Swedish", native: "Svenska" },
    { code: "no", label: "Norwegian", native: "Norsk" },
    { code: "da", label: "Danish", native: "Dansk" },
    { code: "fi", label: "Finnish", native: "Suomi" },
    { code: "cs", label: "Czech", native: "Čeština" },
    { code: "sk", label: "Slovak", native: "Slovenčina" },
    { code: "uk", label: "Ukrainian", native: "Українська" },
    { code: "ru", label: "Russian", native: "Русский" },
    { code: "tr", label: "Turkish", native: "Türkçe" },
    { code: "ja", label: "Japanese", native: "日本語" },
    { code: "ko", label: "Korean", native: "한국어" },
    { code: "zh", label: "Chinese", native: "中文" },
  ];

  const SUPPORTED_CODES = new Set(SUPPORTED.map((item) => item.code));
  const DEFAULT_LANG = "en";

  function normalizeLang(raw) {
    const value = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-");
    if (!value) return "";
    const primary = value.split("-")[0];
    // Chinese variants
    if (primary === "zh") return "zh";
    // Norwegian
    if (primary === "nb" || primary === "nn") return "no";
    if (SUPPORTED_CODES.has(primary)) return primary;
    if (SUPPORTED_CODES.has(value)) return value;
    return "";
  }

  function detectSystemLanguage() {
    const candidates = [];
    if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
    if (navigator.language) candidates.push(navigator.language);
    if (navigator.userLanguage) candidates.push(navigator.userLanguage);
    for (const item of candidates) {
      const code = normalizeLang(item);
      if (code) return code;
    }
    return DEFAULT_LANG;
  }

  function languageOptions() {
    return SUPPORTED.map((item) => [item.code, `${item.native} (${item.code})`]);
  }

  function labelFor(code) {
    const found = SUPPORTED.find((item) => item.code === code);
    return found ? found.native : code || DEFAULT_LANG;
  }

  async function loadSettings() {
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      if (!response.ok) return {};
      const data = await response.json();
      return data.settings && typeof data.settings === "object" ? data.settings : {};
    } catch {
      return {};
    }
  }

  async function saveSettings(patch) {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
    }
  }

  /**
   * On first launch (ui.lang missing), pick OS language if supported, else English.
   * Does not overwrite an explicit user choice.
   */
  async function ensureLanguagePreference() {
    const settings = await loadSettings();
    const existing = normalizeLang(settings["ui.lang"]);
    if (existing) {
      document.documentElement.lang = existing;
      return { lang: existing, detected: false, firstRun: false };
    }
    const detected = detectSystemLanguage();
    const lang = SUPPORTED_CODES.has(detected) ? detected : DEFAULT_LANG;
    try {
      await saveSettings({ "ui.lang": lang });
    } catch {
      // Offline / settings API unavailable — still apply for this session.
    }
    document.documentElement.lang = lang;
    return { lang, detected: true, firstRun: true };
  }

  function applyDocumentLang(code) {
    const lang = normalizeLang(code) || DEFAULT_LANG;
    document.documentElement.lang = lang;
    return lang;
  }

  const api = {
    supported: SUPPORTED,
    options: languageOptions,
    normalize: normalizeLang,
    detectSystem: detectSystemLanguage,
    labelFor,
    ensureLanguagePreference,
    applyDocumentLang,
    defaultLang: DEFAULT_LANG,
  };

  window.NestCafe.export("i18n", api);

  // Bootstrap early: detect / apply language before settings UI mounts.
  ensureLanguagePreference().catch(() => {
    applyDocumentLang(detectSystemLanguage());
  });
})();
