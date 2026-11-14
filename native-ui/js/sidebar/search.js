"use strict";

const searchDialog = document.createElement("dialog");
searchDialog.className = "search-dialog";
searchDialog.innerHTML = `
  <div class="search-head">
    <span aria-hidden="true">⌕</span>
    <input type="search" placeholder="${escapeSearch(t("sidebar.search.placeholder"))}" aria-label="${escapeSearch(t("sidebar.search.label"))}" />
    <button type="button" aria-label="${escapeSearch(t("common.close"))}">×</button>
  </div>
  <button class="search-new" type="button">＋&nbsp; ${escapeSearch(t("sidebar.search.newTask"))}</button>
  <span class="search-period">${escapeSearch(t("sidebar.search.recent"))}</span>
  <div class="search-results"></div>
  <footer>↑↓ ${escapeSearch(t("sidebar.search.navigate"))} &nbsp; · &nbsp; Enter ${escapeSearch(t("sidebar.search.select"))} &nbsp; · &nbsp; Esc ${escapeSearch(t("common.close"))}</footer>`;
document.body.appendChild(searchDialog);

const confirmDialog = document.createElement("dialog");
confirmDialog.className = "confirm-dialog";
confirmDialog.innerHTML = `
  <h3>${escapeSearch(t("sidebar.clearAll.title"))}</h3>
  <p>${escapeSearch(t("sidebar.clearAll.body"))}</p>
  <div><button class="confirm-cancel" type="button">${escapeSearch(t("common.cancel"))}</button><button class="confirm-delete" type="button">${escapeSearch(t("sidebar.clearAll.confirm"))}</button></div>`;
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
    `${window.NestCafe?.sessionTitle?.(item) || item.first_user_msg || ""} ${item.model || ""}`.toLowerCase().includes(query));
  selected = Math.min(selected, Math.max(visible.length - 1, 0));
  searchResults.replaceChildren();
  for (const [index, session] of visible.entries()) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = index === selected ? "selected" : "";
    row.innerHTML = `<i></i><span>${escapeSearch(window.NestCafe?.sessionTitle?.(session) || t("app.session.untitled"))}</span><small>${session.message_count || 0}</small>`;
    row.addEventListener("click", () => openSearchSession(session));
    searchResults.appendChild(row);
  }
  if (!visible.length) searchResults.innerHTML = `<p>${escapeSearch(t("sidebar.search.empty"))}</p>`;
}

async function openSearchSession(session) {
  searchDialog.close();
  await window.NestCafe?.resumeSession?.(session.id);
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
    window.NestCafe?.toast?.(error.message);
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
  window.NestCafe?.startConversation?.();
});
document.querySelector("#search-sessions").addEventListener("click", openSearch);

document.querySelector("#clear-sessions").addEventListener("click", () => confirmDialog.showModal());
confirmDialog.querySelector(".confirm-cancel").addEventListener("click", () => confirmDialog.close());
confirmDialog.querySelector(".confirm-delete").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = t("sidebar.clearAll.deleting");
  try {
    const all = await searchJSON("/api/sessions?limit=0");
    for (const session of all) {
      await searchJSON(`/api/sessions?id=${encodeURIComponent(session.id)}`, { method: "DELETE" });
    }
    window.NestCafe?.favorites?.clear?.();
    window.NestCafe?.clearSessionTitles?.();
    confirmDialog.close();
    window.NestCafe?.startConversation?.();
  } catch (error) {
    window.NestCafe?.toast?.(error.message);
  } finally {
    button.disabled = false;
    button.textContent = t("sidebar.clearAll.confirm");
  }
});
