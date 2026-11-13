"use strict";

// Turns raw engine/provider error strings (usually English) into Polish,
// actionable messages. The original text stays available as a detail line.
(() => {
  const rules = [
    {
      test: /no active ai provider|no model (?:selected|configured)|^no model$/i,
      text: "Nie wybrano modelu AI. Dodaj dostawcę i wybierz model, aby wysłać zadanie.",
      action: "providers",
    },
    {
      test: /\b401\b|unauthori[sz]ed|invalid[_ ]api[_ ]key|incorrect api key|authentication/i,
      text: "Dostawca odrzucił klucz API. Sprawdź klucz w ustawieniach dostawcy.",
      action: "providers",
    },
    {
      test: /\b402\b|insufficient[_ ](?:quota|credit|balance)|billing/i,
      text: "Dostawca odmówił z powodu limitu środków lub planu. Sprawdź konto u dostawcy.",
    },
    {
      test: /\b429\b|rate[_ ]?limit|too many requests/i,
      text: "Przekroczono limit zapytań dostawcy. Spróbuj ponownie za chwilę.",
    },
    {
      test: /context (?:length|window)|maximum context|too many tokens/i,
      text: "Rozmowa jest za długa dla tego modelu. Zacznij nową rozmowę albo wybierz model z większym kontekstem.",
    },
    {
      test: /deadline exceeded|timed? ?out|timeout/i,
      text: "Model nie odpowiedział w wymaganym czasie. Spróbuj ponownie.",
    },
    {
      test: /connection refused|no such host|dial tcp|network is unreachable|failed to fetch|econnrefused/i,
      text: "Brak połączenia z dostawcą modelu. Sprawdź internet albo adres serwera dostawcy.",
    },
  ];

  function describe(raw) {
    const message = String(raw || "").trim();
    if (!message) return { text: "Nieznany błąd.", detail: "", action: "" };
    for (const rule of rules) {
      if (rule.test.test(message)) return { text: rule.text, detail: message, action: rule.action || "" };
    }
    return { text: message, detail: "", action: "" };
  }

  function runAction(action) {
    if (action === "providers") document.querySelector("#provider-button")?.click();
  }

  // Decorates an activity line created for an error: Polish text, optional
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
      detail.textContent = `Szczegóły: ${info.detail}`;
      row.appendChild(detail);
    }
    if (info.action === "providers") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "event-error-action";
      button.textContent = "Skonfiguruj model";
      button.addEventListener("click", () => runAction(info.action));
      row.appendChild(button);
    }
    return row;
  }

  window.NestCafe?.export?.("errors", { describe, decorate });
})();
