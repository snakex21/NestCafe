"use strict";

const MARQUEE_GAP = 26;
const MARQUEE_SPEED = 72;
const marqueeObservers = new WeakMap();

function updateMarquee(viewport) {
  if (!viewport?.isConnected) return;
  const primary = viewport.querySelector(".nc-marquee-copy:not([aria-hidden])");
  if (!primary) return;

  const available = viewport.clientWidth;
  const contentWidth = primary.scrollWidth;
  const overflowing = available > 0 && contentWidth > available + 1;

  viewport.classList.toggle("is-overflowing", overflowing);
  if (!overflowing) {
    viewport.style.removeProperty("--nc-marquee-distance");
    viewport.style.removeProperty("--nc-marquee-duration");
    return;
  }

  const distance = contentWidth + MARQUEE_GAP;
  const duration = Math.max(2.2, Math.min(8, distance / MARQUEE_SPEED));
  viewport.style.setProperty("--nc-marquee-distance", `${distance}px`);
  viewport.style.setProperty("--nc-marquee-duration", `${duration.toFixed(2)}s`);
}

function observeMarquee(viewport) {
  const refresh = () => updateMarquee(viewport);
  requestAnimationFrame(refresh);
  viewport.addEventListener("pointerenter", refresh);
  viewport.addEventListener("focusin", refresh);

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(refresh);
    observer.observe(viewport);
    marqueeObservers.set(viewport, observer);
  }
}

function createMarquee(text, options = {}) {
  const viewport = document.createElement(options.tagName || "strong");
  viewport.className = `nc-marquee${options.className ? ` ${options.className}` : ""}`;
  viewport.title = text || "";

  const track = document.createElement("span");
  track.className = "nc-marquee-track";

  const primary = document.createElement("span");
  primary.className = "nc-marquee-copy";
  primary.textContent = text || "";

  const duplicate = document.createElement("span");
  duplicate.className = "nc-marquee-copy";
  duplicate.textContent = text || "";
  duplicate.setAttribute("aria-hidden", "true");

  track.append(primary, duplicate);
  viewport.append(track);
  observeMarquee(viewport);
  return viewport;
}

function refreshMarquees(root = document) {
  root.querySelectorAll?.(".nc-marquee").forEach(updateMarquee);
}

window.NestCafe.export("marquee", {
  create: createMarquee,
  refresh: refreshMarquees,
});
