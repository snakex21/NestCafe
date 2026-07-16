"use strict";

const searchDialog = document.createElement("dialog");
searchDialog.className = "search-dialog";
searchDialog.innerHTML = `
  <div class="search-head">
    <span aria-hidden="true">⌕</span>
    <input type="search" placeholder="Szukaj zadań…" aria-label="Szukaj zadań" />
    <button type="button" aria-label="Zamknij">×</button>
  </div>
  <button class="search-new" type="button">＋&nbsp; Nowe zadanie</button>
  <span class="search-period">Ostatnie rozmowy</span>
  <div class="search-results"></div>
  <footer>↑↓ Nawiguj &nbsp; · &nbsp; Enter Wybierz &nbsp; · &nbsp; Esc Zamknij</footer>`;
document.body.appendChild(searchDialog);

const confirmDialog = document.createElement("dialog");
confirmDialog.className = "confirm-dialog";
confirmDialog.innerHTML = `
  <h3>Usunąć wszystkie rozmowy?</h3>
  <p>Usunięte zostaną rozmowy z bieżącego projektu. Pliki projektu pozostaną bez zmian.</p>
  <div><button class="confirm-cancel" type="button">Anuluj</button><button class="confirm-delete" type="button">Usuń wszystkie</button></div>`;
document.body.appendChild(confirmDialog);

const searchInput = searchDialog.querySelector("input");
const searchResults = searchDialog.querySelector(".search-results");
let sessions = [];
let selected = 0;

async function searchJSON(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
  return response.json();
}

function escapeSearch(text) {
  const node = document.createElement("span");
  node.textContent = text;
  return node.innerHTML;
}

function renderSearch() {
  const query = searchInput.value.trim().toLowerCase();
  const visible = sessions.filter((item) =>
    `${item.first_user_msg || ""} ${item.model || ""}`.toLowerCase().includes(query));
  selected = Math.min(selected, Math.max(visible.length - 1, 0));
  searchResults.replaceChildren();
  for (const [index, session] of visible.entries()) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = index === selected ? "selected" : "";
    row.innerHTML = `<i></i><span>${escapeSearch(session.first_user_msg || "Rozmowa")}</span><small>${session.message_count || 0}</small>`;
    row.addEventListener("click", () => openSearchSession(session));
    searchResults.appendChild(row);
  }
  if (!visible.length) searchResults.innerHTML = `<p>Nie znaleziono rozmów.</p>`;
}

async function openSearchSession(session) {
  searchDialog.close();
  await window.resumeNestCafeSession?.(session.id);
}

async function openSearch() {
  try {
    sessions = await searchJSON("/api/sessions?limit=0");
    selected = 0;
    searchInput.value = "";
    renderSearch();
    searchDialog.showModal();
    searchInput.focus();
  } catch (error) {
    window.showNestCafeToast?.(error.message);
  }
}

searchInput.addEventListener("input", () => { selected = 0; renderSearch(); });
searchInput.addEventListener("keydown", (event) => {
  const rows = [...searchResults.querySelectorAll("button")];
  if ((event.key === "ArrowDown" || event.key === "ArrowUp") && rows.length) {
    event.preventDefault();
    selected = (selected + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
    renderSearch();
  } else if (event.key === "Enter" && rows[selected]) {
    event.preventDefault();
    rows[selected].click();
  }
});

searchDialog.querySelector(".search-head button").addEventListener("click", () => searchDialog.close());
searchDialog.querySelector(".search-new").addEventListener("click", () => {
  searchDialog.close();
  window.startNestCafeConversation?.();
});
document.querySelector("#search-sessions").addEventListener("click", openSearch);

document.querySelector("#clear-sessions").addEventListener("click", () => confirmDialog.showModal());
confirmDialog.querySelector(".confirm-cancel").addEventListener("click", () => confirmDialog.close());
confirmDialog.querySelector(".confirm-delete").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "Usuwam…";
  try {
    const all = await searchJSON("/api/sessions?limit=0");
    for (const session of all) {
      await searchJSON(`/api/sessions?id=${encodeURIComponent(session.id)}`, { method: "DELETE" });
    }
    window.clearNestCafeFavorites?.();
    confirmDialog.close();
    window.startNestCafeConversation?.();
  } catch (error) {
    window.showNestCafeToast?.(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Usuń wszystkie";
  }
});
