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
  if (source === "project") return t("dialogs.skills.source.project");
  if (source === "user") return t("dialogs.skills.source.user");
  if (source === "builtin") return t("dialogs.skills.source.builtin");
  return source || t("dialogs.skills.source.catalog");
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
  description.textContent = item.description || t("dialogs.skills.noDescription");
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
  risk.textContent = item.risk === "high" ? t("dialogs.skills.riskHigh") : t("dialogs.skills.ready");
  row.append(icon, copy, risk);
  return row;
}

function setSkillsMessage(title, detail) {
  const empty = document.createElement("div");
  empty.className = "skills-empty";
  empty.innerHTML = `<strong></strong><span></span>`;
  empty.querySelector("strong").textContent = title || t("dialogs.skills.emptyTitle");
  empty.querySelector("span").textContent = detail || t("dialogs.skills.emptyDetail");
  skillsList.replaceChildren(empty);
}

async function loadSkills(reset = true) {
  if (skillsBusy) return;
  skillsBusy = true;
  skillsMore.disabled = true;
  if (reset) {
    skillsOffset = 0;
    skillsSummary.textContent = t("dialogs.skills.loading");
  }
  try {
    const query = encodeURIComponent(skillsSearch.value.trim());
    const data = await skillsJson(`/api/skills?q=${query}&offset=${skillsOffset}&limit=${skillsPageSize}`);
    const items = data.items || [];
    skillsTotal = Number(data.total || 0);
    if (reset) skillsList.replaceChildren();
    for (const item of items) skillsList.appendChild(renderSkill(item));
    skillsOffset += items.length;
    skillsSummary.textContent = t("dialogs.skills.summary", { shown: skillsOffset, total: skillsTotal });
    skillsMore.hidden = skillsOffset >= skillsTotal;
    if (!skillsTotal) {
      if (skillsSearch.value.trim()) setSkillsMessage(t("dialogs.skills.noResultsTitle"), t("dialogs.skills.noResultsDetail"));
      else setSkillsMessage(t("dialogs.skills.catalogEmptyTitle"), t("dialogs.skills.catalogEmptyDetail"));
    }
  } catch (error) {
    skillsSummary.textContent = t("dialogs.skills.unavailable");
    skillsMore.hidden = true;
    setSkillsMessage(t("dialogs.skills.loadFailed"), error.message || t("dialogs.skills.networkError"));
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
