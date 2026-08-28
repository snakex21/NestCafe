"use strict";

/**
 * NestCafe public UI bus.
 *
 * Prefer:
 *   NestCafe.toast(...)
 *   NestCafe.settings.openPage("folders")
 *   NestCafe.runPrompt(text, attachments)
 *
 * No window.*NestCafe* aliases — always use NestCafe.*
 */
const NestCafe = (window.NestCafe = window.NestCafe || {});

NestCafe.define = function define(name, value) {
  NestCafe[name] = value;
  return value;
};

/** Register a namespaced API on NestCafe. */
NestCafe.export = function exportApi(name, value) {
  NestCafe.define(name, value);
  return value;
};

/** Safe call helper for optional nested APIs. */
NestCafe.call = function call(path, ...args) {
  const parts = String(path || "").split(".").filter(Boolean);
  let target = NestCafe;
  for (let i = 0; i < parts.length - 1; i += 1) {
    target = target?.[parts[i]];
    if (!target) return undefined;
  }
  const fn = target?.[parts[parts.length - 1]];
  if (typeof fn !== "function") return undefined;
  return fn.apply(target, args);
};

NestCafe.toast =
  NestCafe.toast ||
  function toastFallback(message) {
    console.info("[NestCafe]", message);
  };
