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
  const icon = document.createElement("span");
  icon.className = "skill-icon";
  icon.textContent = (item.name || "S").trim().charAt(0).toUpperCase();
  const copy = document.createElement("div");
  copy.className = "skill-copy";
  const heading = document.createElement("div");
  heading.className = "skill-heading";
  const title = document.createElement("strong");
  title.textContent = item.name;
  const source = document.createElement("span");
  source.className = `skill-source source-${item.source || "catalog"}`;
  source.textContent = skillSourceLabel(item.source);
  heading.append(title, source);
  const description = document.createElement("p");
  description.textContent = item.description || "Brak krótkiego opisu.";
  const tags = document.createElement("div");
  tags.className = "skill-tags";
  for (const tag of [item.category, ...(item.tags || []).slice(0, 3)].filter(Boolean)) {
    const pill = document.createElement("span");
    pill.textContent = tag;
    tags.append(pill);
  }
  copy.append(heading, description, tags);
  const risk = document.createElement("small");
  risk.className = `skill-risk risk-${item.risk || "standard"}`;
  risk.textContent = item.risk === "high" ? "podwyższone uprawnienia" : "gotowa";
  row.append(icon, copy, risk);
  return row;
}

function setSkillsMessage(text) {
  const empty = document.createElement("div");
  empty.className = "skills-empty";
  empty.innerHTML = `<strong></strong><span></span>`;
  const [title, detail] = String(text || "").split(/\n+/, 2);
  empty.querySelector("strong").textContent = title || "Brak umiejętności";
  empty.querySelector("span").textContent =
    detail || "Katalog jest pusty albo filtr niczego nie zwraca.";
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
    if (!skillsTotal) {
      setSkillsMessage(
        skillsSearch.value.trim()
          ? "Brak wyników\nZmień frazę wyszukiwania."
          : "Katalog jest pusty\nNie załadowano żadnych umiejętności.",
      );
    }
  } catch (error) {
    skillsSummary.textContent = "Katalog niedostępny";
    skillsMore.hidden = true;
    setSkillsMessage(`Nie udało się wczytać\n${error.message || "Błąd sieci."}`);
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
function openSkillsBrowser() {
  skillsSearch.value = "";
  loadSkills(true);
  setTimeout(() => skillsSearch.focus(), 0);
}

window.NestCafe.export("skills", { load: openSkillsBrowser });
