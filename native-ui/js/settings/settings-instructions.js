"use strict";

const register =
  window.NestCafe?.settings?.registerPage;

register?.("instructions", t("settings.nav.instructions"), async (root) => {
  root.replaceChildren(
    window.SuperCliUI.createUserInstructionsEditor({
      // The shared editor has Polish copy for "pl" and English for everything else.
      lang: window.NestCafe?.i18n?.lang || "en",
      className: "settings-panel nestcafe-user-instructions",
      onSaved: (state) => {
        window.NestCafe?.toast?.(
          state.enabled
            ? t("settings.instructions.enabled")
            : t("settings.instructions.disabled"),
        );
      },
    }),
  );
});
