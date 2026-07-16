"use strict";

const resultTools = new Set(["edit_docx", "edit_xlsx"]);

function resultParent(path) {
  const clean = path.replace(/[\\/]+$/, "");
  const index = Math.max(clean.lastIndexOf("\\"), clean.lastIndexOf("/"));
  return index >= 0 ? clean.slice(0, index) || "." : ".";
}

async function openResultFolder(path, button) {
  button.disabled = true;
  try {
    const response = await fetch("/api/folder/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: resultParent(path) }),
    });
    if (!response.ok) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
  } catch (error) {
    window.showNestCafeToast?.(error.message);
  } finally {
    button.disabled = false;
  }
}

window.enhanceNestCafeToolResult = (row, event) => {
  if (event.err || !resultTools.has(row.dataset.toolName)) return;
  let args;
  try {
    args = JSON.parse(row.dataset.toolArgs || "{}");
  } catch {
    return;
  }
  if (!args.path) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "activity-result-action";
  button.textContent = "Otwórz folder";
  button.addEventListener("click", () => openResultFolder(args.path, button));
  row.appendChild(button);
};
