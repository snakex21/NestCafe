"use strict";

const favoriteKey = "nestcafe.favorite.sessions";

function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem(favoriteKey) || "[]");
  } catch {
    return [];
  }
}

function saveFavorites(items) {
  localStorage.setItem(favoriteKey, JSON.stringify(items.slice(0, 20)));
}

function cleanFavoriteTitle(text) {
  return String(text || "").replace(/\s*\u{1F4CE}\s*[^\r\n]*$/u, "").trim() || "Rozmowa";
}

function renderFavorites() {
  const list = document.querySelector("#favorite-list");
  if (!list) return;
  const favorites = loadFavorites();
  list.replaceChildren();
  for (const favorite of favorites) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "favorite-item";
    const pin = document.createElement("span");
    pin.className = "favorite-pin";
    pin.textContent = "★";
    pin.setAttribute("aria-hidden", "true");
    const favoriteTitle = cleanFavoriteTitle(favorite.title);
    const title = window.NestCafe?.marquee?.create?.(favoriteTitle, { tagName: "strong", className: "favorite-title" }) || document.createElement("strong");
    if (!title.textContent) title.textContent = favoriteTitle;
    button.append(pin, title);
    button.addEventListener("click", async () => {
      try {
        await window.NestCafe?.resumeSession?.(favorite.id);
      } catch (error) {
        const current = loadFavorites().filter((item) => item.id !== favorite.id);
        saveFavorites(current);
        renderFavorites();
        window.NestCafe?.toast?.(error?.message || "Nie udało się otworzyć ulubionej rozmowy.");
      }
    });
    list.appendChild(button);
  }
  const section = document.querySelector("#favorites");
  if (section) {
    section.hidden = favorites.length === 0;
    section.classList.toggle("has-items", favorites.length > 0);
  }
}

function decorateSession(row, session) {
  const toggle = document.createElement("span");
  toggle.className = "favorite-toggle";
  toggle.setAttribute("role", "button");
  toggle.title = "Dodaj do ulubionych";
  toggle.textContent = "☆";
  const refresh = () => {
    const active = loadFavorites().some((item) => item.id === session.id);
    toggle.classList.toggle("active", active);
    toggle.textContent = active ? "★" : "☆";
    toggle.title = active ? "Usuń z ulubionych" : "Dodaj do ulubionych";
  };
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const favorites = loadFavorites();
    const index = favorites.findIndex((item) => item.id === session.id);
    if (index >= 0) favorites.splice(index, 1);
    else favorites.unshift({ id: session.id, title: window.NestCafe?.sessionTitle?.(session) || "Rozmowa" });
    saveFavorites(favorites);
    refresh();
    renderFavorites();
  });
  refresh();
  row.appendChild(toggle);
}

function removeFavorite(sessionID) {
  const favorites = loadFavorites().filter((item) => item.id !== sessionID);
  saveFavorites(favorites);
  renderFavorites();
}

function updateFavoriteTitle(sessionID, title) {
  const favorites = loadFavorites();
  const item = favorites.find((favorite) => favorite.id === sessionID);
  if (!item) return;
  item.title = String(title || "Rozmowa").trim() || "Rozmowa";
  saveFavorites(favorites);
  renderFavorites();
}

function clearFavorites() {
  localStorage.removeItem(favoriteKey);
  renderFavorites();
}

const favoritesApi = {
  render: renderFavorites,
  decorateSession,
  remove: removeFavorite,
  updateTitle: updateFavoriteTitle,
  clear: clearFavorites,
};

window.NestCafe.export("favorites", favoritesApi);
renderFavorites();
