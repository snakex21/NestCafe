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

function renderFavorites() {
  const list = document.querySelector("#favorite-list");
  if (!list) return;
  const favorites = loadFavorites();
  list.replaceChildren();
  for (const favorite of favorites) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = favorite.title || "Rozmowa";
    button.addEventListener("click", () => window.resumeNestCafeSession?.(favorite.id));
    list.appendChild(button);
  }
  document.querySelector("#favorites")?.classList.toggle("has-items", favorites.length > 0);
}

window.decorateNestCafeSession = (row, session) => {
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
    else favorites.unshift({ id: session.id, title: session.first_user_msg || "Rozmowa" });
    saveFavorites(favorites);
    refresh();
    renderFavorites();
  });
  refresh();
  row.appendChild(toggle);
};

window.clearNestCafeFavorites = () => {
  localStorage.removeItem(favoriteKey);
  renderFavorites();
};

window.renderNestCafeFavorites = renderFavorites;
renderFavorites();
