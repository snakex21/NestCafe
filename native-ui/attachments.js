"use strict";

const attachmentList = document.querySelector("#attachment-list");
const attachButton = document.querySelector("#attach-button");
const workspaceButton = document.querySelector("#workspace-button");

let attachments = [];
let activeWorkspace = "";

async function attachmentJson(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
  return response.json();
}

function fileName(path) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function parentFolder(path) {
  const clean = path.replace(/[\\/]+$/, "");
  const index = Math.max(clean.lastIndexOf("\\"), clean.lastIndexOf("/"));
  return index > 0 ? clean.slice(0, index) : clean;
}

function isInsideWorkspace(path, workspace) {
  if (!workspace) return false;
  const normalizedPath = path.replace(/\//g, "\\").toLowerCase();
  const normalizedHome = workspace.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
  return normalizedPath === normalizedHome || normalizedPath.startsWith(`${normalizedHome}\\`);
}

function renderAttachments() {
  attachmentList.replaceChildren();
  attachmentList.hidden = attachments.length === 0;
  for (const path of attachments) {
    const chip = document.createElement("div");
    chip.className = "attachment-chip";
    chip.title = path;
    const name = document.createElement("span");
    name.textContent = fileName(path);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Usuń ${fileName(path)}`);
    remove.addEventListener("click", () => {
      attachments = attachments.filter((item) => item !== path);
      renderAttachments();
    });
    chip.append(name, remove);
    attachmentList.appendChild(chip);
  }
}

async function setWorkspace(path) {
  const name = fileName(path);
  const response = await attachmentJson("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "add", target: path, name }),
  });
  activeWorkspace = response.home || path;
  workspaceButton.textContent = fileName(activeWorkspace);
  workspaceButton.title = activeWorkspace;
  window.startNestCafeConversation?.();
  await window.refreshNestCafeHealth?.();
}

async function chooseWorkspace() {
  try {
    const result = await attachmentJson("/api/folder-picker");
    if (!result.path) return;
    await setWorkspace(result.path);
    window.showNestCafeToast?.(`Folder roboczy: ${result.path}`);
  } catch (error) {
    window.showNestCafeToast?.(error.message);
  }
}

async function chooseAttachments() {
  attachButton.disabled = true;
  try {
    const result = await attachmentJson("/api/file-picker");
    const paths = result.paths || [];
    if (!paths.length) return;
    activeWorkspace = result.workspace || activeWorkspace;
    const outside = paths.find((path) => !isInsideWorkspace(path, activeWorkspace));
    if (outside) {
      const folder = parentFolder(outside);
      const approved = confirm(
        `Wybrany plik jest poza folderem roboczym.\n\nUstawić „${folder}” jako folder roboczy?`,
      );
      if (!approved) return;
      await setWorkspace(folder);
    }
    let skipped = false;
    for (const path of paths) {
      if (attachments.includes(path)) continue;
      if (attachments.length >= 8) {
        skipped = true;
        continue;
      }
      attachments.push(path);
    }
    renderAttachments();
    if (skipped) {
      window.showNestCafeToast?.("Do jednej wiadomości można dołączyć maksymalnie 8 plików.");
    }
  } catch (error) {
    window.showNestCafeToast?.(error.message);
  } finally {
    attachButton.disabled = false;
  }
}

attachButton.addEventListener("click", chooseAttachments);
workspaceButton.addEventListener("click", chooseWorkspace);

window.getNestCafeAttachments = () => [...attachments];
window.clearNestCafeAttachments = () => {
  attachments = [];
  renderAttachments();
};
window.setNestCafeWorkspace = (path) => {
  activeWorkspace = path || "";
  workspaceButton.textContent = activeWorkspace ? fileName(activeWorkspace) : "Folder roboczy";
  workspaceButton.title = activeWorkspace || "Zmień folder roboczy";
};
