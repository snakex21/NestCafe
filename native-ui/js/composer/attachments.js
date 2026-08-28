"use strict";

const attachmentList = document.querySelector("#attachment-list");
const attachButton = document.querySelector("#attach-button");
const documentLibraryButton = document.querySelector("#document-library-button");
const composer = document.querySelector("#composer");
const promptField = document.querySelector("#prompt");

let attachments = [];

const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

async function attachmentJson(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
  return response.json();
}

function fileName(path) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

/** SuperCli persists attachments as "text\\n\\n📎 file.png" in the transcript. */
const TRANSCRIPT_ATTACHMENT_SUFFIX = /\n\n\u{1F4CE}\s*([^\n]*)$/u;

function stripTranscriptAttachmentSuffix(text) {
  return String(text || "").replace(TRANSCRIPT_ATTACHMENT_SUFFIX, "").trimEnd();
}

function attachmentNamesFromTranscript(text) {
  const match = String(text || "").match(TRANSCRIPT_ATTACHMENT_SUFFIX);
  if (!match?.[1]) return [];
  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderTranscriptAttachmentChips(messageContent, names) {
  if (!messageContent || !names?.length) return;
  const message = messageContent.closest?.(".message");
  if (!message || message.querySelector(".sent-attachment-gallery")) return;
  // Prefer restoring real paths when we still know them for this message.
  const seq = Number(message.dataset.seq || 0);
  const sessionID = window.NestCafe?.getSession?.() || "";
  const remembered = seq && sessionID ? sentAttachmentsFor(sessionID, seq) : [];
  if (remembered.length) {
    renderSentAttachments(messageContent, remembered);
    return;
  }
  const gallery = document.createElement("div");
  gallery.className = "sent-attachment-gallery";
  for (const name of names) {
    const chip = document.createElement("div");
    chip.className = "sent-attachment-chip";
    chip.title = name;
    const icon = document.createElement("span");
    icon.textContent = isPDF(name) ? "PDF" : isImage(name) ? "IMG" : "PLIK";
    const label = document.createElement("strong");
    label.textContent = name;
    chip.append(icon, label);
    gallery.append(chip);
  }
  message.append(gallery);
}

function fileExtension(path) {
  const name = fileName(path);
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function isImage(path) {
  return imageExtensions.has(fileExtension(path));
}

function isPDF(path) {
  return fileExtension(path) === "pdf";
}

function previewURL(path) {
  return `/api/attachment/preview?path=${encodeURIComponent(path)}`;
}

const previewState = {
  paths: [],
  index: 0,
  keyHandler: null,
};

function ensurePreviewDialog() {
  let dialog = document.querySelector("#attachment-preview-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "attachment-preview-dialog";
  dialog.className = "attachment-preview-dialog";
  dialog.innerHTML = `
    <header>
      <div>
        <span class="attachment-preview-kicker">PODGLĄD</span>
        <strong class="attachment-preview-title"></strong>
        <small class="attachment-preview-count" hidden></small>
      </div>
      <button type="button" class="attachment-preview-close" aria-label="Zamknij podgląd">×</button>
    </header>
    <div class="attachment-preview-body">
      <button type="button" class="attachment-preview-nav prev" aria-label="Poprzednie zdjęcie">‹</button>
      <div class="attachment-preview-stage"></div>
      <button type="button" class="attachment-preview-nav next" aria-label="Następne zdjęcie">›</button>
    </div>
    <footer class="attachment-preview-thumbs" hidden></footer>`;
  dialog.querySelector(".attachment-preview-close").addEventListener("click", () => dialog.close());
  dialog.querySelector(".attachment-preview-nav.prev").addEventListener("click", (event) => {
    event.stopPropagation();
    stepPreview(-1);
  });
  dialog.querySelector(".attachment-preview-nav.next").addEventListener("click", (event) => {
    event.stopPropagation();
    stepPreview(1);
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    dialog.querySelector(".attachment-preview-stage").replaceChildren();
    dialog.querySelector(".attachment-preview-thumbs").replaceChildren();
    if (previewState.keyHandler) {
      document.removeEventListener("keydown", previewState.keyHandler, true);
      previewState.keyHandler = null;
    }
    previewState.paths = [];
    previewState.index = 0;
  });
  document.body.append(dialog);
  return dialog;
}

function stepPreview(delta) {
  if (previewState.paths.length < 2) return;
  const next =
    (previewState.index + delta + previewState.paths.length) % previewState.paths.length;
  showPreviewAt(next);
}

function showPreviewAt(index) {
  const dialog = ensurePreviewDialog();
  const paths = previewState.paths;
  if (!paths.length) return;
  const safeIndex = Math.max(0, Math.min(index, paths.length - 1));
  previewState.index = safeIndex;
  const path = paths[safeIndex];
  const stage = dialog.querySelector(".attachment-preview-stage");
  const title = dialog.querySelector(".attachment-preview-title");
  const count = dialog.querySelector(".attachment-preview-count");
  const prev = dialog.querySelector(".attachment-preview-nav.prev");
  const next = dialog.querySelector(".attachment-preview-nav.next");
  const thumbs = dialog.querySelector(".attachment-preview-thumbs");

  title.textContent = fileName(path);
  if (paths.length > 1) {
    count.hidden = false;
    count.textContent = `${safeIndex + 1} / ${paths.length}`;
  } else {
    count.hidden = true;
    count.textContent = "";
  }
  const multi = paths.length > 1;
  prev.hidden = !multi;
  next.hidden = !multi;
  prev.disabled = !multi;
  next.disabled = !multi;

  stage.replaceChildren();
  if (isImage(path)) {
    const image = document.createElement("img");
    image.src = previewURL(path);
    image.alt = fileName(path);
    image.addEventListener(
      "error",
      () => {
        stage.textContent = "Nie udało się otworzyć obrazu.";
      },
      { once: true },
    );
    stage.append(image);
  } else if (isPDF(path)) {
    const frame = document.createElement("iframe");
    frame.src = previewURL(path);
    frame.title = `Podgląd ${fileName(path)}`;
    stage.append(frame);
  } else {
    stage.textContent = "Podgląd niedostępny dla tego typu pliku.";
  }

  if (multi && paths.every(isImage)) {
    thumbs.hidden = false;
    thumbs.replaceChildren();
    paths.forEach((itemPath, itemIndex) => {
      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = `attachment-preview-thumb${itemIndex === safeIndex ? " active" : ""}`;
      thumb.title = fileName(itemPath);
      thumb.setAttribute("aria-label", `Pokaż ${fileName(itemPath)}`);
      const img = document.createElement("img");
      img.src = previewURL(itemPath);
      img.alt = "";
      img.loading = "lazy";
      thumb.append(img);
      thumb.addEventListener("click", (event) => {
        event.stopPropagation();
        showPreviewAt(itemIndex);
      });
      thumbs.append(thumb);
    });
  } else {
    thumbs.hidden = true;
    thumbs.replaceChildren();
  }
}

function openAttachmentPreview(path, paths = null) {
  const list = Array.isArray(paths) && paths.length
    ? paths.filter((item) => isImage(item) || isPDF(item))
    : isImage(path) || isPDF(path)
      ? [path]
      : [];
  if (!list.length) return;
  let index = list.indexOf(path);
  if (index < 0) index = 0;
  previewState.paths = list;
  previewState.index = index;

  const dialog = ensurePreviewDialog();
  if (previewState.keyHandler) {
    document.removeEventListener("keydown", previewState.keyHandler, true);
  }
  previewState.keyHandler = (event) => {
    if (!dialog.open) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepPreview(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      stepPreview(1);
    } else if (event.key === "Escape") {
      dialog.close();
    }
  };
  document.addEventListener("keydown", previewState.keyHandler, true);
  showPreviewAt(index);
  if (!dialog.open) dialog.showModal();
}

const SENT_ATTACHMENT_KEY = "nestcafe-sent-attachments-v1";
let sentAttachmentIndex = loadSentAttachmentIndex();

function loadSentAttachmentIndex() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SENT_ATTACHMENT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSentAttachmentIndex() {
  if (sentAttachmentIndex.length > 240) {
    sentAttachmentIndex = sentAttachmentIndex.slice(-240);
  }
  try {
    localStorage.setItem(SENT_ATTACHMENT_KEY, JSON.stringify(sentAttachmentIndex));
  } catch {
    // private mode / quota — keep memory-only index
  }
}

function rememberSentAttachments(sessionID, seq, paths) {
  if (!sessionID || !seq || !(paths || []).length) return;
  sentAttachmentIndex = sentAttachmentIndex.filter(
    (item) => item.session !== sessionID || item.seq !== seq,
  );
  sentAttachmentIndex.push({
    session: sessionID,
    seq,
    paths: paths.slice(),
    at: Date.now(),
  });
  saveSentAttachmentIndex();
}

function sentAttachmentsFor(sessionID, seq) {
  for (let i = sentAttachmentIndex.length - 1; i >= 0; i -= 1) {
    const item = sentAttachmentIndex[i];
    if (item.session === sessionID && item.seq === seq) {
      return (item.paths || []).slice();
    }
  }
  return [];
}

function forgetSentAttachments(sessionID, fromSeq) {
  sentAttachmentIndex = sentAttachmentIndex.filter((item) => {
    if (item.session !== sessionID) return true;
    return fromSeq && item.seq < fromSeq;
  });
  saveSentAttachmentIndex();
}

function renderSentAttachments(messageContent, paths) {
  if (!messageContent || !paths?.length) return;
  const message = messageContent.closest?.(".message") || messageContent;
  const host =
    message.querySelector?.(".message-body") ||
    messageContent.parentElement ||
    message;
  if (!host) return;
  if (host.querySelector(".sent-attachment-gallery") || message.querySelector?.(".sent-attachment-gallery")) {
    return;
  }

  const gallery = document.createElement("div");
  const images = paths.filter(isImage);
  gallery.className = `sent-attachment-gallery${images.length === 1 ? " single" : ""}`;
  gallery.dataset.count = String(paths.length);

  for (const path of paths) {
    const button = document.createElement("button");
    button.type = "button";
    button.title = path;
    button.className = "sent-attachment-preview";
    if (isImage(path)) {
      const image = document.createElement("img");
      image.src = previewURL(path);
      image.alt = fileName(path);
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener(
        "error",
        () => {
          button.replaceChildren();
          const icon = document.createElement("span");
          icon.textContent = "IMG";
          const name = document.createElement("strong");
          name.textContent = fileName(path);
          button.append(icon, name);
          button.disabled = true;
        },
        { once: true },
      );
      button.append(image);
    } else {
      const icon = document.createElement("span");
      icon.textContent = isPDF(path) ? "PDF" : "PLIK";
      const name = document.createElement("strong");
      name.textContent = fileName(path);
      button.append(icon, name);
    }
    button.disabled = !isImage(path) && !isPDF(path);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openAttachmentPreview(path, paths);
    });
    gallery.append(button);
  }

  // Prefer inside the bubble so layout/theme CSS cannot orphan the gallery.
  host.append(gallery);
}

function attachmentStatus(path) {
  if (!isImage(path)) return "";
  return "Obraz gotowy";
}

function renderAttachments() {
  attachmentList.replaceChildren();
  attachmentList.hidden = attachments.length === 0;
  for (const path of attachments) {
    const chip = document.createElement("article");
    chip.className = `attachment-chip${isImage(path) ? " image" : ""}${isPDF(path) ? " pdf" : ""}`;
    chip.title = path;

    const preview = document.createElement("button");
    preview.type = "button";
    preview.className = "attachment-preview-trigger";
    preview.disabled = !isImage(path) && !isPDF(path);
    preview.setAttribute("aria-label", `Podgląd ${fileName(path)}`);
    if (isImage(path)) {
      const thumb = document.createElement("img");
      thumb.src = previewURL(path);
      thumb.alt = "";
      thumb.loading = "lazy";
      preview.append(thumb);
    } else {
      const icon = document.createElement("i");
      icon.textContent = isPDF(path) ? "PDF" : "PLIK";
      preview.append(icon);
    }
    const copy = document.createElement("span");
    copy.className = "attachment-copy";
    const name = document.createElement("strong");
    name.textContent = fileName(path);
    copy.append(name);
    const status = attachmentStatus(path);
    if (status) {
      const badge = document.createElement("small");
      badge.className = "vision-ready";
      badge.textContent = status;
      copy.append(badge);
    }
    preview.append(copy);
    preview.addEventListener("click", () => openAttachmentPreview(path, attachments));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "attachment-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Usuń ${fileName(path)}`);
    remove.addEventListener("click", () => {
      attachments = attachments.filter((item) => item !== path);
      renderAttachments();
    });
    chip.append(preview, remove);
    attachmentList.appendChild(chip);
  }
}

function addAttachmentPaths(paths) {
  for (const path of paths || []) {
    if (!path || attachments.includes(path)) continue;
    attachments.push(path);
  }
  renderAttachments();
}

function replaceAttachmentPaths(paths) {
  attachments = [];
  addAttachmentPaths(paths || []);
}

async function uploadFiles(files) {
  const body = new FormData();
  for (const file of [...files]) body.append("files", file, file.name || "clipboard.png");
  const result = await attachmentJson("/api/attachment/upload", { method: "POST", body });
  addAttachmentPaths(result.paths || []);
}

async function chooseAttachments() {
  attachButton.disabled = true;
  try {
    const result = await attachmentJson("/api/file-picker");
    addAttachmentPaths(result.paths || []);
  } catch (error) {
    window.NestCafe?.toast?.(error.message);
  } finally {
    attachButton.disabled = false;
  }
}

attachButton.addEventListener("click", chooseAttachments);
documentLibraryButton.addEventListener("click", () => {
  window.NestCafe?.settings?.openPage?.("folders");
});
window.addEventListener("nestcafe:model-changed", renderAttachments);

promptField.addEventListener("paste", async (event) => {
  const files = [...(event.clipboardData?.items || [])]
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter(Boolean);
  if (!files.length) return;
  event.preventDefault();
  try {
    await uploadFiles(files);
  } catch (error) {
    window.NestCafe?.toast?.(error.message);
  }
});

composer.addEventListener("dragover", (event) => {
  if (composer.classList.contains("question-pending")) return;
  if (!event.dataTransfer?.types?.includes("Files")) return;
  event.preventDefault();
  composer.classList.add("attachment-drop-active");
});
composer.addEventListener("dragleave", () => composer.classList.remove("attachment-drop-active"));
composer.addEventListener("drop", async (event) => {
  composer.classList.remove("attachment-drop-active");
  if (!event.dataTransfer?.files?.length) return;
  event.preventDefault();
  if (composer.classList.contains("question-pending")) {
    window.NestCafe?.toast?.("Najpierw odpowiedz na pytanie agenta powyżej.");
    return;
  }
  try {
    await uploadFiles(event.dataTransfer.files);
  } catch (error) {
    window.NestCafe?.toast?.(error.message);
  }
});

const attachmentsApi = {
  list: () => [...attachments],
  clear: () => {
    attachments = [];
    renderAttachments();
  },
  replace: replaceAttachmentPaths,
  openPreview: openAttachmentPreview,
  renderSent: renderSentAttachments,
  displayText: stripTranscriptAttachmentSuffix,
  namesFromTranscript: attachmentNamesFromTranscript,
  renderTranscriptChips: renderTranscriptAttachmentChips,
  remember: rememberSentAttachments,
  forMessage: sentAttachmentsFor,
  forget: forgetSentAttachments,
  // Shared SuperCli health still reports a technical working directory.
  // Office mode deliberately does not expose it as a user-facing active folder.
  setWorkspace: () => {},
};

window.NestCafe.export("attachments", attachmentsApi);
