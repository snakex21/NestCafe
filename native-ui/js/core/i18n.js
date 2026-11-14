"use strict";

/**
 * NestCafe UI translations.
 *
 * Catalogs live in native-ui/locales/<code>.json as flat "key": "message" maps.
 * Polish (pl) is the source catalog, English (en) the fallback for missing keys.
 *
 * Messages use named parameters: "Usunąć {name}?" -> t("x", { name }).
 * Plural messages list CLDR forms picked by Intl.PluralRules for the UI language:
 *   "one {# plik} few {# pliki} many {# plików} other {# pliku}"
 * "#" is the formatted count; named parameters work inside the forms too.
 *
 * Language: the saved choice (engine config, served as settings["ui.lang"]),
 * then the OS/browser language, then English. Changing the language reloads the
 * window so every view is rebuilt in the new language.
 */
(() => {
  // Same 27 languages as SuperCli (internal/system/uilang), native names.
  const SUPPORTED = [
    { code: "en", name: "English" },
    { code: "bg", name: "Български" },
    { code: "cs", name: "Čeština" },
    { code: "da", name: "Dansk" },
    { code: "de", name: "Deutsch" },
    { code: "el", name: "Ελληνικά" },
    { code: "es", name: "Español" },
    { code: "et", name: "Eesti" },
    { code: "fi", name: "Suomi" },
    { code: "fr", name: "Français" },
    { code: "hr", name: "Hrvatski" },
    { code: "hu", name: "Magyar" },
    { code: "it", name: "Italiano" },
    { code: "lt", name: "Lietuvių" },
    { code: "lv", name: "Latviešu" },
    { code: "nb", name: "Norsk bokmål" },
    { code: "nl", name: "Nederlands" },
    { code: "pl", name: "Polski" },
    { code: "pt-BR", name: "Português (Brasil)" },
    { code: "ro", name: "Română" },
    { code: "ru", name: "Русский" },
    { code: "sk", name: "Slovenčina" },
    { code: "sl", name: "Slovenščina" },
    { code: "sr-Latn", name: "Srpski (latinica)" },
    { code: "sv", name: "Svenska" },
    { code: "tr", name: "Türkçe" },
    { code: "uk", name: "Українська" },
  ];
  const SOURCE_LANG = "pl";
  const DEFAULT_LANG = "en";
  const STORAGE_KEY = "nestcafe.ui.lang";

  function normalize(raw) {
    let value = String(raw || "").trim().toLowerCase().replace(/_/g, "-");
    value = value.split(/[:.@]/)[0];
    if (!value) return "";
    const base = value.split("-")[0];
    if (base === "pt") return "pt-BR";
    if (base === "sr") return "sr-Latn";
    if (base === "no" || base === "nb" || base === "nn") return "nb";
    const found = SUPPORTED.find((item) => item.code.toLowerCase() === base);
    return found ? found.code : "";
  }

  /** saved choice -> cached choice -> OS/browser languages -> English. */
  function resolveLanguage({ saved, cached, system } = {}) {
    for (const candidate of [saved, cached, ...(Array.isArray(system) ? system : [system])]) {
      const code = normalize(candidate);
      if (code) return code;
    }
    return DEFAULT_LANG;
  }

  function systemLanguages(nav) {
    const list = [];
    if (nav && Array.isArray(nav.languages)) list.push(...nav.languages);
    if (nav && nav.language) list.push(nav.language);
    return list;
  }

  // Plural forms may contain named params ("one {# file in {dir}}"), so the
  // body of each form is read with brace balancing instead of a flat regex.
  const PLURAL_CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);
  function pluralForms(text) {
    const forms = Object.create(null);
    const source = String(text || "");
    let i = 0;
    while (i < source.length) {
      while (i < source.length && /\s/.test(source[i])) i += 1;
      const match = /^(zero|one|two|few|many|other)\s*\{/.exec(source.slice(i));
      if (!match) break;
      let depth = 1;
      let j = i + match[0].length;
      const bodyStart = j;
      while (j < source.length && depth > 0) {
        if (source[j] === "{") depth += 1;
        else if (source[j] === "}") depth -= 1;
        j += 1;
      }
      if (depth !== 0) break;
      forms[match[1]] = source.slice(bodyStart, j - 1);
      i = j;
    }
    return forms;
  }
  function isPluralMessage(text) {
    const source = String(text || "");
    if (!/^\s*(zero|one|two|few|many|other)\s*\{/.test(source)) return false;
    const forms = pluralForms(source);
    return Object.keys(forms).every((name) => PLURAL_CATEGORIES.has(name)) && "other" in forms;
  }

  function interpolate(text, params) {
    if (!params) return text;
    return text.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (all, name) =>
      Object.prototype.hasOwnProperty.call(params, name) && params[name] !== undefined && params[name] !== null
        ? String(params[name])
        : all,
    );
  }

  /** Pure translator over loaded catalogs; used by the browser and by tests. */
  function createTranslator(catalogs, lang) {
    const chain = [lang, DEFAULT_LANG, SOURCE_LANG].filter((code, i, all) => code && all.indexOf(code) === i);
    const pluralRules = Object.create(null);
    function lookup(key) {
      for (const code of chain) {
        const value = catalogs[code] && catalogs[code][key];
        if (typeof value === "string" && value) return value;
      }
      return null;
    }
    function category(code, n) {
      try {
        if (!pluralRules[code]) pluralRules[code] = new Intl.PluralRules(code);
        return pluralRules[code].select(n);
      } catch {
        return n === 1 ? "one" : "other";
      }
    }
    function formatNumber(n) {
      try {
        return new Intl.NumberFormat(lang).format(n);
      } catch {
        return String(n);
      }
    }
    function t(key, params) {
      const message = lookup(key);
      if (message === null) return key;
      if (params && typeof params.count === "number" && isPluralMessage(message)) return tn(key, params.count, params);
      return interpolate(message, params);
    }
    function tn(key, count, params) {
      const message = lookup(key);
      const n = Number(count) || 0;
      if (message === null) return `${n} ${key}`;
      const all = { count: formatNumber(n), ...(params || {}) };
      if (!isPluralMessage(message)) return interpolate(message, all);
      // Pick the form for the language the message actually came from.
      const source = chain.find((code) => catalogs[code] && catalogs[code][key] === message) || lang;
      const forms = pluralForms(message);
      let form = forms[category(source, Math.abs(n))];
      if (form === undefined) form = forms.other;
      if (form === undefined) return interpolate(message, all);
      return interpolate(form.replace(/#/g, formatNumber(n)), all);
    }
    return { t, tn, lookup, lang };
  }

  const api = {
    supported: SUPPORTED,
    sourceLang: SOURCE_LANG,
    defaultLang: DEFAULT_LANG,
    normalize,
    resolveLanguage,
    createTranslator,
    pluralForms,
    isPluralMessage,
    interpolate,
  };

  if (typeof module === "object" && module.exports && typeof window === "undefined") {
    module.exports = api;
    return;
  }

  // ---- Browser bootstrap (synchronous so every script can call t() at load) ----
  function getJSONSync(url) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, false);
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300) return JSON.parse(xhr.responseText);
    } catch {
      // Missing catalog or settings API: fall through to the next source.
    }
    return null;
  }
  function readCached() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  }
  function writeCached(code) {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Storage may be unavailable; the engine config still holds the choice.
    }
  }

  const settings = getJSONSync("/api/settings");
  const saved = settings && settings.settings ? settings.settings["ui.lang"] : "";
  const nav = typeof navigator === "undefined" ? null : navigator;
  const lang = resolveLanguage({ saved, cached: readCached(), system: systemLanguages(nav) });
  writeCached(lang);

  const catalogs = Object.create(null);
  for (const code of [lang, DEFAULT_LANG]) {
    if (catalogs[code]) continue;
    const catalog = getJSONSync(`locales/${code}.json`);
    if (catalog && typeof catalog === "object" && !Array.isArray(catalog)) catalogs[code] = catalog;
  }
  if (!catalogs[DEFAULT_LANG] && !catalogs[SOURCE_LANG]) {
    const source = getJSONSync(`locales/${SOURCE_LANG}.json`);
    if (source) catalogs[SOURCE_LANG] = source;
  }
  const translator = createTranslator(catalogs, lang);
  document.documentElement.lang = lang;

  const ATTRS = [
    ["i18nTitle", "title"],
    ["i18nAriaLabel", "aria-label"],
    ["i18nPlaceholder", "placeholder"],
    ["i18nAlt", "alt"],
  ];
  /** Translate static markup: data-i18n (text), data-i18n-title/-aria-label/-placeholder/-alt. */
  function apply(root = document) {
    if (!root || !root.querySelectorAll) return;
    const nodes = [root, ...root.querySelectorAll("[data-i18n],[data-i18n-title],[data-i18n-aria-label],[data-i18n-placeholder],[data-i18n-alt]")];
    for (const node of nodes) {
      if (!node.dataset) continue;
      if (node.dataset.i18n) node.textContent = translator.t(node.dataset.i18n);
      for (const [prop, attr] of ATTRS) {
        if (node.dataset[prop]) node.setAttribute(attr, translator.t(node.dataset[prop]));
      }
    }
  }

  async function setLanguage(code) {
    const next = normalize(code);
    if (!next) throw new Error(`Unsupported language: ${code}`);
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "ui.lang": next }),
    });
    if (!response.ok) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
    writeCached(next);
    if (next !== lang) window.location.reload();
    return next;
  }

  function formatDate(value, options) {
    try {
      return new Intl.DateTimeFormat(lang, options).format(value instanceof Date ? value : new Date(value));
    } catch {
      return String(value);
    }
  }
  function formatNumber(value, options) {
    try {
      return new Intl.NumberFormat(lang, options).format(value);
    } catch {
      return String(value);
    }
  }

  Object.assign(api, {
    lang,
    t: translator.t,
    tn: translator.tn,
    has: (key) => translator.lookup(key) !== null,
    apply,
    setLanguage,
    formatDate,
    formatNumber,
    labelFor: (code) => (SUPPORTED.find((item) => item.code === normalize(code)) || { name: code }).name,
    options: () => SUPPORTED.map((item) => [item.code, item.name]),
    // Compatibility with the 2.1 settings code.
    detectSystem: () => resolveLanguage({ system: systemLanguages(nav) }),
    applyDocumentLang: () => lang,
  });

  window.NestCafe.export("i18n", api);
  // Short global helpers used throughout the UI scripts: t("key", { param }), tn("key", n).
  globalThis.t = api.t;
  globalThis.tn = api.tn;

  // i18n.js is a blocking script placed after the markup, so the static UI can be
  // translated right now, before deferred scripts take over individual elements.
  apply(document);
})();
