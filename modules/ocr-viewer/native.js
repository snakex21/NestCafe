"use strict";

(function () {
  window.NestCafeModules = window.NestCafeModules || {};

  // Values are catalog keys; translate with t() at render time.
  const languages = {
    pl: "ocr.language.pl",
    en: "ocr.language.en",
    de: "ocr.language.de",
    fr: "ocr.language.fr",
    es: "ocr.language.es",
  };

  const languageTitles = {
    pl: "ocr.result.title.pl",
    en: "ocr.result.title.en",
    de: "ocr.result.title.de",
    fr: "ocr.result.title.fr",
    es: "ocr.result.title.es",
  };

  const textModes = {
    original: "ocr.history.mode.original",
    translate: "ocr.history.mode.translate",
  };

  function languageName(code) {
    return t(languages[code] || languages.pl);
  }

  const languagePromptNames = {
    pl: "Polish",
    en: "English",
    de: "German",
    fr: "French",
    es: "Spanish",
  };

  const outputFormats = {
    docx: { label: "ocr.format.docx", action: "ocr.format.docxAction" },
    md: { label: "ocr.format.md", action: "ocr.format.mdAction" },
    txt: { label: "ocr.format.txt", action: "ocr.format.txtAction" },
  };

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
      reader.addEventListener("error", () => reject(reader.error || new Error(t("ocr.error.readFile"))), { once: true });
      reader.readAsDataURL(file);
    });
  }

  function splitDataURL(dataURL) {
    const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataURL);
    if (!match) throw new Error(t("ocr.error.imageFormat"));
    return { mimeType: match[1], imageBase64: match[2] };
  }

  function loadScript(src, key) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-ocr-library="${key}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.dataset.ocrLibrary = key;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error(t("ocr.error.loadScript", { src }))), { once: true });
      document.head.appendChild(script);
    });
  }

  async function ensurePDF() {
    if (!window.pdfjsLib) {
      await loadScript("/modules/ocr-viewer/pdf.min.js", "pdfjs");
    }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/modules/ocr-viewer/pdf.worker.min.js";
    return window.pdfjsLib;
  }

  function escapeText(value) {
    return String(value ?? "");
  }

  function stripReasoning(value) {
    let text = escapeText(value).trim();
    const closedBlock = /<(thinking|think|reasoning|reflection|thought)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
    const unclosedBlock = /<(thinking|think|reasoning|reflection|thought)\b[^>]*>[\s\S]*$/i;
    text = text.replace(closedBlock, "").replace(unclosedBlock, "");
    text = text.replace(/<\/?(?:thinking|think|reasoning|reflection|thought)\b[^>]*>/gi, "");
    return text.trim();
  }

  function renderInlineMarkdown(value) {
    return escapeText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/_([^_]+)_/g, "<em>$1</em>");
  }

  function markdownToPlainText(value) {
    return escapeText(value)
      .replace(/\r\n?/g, "\n")
      .replace(/^\s*```[^\n]*$/gm, "")
      .replace(/^\s*#{1,6}\s+/gm, "")
      .replace(/^\s*>\s?/gm, "")
      .replace(/^\s*[-+*]\s+/gm, "")
      .replace(/^\s*\d+[.)]\s+/gm, "")
      .replace(/^\s*(?:---+|___+|\*\*\*+)\s*$/gm, "")
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/~~([^~]+)~~/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function markdownToHTML(value) {
    const lines = escapeText(value).replace(/\r\n?/g, "\n").split("\n");
    const html = [];
    let paragraph = [];
    let listType = "";

    const closeParagraph = () => {
      if (paragraph.length === 0) return;
      html.push(`<p>${paragraph.map(renderInlineMarkdown).join("<br>")}</p>`);
      paragraph = [];
    };
    const closeList = () => {
      if (!listType) return;
      html.push(`</${listType}>`);
      listType = "";
    };

    lines.forEach((line) => {
      const heading = /^(#{1,6})\s+(.+)$/.exec(line);
      const unordered = /^\s*[-+*]\s+(.+)$/.exec(line);
      const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
      if (!line.trim()) {
        closeParagraph();
        closeList();
        return;
      }
      if (heading) {
        closeParagraph();
        closeList();
        const level = Math.min(heading[1].length, 4);
        html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
        return;
      }
      if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
        closeParagraph();
        closeList();
        html.push("<hr>");
        return;
      }
      if (unordered || ordered) {
        closeParagraph();
        const nextType = unordered ? "ul" : "ol";
        if (listType !== nextType) {
          closeList();
          listType = nextType;
          html.push(`<${listType}>`);
        }
        html.push(`<li>${renderInlineMarkdown((unordered || ordered)[1])}</li>`);
        return;
      }
      closeList();
      const quote = /^\s*>\s?(.+)$/.exec(line);
      if (quote) {
        closeParagraph();
        html.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
        return;
      }
      paragraph.push(line);
    });
    closeParagraph();
    closeList();
    return html.join("");
  }

  async function mount(container, context) {
    const { api } = context;
    // Container queries in native.css size the layout from this host, not the viewport.
    container.classList.add("ocr-viewer-host");
    container.innerHTML = `
      <div class="ocr-viewer">
        <aside class="ocr-history-panel">
          <div class="ocr-history-head">
            <div><strong>${t("ocr.history.title")}</strong><span>${t("ocr.history.subtitle")}</span></div>
            <div class="ocr-history-actions">
              <button class="ocr-clear-history" type="button" title="${t("ocr.history.clearTitle")}" hidden>${t("ocr.history.clear")}</button>
              <button class="ocr-new" type="button" title="${t("ocr.newDocument")}" aria-label="${t("ocr.newDocument")}">＋</button>
            </div>
          </div>
          <div class="ocr-history-list"></div>
        </aside>
        <section class="ocr-main">
          <div class="ocr-toolbar">
            <label class="ocr-file-button">
              <input class="ocr-file-input" type="file" accept="image/*,.pdf,.docx,.md,.txt" />
              <span>＋ ${t("ocr.toolbar.chooseDocument")}</span>
            </label>
            <label class="ocr-control ocr-model-control">
              <span>${t("ocr.toolbar.model")}</span>
              <select class="ocr-model" aria-label="${t("ocr.toolbar.modelAria")}"><option value="">${t("ocr.toolbar.modelsLoading")}</option></select>
            </label>
            <label class="ocr-control ocr-mode-control">
              <span>${t("ocr.toolbar.mode")}</span>
              <select class="ocr-mode" aria-label="${t("ocr.toolbar.modeAria")}">
                <option value="">${t("ocr.toolbar.modeChoose")}</option>
                <option value="original">${t("ocr.toolbar.modeOriginal")}</option>
                <option value="translate">${t("ocr.toolbar.modeTranslate")}</option>
              </select>
            </label>
            <label class="ocr-control ocr-language-control disabled">
              <span>${t("ocr.toolbar.language")}</span>
              <select class="ocr-language" aria-label="${t("ocr.toolbar.languageAria")}">
                ${Object.keys(languages).map((value) => { const label = languageName(value); return `<option value="${value}">${label.charAt(0).toUpperCase() + label.slice(1)}</option>`; }).join("")}
              </select>
            </label>
            <label class="ocr-control">
              <span>${t("ocr.toolbar.format")}</span>
              <select class="ocr-format" aria-label="${t("ocr.toolbar.formatAria")}">
                ${Object.entries(outputFormats).map(([value, item]) => `<option value="${value}">${t(item.label)}</option>`).join("")}
              </select>
            </label>
            <label class="ocr-control ocr-pages-limit-control">
              <span>${t("ocr.toolbar.pagesLimit")}</span>
              <select class="ocr-pages-limit" aria-label="${t("ocr.toolbar.pagesLimitAria")}">
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20" selected>20</option>
                <option value="40">40</option>
                <option value="0">${t("ocr.toolbar.pagesAll")}</option>
              </select>
            </label>
            <button class="ocr-run" type="button" disabled>${t("ocr.toolbar.run")}</button>
          </div>
          <div class="ocr-status">
            <span class="ocr-status-dot"></span>
            <span class="ocr-status-text">${t("ocr.status.start")}</span>
            <label class="ocr-auto-open" title="${t("ocr.autoOpen.title")}">
              <input class="ocr-auto-open-folder" type="checkbox" />
              <span>${t("ocr.autoOpen.label")}</span>
            </label>
          </div>
          <div class="ocr-split">
            <section class="ocr-pane ocr-source-pane">
              <header><strong>${t("ocr.source.title")}</strong><span class="ocr-document-name">${t("ocr.source.noDocument")}</span></header>
              <div class="ocr-drop-zone">
                <div class="ocr-empty-preview">
                  <b>${t("ocr.source.dropTitle")}</b>
                  <span>${t("ocr.source.dropFormats")}</span>
                </div>
                <div class="ocr-pages"></div>
              </div>
            </section>
            <section class="ocr-pane ocr-text-pane">
              <header>
                <span class="ocr-result-heading"><strong class="ocr-result-title">${t(languageTitles.pl)}</strong><small class="ocr-result-meta">${t(outputFormats.docx.label)}</small></span>
                <span class="ocr-text-actions">
                  <button class="ocr-copy" type="button">${t("common.copy")}</button>
                  <button class="ocr-to-chat" type="button" disabled title="${t("ocr.actions.toChatTitle")}">${t("ocr.actions.toChat")}</button>
                  <button class="ocr-preview-toggle" type="button" hidden>${t("common.edit")}</button>
                  <span class="ocr-export-formats" aria-label="${t("ocr.actions.exportFormatsAria")}">
                    <button type="button" data-export-format="docx" title="${t("ocr.actions.exportDocxTitle")}">DOCX</button>
                    <button type="button" data-export-format="md" title="${t("ocr.actions.exportMdTitle")}">MD</button>
                    <button type="button" data-export-format="txt" title="${t("ocr.actions.exportTxtTitle")}">TXT</button>
                  </span>
                  <button class="ocr-save-folder" type="button" disabled title="${t("ocr.actions.saveFolderTitle")}">${t("ocr.actions.saveFolder")}</button>
                  <button class="ocr-open-folder" type="button" disabled title="${t("ocr.actions.openFolderTitle")}">${t("common.openFolder")}</button>
                  <button class="ocr-open-file" type="button" disabled title="${t("ocr.actions.openFileTitle")}">${t("ocr.actions.openFile")}</button>
                  <button class="ocr-choose-folder" type="button" title="${t("ocr.actions.chooseFolderTitle")}">${t("ocr.actions.chooseFolder")}</button>
                  <button class="ocr-download" type="button" disabled>${t("ocr.actions.saveAs")}</button>
                </span>
              </header>
              <div class="ocr-document-editor">
                <textarea class="ocr-output" spellcheck="true" placeholder="${t("ocr.output.placeholder")}"></textarea>
                <div class="ocr-word-stage" hidden>
                  <article class="ocr-markdown-preview ocr-word-page" aria-label="${t("ocr.output.previewAria")}"></article>
                </div>
              </div>
              <form class="ocr-correction">
                <input class="ocr-correction-input" placeholder="${t("ocr.correction.placeholder")}" />
                <button type="submit">${t("ocr.correction.submit")}</button>
              </form>
            </section>
          </div>
        </section>
        <dialog class="ocr-confirm-dialog">
          <form method="dialog">
            <strong class="ocr-confirm-title">${t("ocr.confirm.defaultTitle")}</strong>
            <p class="ocr-confirm-text"></p>
            <div>
              <button type="submit" value="cancel">${t("common.cancel")}</button>
              <button class="ocr-confirm-delete" type="submit" value="confirm">${t("common.delete")}</button>
            </div>
          </form>
        </dialog>
      </div>`;

    const $ = (selector) => container.querySelector(selector);
    const fileInput = $(".ocr-file-input");
    const modelSelect = $(".ocr-model");
    const modeSelect = $(".ocr-mode");
    const languageControl = $(".ocr-language-control");
    const languageSelect = $(".ocr-language");
    const formatSelect = $(".ocr-format");
    const runButton = $(".ocr-run");
    const output = $(".ocr-output");
    const wordStage = $(".ocr-word-stage");
    const outputPreview = $(".ocr-markdown-preview");
    const previewToggle = $(".ocr-preview-toggle");
    const resultTitle = $(".ocr-result-title");
    const resultMeta = $(".ocr-result-meta");
    const downloadButton = $(".ocr-download");
    const exportFormatButtons = [...container.querySelectorAll("[data-export-format]")];
    const saveFolderButton = $(".ocr-save-folder");
    const openFolderButton = $(".ocr-open-folder");
    const openFileButton = $(".ocr-open-file");
    const chooseFolderButton = $(".ocr-choose-folder");
    const toChatButton = $(".ocr-to-chat");
    const pagesLimitSelect = $(".ocr-pages-limit");
    const autoOpenFolderInput = $(".ocr-auto-open-folder");
    const pages = $(".ocr-pages");
    const dropZone = $(".ocr-drop-zone");
    const status = $(".ocr-status-text");
    const statusDot = $(".ocr-status-dot");
    const documentName = $(".ocr-document-name");
    const historyList = $(".ocr-history-list");
    const clearHistoryButton = $(".ocr-clear-history");
    const confirmDialog = $(".ocr-confirm-dialog");
    const confirmTitle = $(".ocr-confirm-title");
    const confirmText = $(".ocr-confirm-text");
    const correctionForm = $(".ocr-correction");
    const correctionInput = $(".ocr-correction-input");
    let currentFile = null;
    let currentImages = [];
    let currentPDF = null;
    let currentPageCount = 0;
    let currentSourcePath = "";
    let currentSourceType = "";
    let outputFolder = ""; // empty → server fallback supercli-data/exports/ocr
    let lastSavedPath = "";
    let lastSavedDir = "";
    let maxPdfPages = 20; // 0 = all pages
    let autoOpenFolderAfterSave = false;
    let busy = false;
    let outputEditing = false;
    let history = [];
    let pendingHistoryDelete = null;

    function activePageCount() {
      return currentPageCount || currentImages.length;
    }

    function releaseCurrentPDF() {
      const pdf = currentPDF;
      currentPDF = null;
      currentPageCount = 0;
      if (pdf?.destroy) void pdf.destroy().catch(() => {});
    }

    function selectedModel() {
      const option = modelSelect.selectedOptions[0];
      return {
        providerId: option?.dataset.provider || "",
        modelId: option?.dataset.model || "",
      };
    }

    function setBusy(value, message) {
      busy = value;
      fileInput.disabled = value;
      modelSelect.disabled = value;
      modeSelect.disabled = value || activePageCount() === 0;
      languageSelect.disabled = value || modeSelect.value !== "translate";
      languageControl.classList.toggle("disabled", modeSelect.value !== "translate");
      formatSelect.disabled = value;
      runButton.disabled = value || activePageCount() === 0 || !modeSelect.value;
      downloadButton.disabled = value || !output.value.trim();
      if (saveFolderButton) saveFolderButton.disabled = value || !output.value.trim();
      if (openFolderButton) openFolderButton.disabled = value || !lastSavedDir;
      if (openFileButton) openFileButton.disabled = value || !lastSavedPath;
      if (chooseFolderButton) chooseFolderButton.disabled = value;
      if (pagesLimitSelect) pagesLimitSelect.disabled = value;
      if (toChatButton) toChatButton.disabled = value || !output.value.trim();
      correctionInput.disabled = value;
      correctionForm.querySelector("button").disabled = value;
      statusDot.classList.toggle("busy", value);
      if (message) status.textContent = message;
    }

    function rememberSavedPath(path, dir, usedFallback) {
      lastSavedPath = path || "";
      lastSavedDir = dir || (path ? path.replace(/[\\/][^\\/]+$/, "") : "");
      if (openFolderButton) {
        openFolderButton.disabled = busy || !lastSavedDir;
        openFolderButton.title = lastSavedDir
          ? t("ocr.actions.openFolderPath", { path: lastSavedDir })
          : t("ocr.actions.saveFirst");
      }
      if (openFileButton) {
        openFileButton.disabled = busy || !lastSavedPath;
        openFileButton.title = lastSavedPath
          ? t("ocr.actions.openFilePath", { path: lastSavedPath })
          : t("ocr.actions.saveFirst");
      }
      void usedFallback;
    }

    function outputFolderLabel() {
      if (outputFolder) return outputFolder;
      return t("ocr.folder.defaultLabel");
    }

    function setActivePage(index) {
      pages.querySelectorAll(".ocr-page").forEach((figure, pageIndex) => {
        figure.classList.toggle("active", pageIndex === index);
      });
      const active = pages.querySelector(".ocr-page.active");
      if (active) {
        active.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    function buildPrompt() {
      // Keep one canonical representation regardless of the selected export.
      // DOCX/MD/TXT conversion happens locally afterwards, so changing the
      // export format never requires another model call.
      const lang = languagePromptNames[languageSelect.value] || "Polish";
      const shape = "light Markdown (headings/lists only if present in the scan)";
      if (modeSelect.value === "translate") {
        return [
          `OCR this scan and output only the full ${lang} translation.`,
          `Format: ${shape}.`,
          "Keep names, dates, addresses and numbers as-is.",
          "No summary, notes, bilingual pairs or code fences in the final answer.",
          "If a fragment is unreadable write [unreadable].",
        ].join("\n");
      }
      return [
        "OCR this scan. Output only the full original-language text.",
        `Format: ${shape}.`,
        "Keep reading order. No summary, notes or code fences in the final answer.",
        "If a fragment is unreadable write [unreadable].",
      ].join("\n");
    }

    function updateResultLabels() {
      const format = outputFormats[formatSelect.value] || outputFormats.docx;
      if (modeSelect.value === "original") {
        resultTitle.textContent = t("ocr.result.title.original");
      } else if (modeSelect.value === "translate") {
        resultTitle.textContent = t(languageTitles[languageSelect.value] || languageTitles.pl);
      } else {
        resultTitle.textContent = t("ocr.result.title.default");
      }
      resultMeta.textContent = t(format.label);
      downloadButton.textContent = t("ocr.actions.saveAsFormat", { format: formatSelect.value.toUpperCase() });
      downloadButton.disabled = busy || !output.value.trim();
      exportFormatButtons.forEach((button) => {
        const active = button.dataset.exportFormat === formatSelect.value;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
        button.disabled = busy;
      });
      if (saveFolderButton) {
        saveFolderButton.disabled = busy || !output.value.trim();
        saveFolderButton.title = t("ocr.actions.saveToPath", { path: outputFolderLabel() });
      }
      if (chooseFolderButton) {
        chooseFolderButton.disabled = busy;
        chooseFolderButton.title = outputFolder
          ? t("ocr.folder.customTitle", { path: outputFolder })
          : t("ocr.folder.defaultTitle");
        chooseFolderButton.textContent = outputFolder ? t("ocr.actions.chooseFolderSet") : t("ocr.actions.chooseFolder");
      }
      if (toChatButton) toChatButton.disabled = busy || !output.value.trim();
      if (openFolderButton) openFolderButton.disabled = busy || !lastSavedDir;
      if (openFileButton) openFileButton.disabled = busy || !lastSavedPath;
      updateOutputPresentation();
    }

    function exportText(format = formatSelect.value) {
      const text = stripReasoning(output.value);
      return format === "txt" ? markdownToPlainText(text) : text;
    }

    async function saveToOutputFolder() {
      if (!output.value.trim()) return;
      const format = formatSelect.value || "docx";
      if (saveFolderButton) saveFolderButton.disabled = true;
      try {
        const result = await api.saveDocument({
          format,
          filename: outputFilename(format),
          text: exportText(format),
          dir: outputFolder || "",
        });
        const path = result?.path || "";
        rememberSavedPath(path, result?.dir || "", Boolean(result?.used_fallback));
        if (result?.used_fallback) {
          api.toast(t("ocr.save.savedFallbackToast", { path }));
          setBusy(false, t("ocr.save.savedFallback", { path }));
        } else {
          api.toast(t("ocr.save.saved", { path }));
          setBusy(false, t("ocr.save.saved", { path }));
        }
        if (autoOpenFolderAfterSave && lastSavedDir) {
          await openLastFolder();
        }
      } catch (error) {
        api.toast(error.message || t("ocr.save.folderFailed"));
        setBusy(false, error.message || t("ocr.save.folderError"));
      } finally {
        updateResultLabels();
      }
    }

    async function openLastFolder() {
      if (!lastSavedDir) {
        api.toast(t("ocr.actions.saveFirstToast"));
        return;
      }
      try {
        await api.openFolder(lastSavedDir);
      } catch (error) {
        // Fallback: open path (also accepts absolute export dirs)
        try {
          await api.openPath(lastSavedDir);
        } catch (inner) {
          api.toast(inner.message || error.message || t("ocr.error.openFolder"));
        }
      }
    }

    async function openLastFile() {
      if (!lastSavedPath) {
        api.toast(t("ocr.actions.saveFirstToast"));
        return;
      }
      try {
        await api.openPath(lastSavedPath);
      } catch (error) {
        api.toast(error.message || t("ocr.error.openFile"));
      }
    }

    async function chooseOutputFolder() {
      try {
        const picked = await api.pickFolder();
        if (!picked?.path) return;
        outputFolder = picked.path;
        await api.setSetting("outputFolder", outputFolder);
        api.toast(t("ocr.folder.selectedToast", { path: outputFolder }));
        setBusy(false, t("ocr.folder.selected", { path: outputFolder }));
        updateResultLabels();
      } catch (error) {
        api.toast(error.message || t("ocr.error.chooseFolder"));
      }
    }

    async function clearOutputFolder() {
      if (!outputFolder) {
        api.toast(t("ocr.folder.alreadyDefault"));
        return;
      }
      outputFolder = "";
      await api.setSetting("outputFolder", "");
      api.toast(t("ocr.folder.resetToast"));
      setBusy(false, t("ocr.folder.resetStatus"));
      updateResultLabels();
    }

    function updateOutputPresentation() {
      const format = formatSelect.value || "docx";
      const hasText = Boolean(output.value.trim());
      const showPreview = hasText && !outputEditing;
      const isWord = format === "docx";
      const isPlain = format === "txt";
      output.hidden = showPreview;
      if (wordStage) wordStage.hidden = !showPreview;
      outputPreview.hidden = !showPreview;
      outputPreview.classList.toggle("ocr-word-page", isWord);
      outputPreview.classList.toggle("ocr-plain-preview", isPlain);
      previewToggle.hidden = !hasText;
      if (outputEditing) {
        previewToggle.textContent = isWord ? t("ocr.preview.word") : isPlain ? t("ocr.preview.txt") : t("ocr.preview.md");
      } else {
        previewToggle.textContent = t("ocr.preview.edit");
      }
      if (showPreview) {
        if (isPlain) {
          outputPreview.textContent = markdownToPlainText(output.value);
        } else {
          outputPreview.innerHTML = markdownToHTML(output.value) || "<p></p>";
        }
      }
    }

    function outputFilename(format = formatSelect.value || "docx") {
      const extension = format || "docx";
      const fallbackName = t("ocr.file.defaultName");
      const source = currentFile?.name || documentName.textContent || fallbackName;
      return `${source.replace(/\.[^.]+$/, "") || fallbackName}.${extension}`;
    }

    function downloadBlob(blob, filename) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    async function blobToBase64(blob) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      }
      return btoa(binary);
    }

    async function saveBlob(blob, filename) {
      if (typeof window.supercliSaveFile === "function") {
        const result = await window.supercliSaveFile(filename, await blobToBase64(blob));
        return result && typeof result === "object" ? result : { saved: false };
      }
      if (typeof window.showSaveFilePicker === "function") {
        const handle = await window.showSaveFilePicker({ suggestedName: filename });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return { saved: true, path: handle.name || filename };
      }
      downloadBlob(blob, filename);
      return { saved: true, path: filename, browserFallback: true };
    }

    async function recognizeImage(dataURL) {
      const image = splitDataURL(dataURL);
      const model = selectedModel();
      if (!model.modelId) throw new Error(t("ocr.error.noVisionModel"));
      const result = await api.visionTranscribe({
        ...image,
        prompt: buildPrompt(),
        providerId: model.providerId,
        modelId: model.modelId,
      });
      const cleanText = stripReasoning(result.text);
      if (!cleanText) throw new Error(t("ocr.error.emptyResult"));
      return cleanText;
    }

    function showImages(images, emptyTitle = t("ocr.source.dropTitle"), emptyDescription = t("ocr.source.dropFormats")) {
      pages.replaceChildren();
      const empty = $(".ocr-empty-preview");
      empty.hidden = images.length > 0;
      if (!images.length) {
        empty.querySelector("b").textContent = emptyTitle;
        empty.querySelector("span").textContent = emptyDescription;
      }
      images.forEach((src, index) => {
        const figure = document.createElement("figure");
        figure.className = "ocr-page";
        const img = document.createElement("img");
        img.src = src;
        img.alt = t("ocr.page.label", { page: index + 1 });
        const caption = document.createElement("figcaption");
        caption.textContent = images.length > 1 ? t("ocr.page.label", { page: index + 1 }) : t("ocr.page.preview");
        figure.append(img, caption);
        pages.appendChild(figure);
      });
    }

    async function storeCurrentSource() {
      if (currentSourcePath || !currentFile) return currentSourcePath;
      currentSourcePath = await api.storeSource(currentFile);
      currentSourceType = currentFile.type || currentSourceType;
      return currentSourcePath;
    }

    async function cleanupRemovedHistorySources(previous, next) {
      const kept = new Set((next || []).map((item) => item.sourcePath).filter(Boolean));
      const candidates = [...new Set((previous || []).map((item) => item.sourcePath).filter(Boolean))]
        .filter((path) => !kept.has(path));
      if (!candidates.length || typeof api.deleteSource !== "function") return;
      const results = await Promise.allSettled(candidates.map((path) => api.deleteSource(path)));
      const failed = results.filter((item) => item.status === "rejected").length;
      if (failed) api.toast(tn("ocr.history.cleanupFailed", failed));
    }

    async function saveHistory(name, text) {
      const cleanText = stripReasoning(text);
      try {
        await storeCurrentSource();
      } catch (error) {
        api.toast(t("ocr.history.sourceSaveFailed", { detail: error.message || t("ocr.error.fileWrite") }));
      }
      const entry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        text: cleanText,
        mode: modeSelect.value,
        language: languageSelect.value,
        format: formatSelect.value,
        sourcePath: currentSourcePath,
        sourceType: currentSourceType,
        date: new Date().toISOString(),
      };
      const previousHistory = history;
      history = [entry, ...history.filter((item) => item.name !== name || item.text !== text)].slice(0, 12);
      renderHistory();
      await api.setSetting("history", JSON.stringify(history));
      await cleanupRemovedHistorySources(previousHistory, history);
    }

    async function restoreHistoryItem(item) {
      releaseCurrentPDF();
      currentFile = null;
      currentImages = [];
      currentSourcePath = item.sourcePath || "";
      currentSourceType = item.sourceType || "";
      outputEditing = false;
      showImages([]);
      documentName.textContent = item.name || t("ocr.history.documentFallback");
      output.value = stripReasoning(item.text);
      modeSelect.value = item.mode || (item.language === "original" ? "original" : "translate");
      languageSelect.value = languages[item.language] ? item.language : "pl";
      formatSelect.value = item.format || "docx";
      updateResultLabels();

      if (!currentSourcePath) {
        setBusy(false, t("ocr.history.restoredTextOnly"));
        return;
      }

      setBusy(true, t("ocr.history.loadingSource"));
      try {
        const blob = await api.loadSource(currentSourcePath);
        currentSourceType = blob.type || currentSourceType;
        currentFile = new File([blob], item.name || t("ocr.file.documentName"), { type: currentSourceType });
        if (currentSourceType === "application/pdf" || /\.pdf$/i.test(item.name || "")) {
          const prepared = await processPDF(blob);
          currentPDF = prepared.pdf;
          currentPageCount = prepared.pageCount;
          currentImages = prepared.images;
          showImages(currentImages);
        } else if (/\.(docx|md|txt)$/i.test(item.name || "")) {
          currentImages = [];
          currentPageCount = 0;
          showImages([], t("ocr.history.textDocumentTitle"), t("ocr.history.textDocumentHint"));
        } else {
          currentImages = [await readAsDataURL(blob)];
          currentPageCount = 1;
          showImages(currentImages);
        }
        setBusy(false, t("ocr.history.restored"));
      } catch (error) {
        releaseCurrentPDF();
        currentFile = null;
        currentImages = [];
        showImages([]);
        setBusy(false, t("ocr.history.sourceUnavailable", { detail: error.message || t("ocr.error.fileRead") }));
      }
    }

    async function persistHistory() {
      renderHistory();
      await api.setSetting("history", JSON.stringify(history));
    }

    function requestHistoryDelete(item = null) {
      if (!item && history.length === 0) return;
      pendingHistoryDelete = item ? { id: item.id } : { all: true };
      confirmTitle.textContent = item ? t("ocr.confirm.deleteTitle") : t("ocr.confirm.clearTitle");
      confirmText.textContent = item
        ? t("ocr.confirm.deleteText", { name: item.name || t("ocr.document") })
        : t("ocr.confirm.clearText", { count: history.length });
      confirmDialog.returnValue = "";
      confirmDialog.showModal();
    }

    function renderHistory() {
      historyList.replaceChildren();
      clearHistoryButton.hidden = history.length === 0;
      if (history.length === 0) {
        const empty = document.createElement("p");
        empty.className = "ocr-history-empty";
        empty.textContent = t("ocr.history.empty");
        historyList.appendChild(empty);
        return;
      }
      history.forEach((item) => {
        const entry = document.createElement("article");
        entry.className = "ocr-history-entry";
        const row = document.createElement("button");
        row.type = "button";
        row.className = "ocr-history-item";
        row.title = item.name || t("ocr.document");
        const strong = document.createElement("strong");
        strong.textContent = item.name || t("ocr.document");
        const preview = document.createElement("span");
        preview.textContent = stripReasoning(item.text).replace(/\s+/g, " ").slice(0, 140);
        const date = document.createElement("small");
        const savedMode = item.mode || (item.language === "original" ? "original" : "translate");
        const savedLanguage = savedMode === "original" ? t("ocr.language.original") : languageName(item.language);
        const savedFormat = outputFormats[item.format] || outputFormats.docx;
        date.textContent = t("ocr.history.meta", {
          mode: t(textModes[savedMode] || textModes.original),
          language: savedLanguage,
          format: t(savedFormat.label),
          date: NestCafe.i18n.formatDate(item.date, { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }),
        });
        row.append(strong, preview, date);
        row.addEventListener("click", () => restoreHistoryItem(item));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "ocr-history-delete";
        remove.title = t("ocr.history.deleteItem", { name: item.name || t("ocr.document") });
        remove.setAttribute("aria-label", remove.title);
        remove.textContent = "×";
        remove.addEventListener("click", (event) => {
          event.stopPropagation();
          requestHistoryDelete(item);
        });
        entry.append(row, remove);
        historyList.appendChild(entry);
      });
    }

    async function renderPDFPageForOCR(index) {
      if (!currentPDF) return currentImages[index] || "";
      const page = await currentPDF.getPage(index + 1);
      const scale = activePageCount() > 8 ? 1.35 : 1.7;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d", { alpha: false });
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataURL = canvas.toDataURL("image/png");
      canvas.width = 1;
      canvas.height = 1;
      page.cleanup?.();
      return dataURL;
    }

    async function transcribeCurrent() {
      const pageTotal = activePageCount();
      if (busy || pageTotal === 0 || !modeSelect.value) return;
      setBusy(true, t("ocr.status.recognizingFirst", { total: pageTotal }));
      outputEditing = false;
      output.value = "";
      try {
        const chunks = [];
        for (let index = 0; index < pageTotal; index += 1) {
          setActivePage(index);
          setBusy(true, t("ocr.status.recognizingPage", { page: index + 1, total: pageTotal }));
          // PDF pages are rendered at OCR resolution only for this one call and
          // released immediately afterwards. Long PDFs therefore no longer keep
          // dozens of full-resolution PNG data URLs in memory at once.
          const image = await renderPDFPageForOCR(index);
          const text = await recognizeImage(image);
          const pageLabel = `## ${t("ocr.page.label", { page: index + 1 })}`;
          chunks.push(pageTotal > 1 ? `${pageLabel}\n\n${text}` : text);
          output.value = chunks.join("\n\n");
          updateResultLabels();
        }
        setActivePage(-1);
        const name = currentFile?.name || documentName.textContent || t("ocr.document");
        await saveHistory(name, output.value);
        const language = modeSelect.value === "original" ? t("ocr.language.original") : languageName(languageSelect.value);
        const format = t((outputFormats[formatSelect.value] || outputFormats.docx).label);
        setBusy(false, t("ocr.status.done", { pages: tn("ocr.pages.count", pageTotal), language, format }));
      } catch (error) {
        setActivePage(-1);
        setBusy(false, error.message || t("ocr.error.recognize"));
        api.toast(error.message || t("ocr.error.ocr"));
      }
    }

    async function processPDF(file) {
      const pdfjs = await ensurePDF();
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data }).promise;
      let pageCount = pdf.numPages;
      const limit = maxPdfPages > 0 ? maxPdfPages : pageCount;
      if (pageCount > limit) {
        const ok = await window.NestCafe?.dialogs?.confirm?.({
          title: t("ocr.pdf.largeTitle"),
          message: t("ocr.pdf.largeMessage", { pages: tn("ocr.pages.accusative", pageCount), limit }),
          confirmLabel: tn("ocr.pdf.useLimit", limit),
          danger: false,
          defaultConfirm: true,
        });
        if (!ok) {
          await pdf.destroy().catch(() => {});
          throw new Error(t("ocr.pdf.cancelled"));
        }
        pageCount = limit;
      }

      // Only small JPEG thumbnails are kept for the left-side preview. The
      // full OCR render is created one page at a time in renderPDFPageForOCR().
      const images = [];
      const thumbnailScale = pageCount > 20 ? 0.32 : pageCount > 8 ? 0.4 : 0.52;
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        setBusy(true, t("ocr.status.thumbnail", { page: pageNumber, total: pageCount }));
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: thumbnailScale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        const ctx = canvas.getContext("2d", { alpha: false });
        await page.render({ canvasContext: ctx, viewport }).promise;
        images.push(canvas.toDataURL("image/jpeg", 0.72));
        canvas.width = 1;
        canvas.height = 1;
        page.cleanup?.();
      }
      if (pdf.numPages > pageCount) {
        api.toast(t("ocr.pdf.limited", { used: pageCount, pages: tn("ocr.pages.genitive", pdf.numPages) }));
      }
      return { pdf, pageCount, images };
    }

    function sendResultToChat() {
      const text = stripReasoning(output.value).trim();
      if (!text) return;
      const name = currentFile?.name || documentName.textContent || t("ocr.file.documentName");
      const prompt = `${t("ocr.chat.intro", { name })}\n\n${text}`;
      const field = document.querySelector("#prompt");
      if (field) {
        field.value = prompt;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.focus();
      }
      window.NestCafe?.closeModule?.() || window.closeNestCafeModule?.();
      api.toast(t("ocr.chat.inserted"));
    }

    async function processFile(file) {
      if (!file || busy) return;
      releaseCurrentPDF();
      currentFile = file;
      currentImages = [];
      currentSourcePath = "";
      currentSourceType = file.type || "";
      outputEditing = false;
      documentName.textContent = file.name || t("ocr.document");
      modeSelect.value = "";
      output.value = "";
      updateResultLabels();
      setBusy(true, t("ocr.status.loadingDocument"));
      try {
        if (/\.(docx|md|txt)$/i.test(file.name)) {
          const imported = await api.importDocument(file);
          currentPageCount = 0;
          currentImages = [];
          modeSelect.value = "original";
          formatSelect.value = outputFormats[imported.source_format] ? imported.source_format : "docx";
          output.value = stripReasoning(imported.text || "");
          if (!output.value.trim()) throw new Error(t("ocr.error.noText"));
          showImages([], t("ocr.import.title"), t("ocr.import.hint"));
          updateResultLabels();
          await saveHistory(file.name || imported.name || t("ocr.document"), output.value);
          setBusy(false, t("ocr.import.loaded", { format: String(imported.source_format || t("ocr.file.documentName")).toUpperCase() }));
          return;
        }
        if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
          const prepared = await processPDF(file);
          currentPDF = prepared.pdf;
          currentPageCount = prepared.pageCount;
          currentImages = prepared.images;
        } else if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
          currentImages = [await readAsDataURL(file)];
          currentPageCount = 1;
        } else {
          throw new Error(t("ocr.error.unsupported"));
        }
        showImages(currentImages);
        setBusy(false, t("ocr.status.documentReady"));
        modeSelect.focus();
      } catch (error) {
        releaseCurrentPDF();
        currentImages = [];
        showImages([]);
        setBusy(false, error.message || t("ocr.error.readDocument"));
      }
    }

    async function loadModels() {
      try {
        const response = await api.listModels();
        const models = (response.models || []).filter((model) => !model.hidden);
        if (models.length === 0 && response.active) {
          models.push({
            id: response.active,
            provider: response.provider || "active",
            active: true,
            vision: false,
          });
        }
        modelSelect.replaceChildren();
        if (models.length === 0) {
          modelSelect.append(new Option(t("ocr.models.none"), ""));
          return;
        }
        models.sort((a, b) => Number(b.active) - Number(a.active) || Number(b.vision) - Number(a.vision) || a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id));
        models.forEach((model, index) => {
          const option = new Option(`${model.provider} · ${model.id}`, `${model.provider}\u0000${model.id}`);
          option.dataset.provider = model.provider;
          option.dataset.model = model.id;
          option.selected = model.active || index === 0;
          modelSelect.appendChild(option);
        });
      } catch (error) {
        modelSelect.replaceChildren(new Option(t("ocr.models.loadFailed"), ""));
        status.textContent = error.message;
      }
    }

    fileInput.addEventListener("change", () => processFile(fileInput.files?.[0]));
    runButton.addEventListener("click", transcribeCurrent);
    modeSelect.addEventListener("change", () => {
      updateResultLabels();
      if (modeSelect.value === "original") {
        setBusy(false, t("ocr.status.readyOriginal"));
      } else if (modeSelect.value === "translate") {
        setBusy(false, t("ocr.status.readyTranslate", { language: languageName(languageSelect.value) }));
      } else {
        setBusy(false, t("ocr.status.chooseMode"));
      }
    });
    languageSelect.addEventListener("change", () => {
      updateResultLabels();
      api.setSetting("language", languageSelect.value);
      if (currentImages.length && modeSelect.value === "translate") status.textContent = t("ocr.status.languageChanged", { language: languageName(languageSelect.value) });
    });
    function selectExportFormat(format, announce = true) {
      if (!outputFormats[format]) return;
      formatSelect.value = format;
      outputEditing = false;
      updateResultLabels();
      void api.setSetting("format", format);
      if (announce && output.value.trim()) {
        setBusy(false, t("ocr.status.formatChanged", { format: t(outputFormats[format].label) }));
      }
    }

    formatSelect.addEventListener("change", () => selectExportFormat(formatSelect.value));
    exportFormatButtons.forEach((button) => {
      button.addEventListener("click", () => selectExportFormat(button.dataset.exportFormat));
    });
    modelSelect.addEventListener("change", () => api.setSetting("model", modelSelect.value));
    clearHistoryButton.addEventListener("click", () => requestHistoryDelete());
    confirmDialog.addEventListener("close", async () => {
      if (confirmDialog.returnValue !== "confirm" || !pendingHistoryDelete) {
        pendingHistoryDelete = null;
        return;
      }
      const deletion = pendingHistoryDelete;
      pendingHistoryDelete = null;
      const previousHistory = history;
      if (deletion.all) {
        history = [];
        try {
          await persistHistory();
          await cleanupRemovedHistorySources(previousHistory, history);
          api.toast(t("ocr.history.cleared"));
        } catch (error) {
          history = previousHistory;
          renderHistory();
          api.toast(error.message || t("ocr.history.clearFailed"));
        }
        return;
      }
      const previousLength = history.length;
      history = history.filter((item) => item.id !== deletion.id);
      if (history.length !== previousLength) {
        try {
          await persistHistory();
          await cleanupRemovedHistorySources(previousHistory, history);
          api.toast(t("ocr.history.deleted"));
        } catch (error) {
          history = previousHistory;
          renderHistory();
          api.toast(error.message || t("ocr.history.deleteFailed"));
        }
      }
    });
    $(".ocr-new").addEventListener("click", () => {
      releaseCurrentPDF();
      currentFile = null;
      currentImages = [];
      currentSourcePath = "";
      currentSourceType = "";
      outputEditing = false;
      fileInput.value = "";
      modeSelect.value = "";
      output.value = "";
      documentName.textContent = t("ocr.source.noDocument");
      showImages([]);
      updateResultLabels();
      setBusy(false, t("ocr.status.start"));
    });
    $(".ocr-copy").addEventListener("click", async () => {
      if (!output.value) return;
      await navigator.clipboard.writeText(output.value);
      api.toast(t("ocr.output.copied"));
    });
    toChatButton?.addEventListener("click", sendResultToChat);
    saveFolderButton?.addEventListener("click", saveToOutputFolder);
    openFolderButton?.addEventListener("click", openLastFolder);
    openFileButton?.addEventListener("click", openLastFile);
    chooseFolderButton?.addEventListener("click", chooseOutputFolder);
    // Right-click on "Folder…" = return to the default supercli-data\exports\ocr
    chooseFolderButton?.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      clearOutputFolder().catch((error) => {
        api.toast(error.message || t("ocr.error.resetFolder"));
      });
    });
    pagesLimitSelect?.addEventListener("change", async () => {
      maxPdfPages = Number(pagesLimitSelect.value) || 0;
      await api.setSetting("maxPdfPages", maxPdfPages);
      api.toast(
        maxPdfPages > 0
          ? tn("ocr.pdf.limitSet", maxPdfPages)
          : t("ocr.pdf.limitAll"),
      );
    });
    autoOpenFolderInput?.addEventListener("change", async () => {
      autoOpenFolderAfterSave = Boolean(autoOpenFolderInput.checked);
      await api.setSetting("autoOpenFolderAfterSave", autoOpenFolderAfterSave);
      api.toast(
        autoOpenFolderAfterSave
          ? t("ocr.autoOpen.on")
          : t("ocr.autoOpen.off"),
      );
    });
    previewToggle.addEventListener("click", () => {
      outputEditing = !outputEditing;
      updateOutputPresentation();
      if (outputEditing) output.focus();
    });
    downloadButton.addEventListener("click", async () => {
      if (!output.value) return;
      const format = formatSelect.value || "docx";
      const filename = outputFilename(format);
      downloadButton.disabled = true;
      try {
        const blob = await api.exportDocument({
          format,
          filename,
          text: exportText(format),
        });
        const result = await saveBlob(blob, filename);
        if (result?.saved) {
          const savedPath = result.path || filename;
          if (result.path) rememberSavedPath(result.path, "", false);
          api.toast(t("ocr.save.saved", { path: savedPath }));
          setBusy(false, t("ocr.save.savedAs", { format: format.toUpperCase(), path: savedPath }));
        } else if (!result?.browserFallback) {
          setBusy(false, t("ocr.save.cancelled"));
        }
      } catch (error) {
        if (error?.name !== "AbortError") api.toast(error.message || t("ocr.error.export"));
      } finally {
        updateResultLabels();
      }
    });
    output.addEventListener("input", updateResultLabels);
    correctionForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const instruction = correctionInput.value.trim();
      if (!instruction || !output.value || busy) return;
      setBusy(true, t("ocr.correction.running"));
      try {
        const model = selectedModel();
        const result = await api.visionTranscribe({
          imageBase64: "",
          mimeType: "",
          providerId: model.providerId,
          modelId: model.modelId,
          prompt: [
            "Edit the document text below per the user request.",
            "Return the full corrected text only — no notes or code fences in the final answer.",
            `Keep language: ${modeSelect.value === "original" ? "source language" : languagePromptNames[languageSelect.value] || "Polish"}.`,
            "Keep format: light Markdown. Export conversion to DOCX/MD/TXT happens locally afterwards.",
            "",
            "TEXT:",
            output.value,
            "",
            "REQUEST:",
            instruction,
          ].join("\n"),
        });
        output.value = stripReasoning(result.text);
        if (!output.value) throw new Error(t("ocr.correction.emptyResult"));
        outputEditing = false;
        correctionInput.value = "";
        updateResultLabels();
        await saveHistory(currentFile?.name || documentName.textContent || t("ocr.document"), output.value);
        setBusy(false, t("ocr.correction.done"));
      } catch (error) {
        setBusy(false, error.message || t("ocr.correction.failed"));
      }
    });
    ["dragenter", "dragover"].forEach((type) => dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach((type) => dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.remove("dragging");
    }));
    dropZone.addEventListener("drop", (event) => processFile(event.dataTransfer?.files?.[0]));

    const settings = await api.getSettings().catch(() => ({}));
    languageSelect.value = settings.language && languages[settings.language] ? settings.language : "pl";
    formatSelect.value = settings.format && outputFormats[settings.format] ? settings.format : "docx";
    outputFolder = typeof settings.outputFolder === "string" ? settings.outputFolder.trim() : "";
    autoOpenFolderAfterSave = settings.autoOpenFolderAfterSave === true;
    if (autoOpenFolderInput) autoOpenFolderInput.checked = autoOpenFolderAfterSave;
    maxPdfPages = Number(settings.maxPdfPages);
    if (!Number.isFinite(maxPdfPages) || maxPdfPages < 0) maxPdfPages = 20;
    if (pagesLimitSelect) {
      const optionValue = String(maxPdfPages);
      if ([...pagesLimitSelect.options].some((option) => option.value === optionValue)) {
        pagesLimitSelect.value = optionValue;
      } else {
        pagesLimitSelect.value = "20";
        maxPdfPages = 20;
      }
    }
    try {
      history = JSON.parse(settings.history || "[]");
      if (!Array.isArray(history)) history = [];
      const cleanedHistory = history.map((item) => ({ ...item, text: stripReasoning(item.text) }));
      if (JSON.stringify(cleanedHistory) !== JSON.stringify(history)) {
        history = cleanedHistory;
        await api.setSetting("history", JSON.stringify(history));
      }
    } catch {
      history = [];
    }
    renderHistory();
    await loadModels();
    if (settings.model && Array.from(modelSelect.options).some((option) => option.value === settings.model)) {
      modelSelect.value = settings.model;
    }
    updateResultLabels();
    setBusy(false, t("ocr.status.start"));

    return () => {
      releaseCurrentPDF();
      if (confirmDialog.open) confirmDialog.close("cancel");
      container.replaceChildren();
    };
  }

  window.NestCafeModules["ocr-viewer"] = { mount };
})();
