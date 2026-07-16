"use strict";

const skillsDialog = document.querySelector("#skills-dialog");
const skillsSearch = document.querySelector("#skills-search");
const skillsSummary = document.querySelector("#skills-summary");
const skillsList = document.querySelector("#skills-list");
const skillsMore = document.querySelector("#skills-more");

const skillsPageSize = 50;
let skillsOffset = 0;
let skillsTotal = 0;
let skillsBusy = false;
let skillsTimer = 0;

async function skillsJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
  return response.json();
}

function skillSourceLabel(source) {
  if (source === "project") return "projekt";
  if (source === "user") return "użytkownik";
  if (source === "builtin") return "wbudowana";
  return source || "katalog";
}

function renderSkill(item) {
  const row = document.createElement("article");
  row.className = "skill-row";
  const title = document.createElement("strong");
  title.textContent = item.name;
  const description = document.createElement("p");
  description.textContent = item.description || "Brak krótkiego opisu.";
  const meta = document.createElement("small");
  meta.textContent = [item.category, skillSourceLabel(item.source)].filter(Boolean).join(" · ");
  row.append(title, description, meta);
  return row;
}

function setSkillsMessage(text) {
  const empty = document.createElement("div");
  empty.className = "skills-empty";
  empty.textContent = text;
  skillsList.replaceChildren(empty);
}

async function loadSkills(reset = true) {
  if (skillsBusy) return;
  skillsBusy = true;
  skillsMore.disabled = true;
  if (reset) {
    skillsOffset = 0;
    skillsSummary.textContent = "Ładowanie katalogu…";
  }
  try {
    const query = encodeURIComponent(skillsSearch.value.trim());
    const data = await skillsJson(`/api/skills?q=${query}&offset=${skillsOffset}&limit=${skillsPageSize}`);
    const items = data.items || [];
    skillsTotal = Number(data.total || 0);
    if (reset) skillsList.replaceChildren();
    for (const item of items) skillsList.appendChild(renderSkill(item));
    skillsOffset += items.length;
    skillsSummary.textContent = `${skillsOffset} z ${skillsTotal}`;
    skillsMore.hidden = skillsOffset >= skillsTotal;
    if (!skillsTotal) setSkillsMessage("Nie znaleziono pasujących umiejętności.");
  } catch (error) {
    skillsSummary.textContent = "Katalog niedostępny";
    skillsMore.hidden = true;
    setSkillsMessage(error.message);
  } finally {
    skillsBusy = false;
    skillsMore.disabled = false;
  }
}

skillsSearch.addEventListener("input", () => {
  clearTimeout(skillsTimer);
  skillsTimer = setTimeout(() => loadSkills(true), 160);
});
skillsMore.addEventListener("click", () => loadSkills(false));
window.loadNestCafeSkills = () => {
  skillsSearch.value = "";
  loadSkills(true);
  setTimeout(() => skillsSearch.focus(), 0);
};
