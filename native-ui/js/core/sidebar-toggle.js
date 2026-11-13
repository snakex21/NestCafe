"use strict";

// Sidebar drawer for narrow windows (see css/components/responsive-nav.css).
(() => {
  const toggle = document.querySelector("#sidebar-toggle");
  const sidebar = document.querySelector(".sidebar");
  if (!toggle || !sidebar) return;
  const narrow = window.matchMedia("(max-width: 860px)");

  function setOpen(open) {
    const active = Boolean(open) && narrow.matches;
    document.body.classList.toggle("sidebar-open", active);
    toggle.setAttribute("aria-expanded", active ? "true" : "false");
    toggle.setAttribute("aria-label", active ? "Ukryj menu" : "Pokaż menu");
    toggle.title = active ? "Ukryj menu" : "Pokaż menu";
    toggle.textContent = active ? "×" : "☰";
    if (active) sidebar.querySelector("button")?.focus();
  }

  toggle.addEventListener("click", () => setOpen(!document.body.classList.contains("sidebar-open")));
  // Picking anything in the drawer (session, new chat, module, settings) closes it.
  sidebar.addEventListener("click", (event) => {
    if (document.body.classList.contains("sidebar-open") && event.target.closest("button, a")) setOpen(false);
  });
  // A click on the dimmed area outside the drawer closes it.
  document.addEventListener("pointerdown", (event) => {
    if (!document.body.classList.contains("sidebar-open")) return;
    if (sidebar.contains(event.target) || toggle.contains(event.target)) return;
    setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
      setOpen(false);
      toggle.focus();
    }
  });
  narrow.addEventListener("change", () => setOpen(false));
  window.NestCafe?.export?.("sidebar", { open: () => setOpen(true), close: () => setOpen(false) });
})();
