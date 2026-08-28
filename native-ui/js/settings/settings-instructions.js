"use strict";

const register =
  window.NestCafe?.settings?.registerPage;

register?.("instructions", "Instrukcje AI", async (root) => {
  root.replaceChildren(
    window.SuperCliUI.createUserInstructionsEditor({
      lang: "pl",
      className: "settings-panel nestcafe-user-instructions",
      onSaved: (state) => {
        window.NestCafe?.toast?.(
          state.enabled
            ? "Instrukcje będą używane od następnej wiadomości."
            : "Instrukcje są wyłączone.",
        );
      },
    }),
  );
});
