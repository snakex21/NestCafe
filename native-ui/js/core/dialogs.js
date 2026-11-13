"use strict";

(() => {
  const root = window.NestCafe;
  if (!root) return;

  function dialogBase(title, message) {
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog nestcafe-system-dialog";

    const heading = document.createElement("h3");
    heading.textContent = title || "Potwierdzenie";

    const copy = document.createElement("p");
    copy.textContent = message || "";

    dialog.append(heading, copy);
    return dialog;
  }

  function closeAndRemove(dialog, value) {
    if (dialog.open) dialog.close(value);
    else dialog.remove();
  }

  function confirmDialog(options = {}) {
    return new Promise((resolve) => {
      const dialog = dialogBase(options.title, options.message);
      const actions = document.createElement("div");
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "confirm-cancel";
      cancel.textContent = options.cancelLabel || "Anuluj";

      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className = options.danger === false ? "confirm-save" : "confirm-delete";
      confirm.textContent = options.confirmLabel || (options.danger === false ? "Potwierdź" : "Usuń");

      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(Boolean(value));
      };

      cancel.addEventListener("click", () => closeAndRemove(dialog, "cancel"));
      confirm.addEventListener("click", () => closeAndRemove(dialog, "confirm"));
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        closeAndRemove(dialog, "cancel");
      });
      dialog.addEventListener("close", () => {
        finish(dialog.returnValue === "confirm");
        dialog.remove();
      }, { once: true });

      actions.append(cancel, confirm);
      dialog.append(actions);
      document.body.append(dialog);
      dialog.showModal();
      requestAnimationFrame(() => (options.defaultConfirm ? confirm : cancel).focus());
    });
  }

  function promptDialog(options = {}) {
    return new Promise((resolve) => {
      const dialog = dialogBase(options.title, options.message);
      dialog.classList.add("session-edit-dialog", "nestcafe-prompt-dialog");

      const input = document.createElement("input");
      input.type = options.type || "text";
      input.value = options.value ?? "";
      input.placeholder = options.placeholder || "";
      if (options.min != null) input.min = String(options.min);
      if (options.max != null) input.max = String(options.max);
      if (options.step != null) input.step = String(options.step);
      if (options.ariaLabel || options.label) input.setAttribute("aria-label", options.ariaLabel || options.label);

      const actions = document.createElement("div");
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "confirm-cancel";
      cancel.textContent = options.cancelLabel || "Anuluj";

      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className = "confirm-save";
      confirm.textContent = options.confirmLabel || "Zapisz";

      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const accept = () => {
        if (options.required !== false && !input.value.trim()) {
          input.focus();
          return;
        }
        closeAndRemove(dialog, "confirm");
      };

      cancel.addEventListener("click", () => closeAndRemove(dialog, "cancel"));
      confirm.addEventListener("click", accept);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          accept();
        }
      });
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        closeAndRemove(dialog, "cancel");
      });
      dialog.addEventListener("close", () => {
        finish(dialog.returnValue === "confirm" ? input.value : null);
        dialog.remove();
      }, { once: true });

      actions.append(cancel, confirm);
      dialog.append(input, actions);
      document.body.append(dialog);
      dialog.showModal();
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    });
  }

  root.export("dialogs", {
    confirm: confirmDialog,
    prompt: promptDialog,
  });
})();
