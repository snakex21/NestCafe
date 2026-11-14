"use strict";

// Turns raw engine/provider error strings (usually English) into translated,
// actionable messages. The original text stays available as a detail line.
(() => {
  // Fixed English texts the engine sends as-is. Matched exactly (trimmed,
  // case-insensitive); anything else is shown as received.
  const engineTexts = {
    "no active ai provider": "chat.error.noModel",
    "no model": "chat.error.noModel",
    "no model selected": "chat.error.noModel",
    "no model configured": "chat.error.noModel",
  };

  const rules = [
    {
      test: /no active ai provider|no model (?:selected|configured)|^no model$/i,
      key: "chat.error.noModel",
      action: "providers",
    },
    {
      test: /\b401\b|unauthori[sz]ed|invalid[_ ]api[_ ]key|incorrect api key|authentication/i,
      key: "chat.error.invalidKey",
      action: "providers",
    },
    {
      test: /\b402\b|insufficient[_ ](?:quota|credit|balance)|billing/i,
      key: "chat.error.billing",
    },
    {
      test: /\b429\b|rate[_ ]?limit|too many requests/i,
      key: "chat.error.rateLimit",
    },
    {
      test: /context (?:length|window)|maximum context|too many tokens/i,
      key: "chat.error.contextTooLong",
    },
    {
      test: /deadline exceeded|timed? ?out|timeout/i,
      key: "chat.error.timeout",
    },
    {
      test: /connection refused|no such host|dial tcp|network is unreachable|failed to fetch|econnrefused/i,
      key: "chat.error.network",
    },
  ];

  // Exact-match translation of a known fixed engine text; unknown text is
  // returned unchanged.
  function translateEngineText(raw) {
    const text = String(raw ?? "");
    const key = engineTexts[text.trim().toLowerCase()];
    return key ? t(key) : text;
  }

  function describe(raw) {
    const message = String(raw || "").trim();
    if (!message) return { text: t("chat.error.unknown"), detail: "", action: "" };
    for (const rule of rules) {
      if (rule.test.test(message)) return { text: t(rule.key), detail: message, action: rule.action || "" };
    }
    return { text: message, detail: "", action: "" };
  }

  function runAction(action) {
    if (action === "providers") document.querySelector("#provider-button")?.click();
  }

  // Decorates an activity line created for an error: translated text, optional
  // action button and the raw engine message as a secondary detail.
  function decorate(row, raw) {
    if (!row) return row;
    const info = describe(raw);
    row.classList.add("error");
    row.setAttribute("role", "alert");
    const span = row.querySelector("span");
    if (span) span.textContent = info.text;
    if (info.detail) {
      const detail = document.createElement("small");
      detail.className = "event-error-detail";
      detail.textContent = t("chat.error.detail", { detail: info.detail });
      row.appendChild(detail);
    }
    if (info.action === "providers") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "event-error-action";
      button.textContent = t("chat.error.configureModel");
      button.addEventListener("click", () => runAction(info.action));
      row.appendChild(button);
    }
    return row;
  }

  window.NestCafe?.export?.("errors", { describe, decorate, translateEngineText });
})();
