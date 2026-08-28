"use strict";

(function () {
  window.NestCafeModules = window.NestCafeModules || {};

  const languages = {
    pl: "polski",
    en: "angielski",
    de: "niemiecki",
    fr: "francuski",
    es: "hiszpański",
  };

  const languageTitles = {
    pl: "Tekst po polsku",
    en: "Tekst po angielsku",
    de: "Tekst po niemiecku",
    fr: "Tekst po francusku",
    es: "Tekst po hiszpańsku",
  };

  const textModes = {
    original: "Oryginał",
    translate: "Tłumaczenie",
  };

  const languagePromptNames = {
    pl: "Polish",
    en: "English",
    de: "German",
    fr: "French",
    es: "Spanish",
  };

  const outputFormats = {
    docx: { label: "Word (.docx)", action: "Pobierz DOCX" },
    md: { label: "Markdown (.md)", action: "Pobierz MD" },
    txt: { label: "Zwykły tekst (.txt)", action: "Pobierz TXT" },
  };

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
      reader.addEventListener("error", () => reject(reader.error || new Error("Nie można odczytać pliku.")), { once: true });
      reader.readAsDataURL(file);
    });
  }

  function splitDataURL(dataURL) {
    const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataURL);
    if (!match) throw new Error("Nieprawidłowy format obrazu.");
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
      script.addEventListener("error", () => reject(new Error(`Nie można załadować ${src}`)), { once: true });
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
    container.innerHTML = `
      <div class="ocr-viewer">
        <aside class="ocr-history-panel">
          <div class="ocr-history-head">
            <div><strong>Historia</strong><span>Ostatnie dokumenty</span></div>
            <div class="ocr-history-actions">
              <button class="ocr-clear-history" type="button" title="Wyczyść historię" hidden>Wyczyść</button>
              <button class="ocr-new" type="button" title="Nowy dokument" aria-label="Nowy dokument">＋</button>
            </div>
          </div>
          <div class="ocr-history-list"></div>
        </aside>
        <section class="ocr-main">
          <div class="ocr-toolbar">
            <label class="ocr-file-button">
              <input class="ocr-file-input" type="file" accept="image/*,.pdf" />
              <span>＋ Wybierz obraz lub PDF</span>
            </label>
            <label class="ocr-control ocr-model-control">
              <span>Model z wizją</span>
              <select class="ocr-model" aria-label="Model OCR"><option value="">Ładowanie modeli…</option></select>
            </label>
            <label class="ocr-control ocr-mode-control">
              <span>Co zrobić</span>
              <select class="ocr-mode" aria-label="Sposób rozpoznania">
                <option value="">Wybierz…</option>
                <option value="original">Wyciągnij oryginał</option>
                <option value="translate">Wyciągnij i przetłumacz</option>
              </select>
            </label>
            <label class="ocr-control ocr-language-control disabled">
              <span>Na język</span>
              <select class="ocr-language" aria-label="Język tłumaczenia">
                ${Object.entries(languages).map(([value, label]) => `<option value="${value}">${label.charAt(0).toUpperCase() + label.slice(1)}</option>`).join("")}
              </select>
            </label>
            <label class="ocr-control">
              <span>Plik końcowy</span>
              <select class="ocr-format" aria-label="Format pliku końcowego">
                ${Object.entries(outputFormats).map(([value, item]) => `<option value="${value}">${item.label}</option>`).join("")}
              </select>
            </label>
            <label class="ocr-control ocr-pages-limit-control">
              <span>Max stron PDF</span>
              <select class="ocr-pages-limit" aria-label="Maksymalna liczba stron PDF">
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20" selected>20</option>
                <option value="40">40</option>
                <option value="0">Wszystkie</option>
              </select>
            </label>
            <button class="ocr-run" type="button" disabled>Rozpoznaj i przygotuj</button>
          </div>
          <div class="ocr-status">
            <span class="ocr-status-dot"></span>
            <span class="ocr-status-text">Wybierz dokument, aby rozpocząć.</span>
            <label class="ocr-auto-open" title="Po „Zapisz do folderu” od razu otwórz ten folder w Eksploratorze">
              <input class="ocr-auto-open-folder" type="checkbox" />
              <span>Po zapisie otwórz folder</span>
            </label>
          </div>
          <div class="ocr-split">
            <section class="ocr-pane ocr-source-pane">
              <header><strong>Oryginał</strong><span class="ocr-document-name">Brak dokumentu</span></header>
              <div class="ocr-drop-zone">
                <div class="ocr-empty-preview">
                  <b>Upuść tutaj obraz lub PDF</b>
                  <span>PNG, JPG, WEBP albo wielostronicowy PDF</span>
                </div>
                <div class="ocr-pages"></div>
              </div>
            </section>
            <section class="ocr-pane ocr-text-pane">
              <header>
                <span class="ocr-result-heading"><strong class="ocr-result-title">Tekst po polsku</strong><small class="ocr-result-meta">Word (.docx)</small></span>
                <span class="ocr-text-actions">
                  <button class="ocr-copy" type="button">Kopiuj</button>
                  <button class="ocr-to-chat" type="button" disabled title="Wstaw wynik do pola wiadomości NestCafe">Do czatu</button>
                  <button class="ocr-preview-toggle" type="button" hidden>Edytuj</button>
                  <button class="ocr-save-folder" type="button" disabled title="Zapisz do folderu wyników (fallback: supercli-data\\exports\\ocr)">Zapisz do folderu</button>
                  <button class="ocr-open-folder" type="button" disabled title="Otwórz folder z ostatnim zapisem">Otwórz folder</button>
                  <button class="ocr-open-file" type="button" disabled title="Otwórz ostatni zapisany plik (np. Word)">Otwórz plik</button>
                  <button class="ocr-choose-folder" type="button" title="Ustaw własny folder wyników">Folder…</button>
                  <button class="ocr-download" type="button" disabled>Pobierz…</button>
                </span>
              </header>
              <div class="ocr-document-editor">
                <textarea class="ocr-output" spellcheck="true" placeholder="Rozpoznany tekst pojawi się tutaj…"></textarea>
                <div class="ocr-word-stage" hidden>
                  <article class="ocr-markdown-preview ocr-word-page" aria-label="Podgląd jak w Wordzie"></article>
                </div>
              </div>
              <form class="ocr-correction">
                <input class="ocr-correction-input" placeholder="Np. popraw pisownię, zachowaj układ akapitów…" />
                <button type="submit">Popraw z AI</button>
              </form>
            </section>
          </div>
        </section>
        <dialog class="ocr-confirm-dialog">
          <form method="dialog">
            <strong class="ocr-confirm-title">Usunąć wpis?</strong>
            <p class="ocr-confirm-text"></p>
            <div>
              <button type="submit" value="cancel">Anuluj</button>
              <button class="ocr-confirm-delete" type="submit" value="confirm">Usuń</button>
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
      modeSelect.disabled = value || currentImages.length === 0;
      languageSelect.disabled = value || modeSelect.value !== "translate";
      languageControl.classList.toggle("disabled", modeSelect.value !== "translate");
      formatSelect.disabled = value;
      runButton.disabled = value || currentImages.length === 0 || !modeSelect.value;
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
          ? `Otwórz folder: ${lastSavedDir}`
          : "Najpierw zapisz dokument do folderu";
      }
      if (openFileButton) {
        openFileButton.disabled = busy || !lastSavedPath;
        openFileButton.title = lastSavedPath
          ? `Otwórz plik: ${lastSavedPath}`
          : "Najpierw zapisz dokument do folderu";
      }
      void usedFallback;
    }

    function outputFolderLabel() {
      if (outputFolder) return outputFolder;
      return "supercli-data\\exports\\ocr (domyślny)";
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
      // Keep this short on purpose: long OCR prompts make small/local models
      // overthink and emit more tokens. Rules only — no examples, no essays.
      const lang = languagePromptNames[languageSelect.value] || "Polish";
      const asPlain = formatSelect.value === "txt";
      const shape = asPlain
        ? "plain text, keep line breaks"
        : "light Markdown (headings/lists only if present in the scan)";
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
        resultTitle.textContent = "Rozpoznany tekst";
      } else if (modeSelect.value === "translate") {
        resultTitle.textContent = languageTitles[languageSelect.value] || languageTitles.pl;
      } else {
        resultTitle.textContent = "Wynik dokumentu";
      }
      resultMeta.textContent = format.label;
      downloadButton.textContent = format.action.replace(/^Pobierz/, "Pobierz…");
      downloadButton.disabled = busy || !output.value.trim();
      if (saveFolderButton) {
        saveFolderButton.disabled = busy || !output.value.trim();
        saveFolderButton.title = `Zapisz do: ${outputFolderLabel()}`;
      }
      if (chooseFolderButton) {
        chooseFolderButton.disabled = busy;
        chooseFolderButton.title = outputFolder
          ? `Folder wyników: ${outputFolder}\nKlik = zmień · PPM = wróć do domyślnego (supercli-data\\exports\\ocr)`
          : "Ustaw własny folder wyników. Bez ustawienia: supercli-data\\exports\\ocr";
        chooseFolderButton.textContent = outputFolder ? "Folder ✓" : "Folder…";
      }
      if (toChatButton) toChatButton.disabled = busy || !output.value.trim();
      if (openFolderButton) openFolderButton.disabled = busy || !lastSavedDir;
      if (openFileButton) openFileButton.disabled = busy || !lastSavedPath;
      updateOutputPresentation();
    }

    async function saveToOutputFolder() {
      if (!output.value.trim()) return;
      if (saveFolderButton) saveFolderButton.disabled = true;
      try {
        const result = await api.saveDocument({
          format: formatSelect.value,
          filename: outputFilename(),
          text: output.value,
          dir: outputFolder || "",
        });
        const path = result?.path || "";
        rememberSavedPath(path, result?.dir || "", Boolean(result?.used_fallback));
        if (result?.used_fallback) {
          api.toast(`Zapisano (fallback): ${path}`);
          setBusy(false, `Zapisano do domyślnego folderu: ${path}`);
        } else {
          api.toast(`Zapisano: ${path}`);
          setBusy(false, `Zapisano: ${path}`);
        }
        if (autoOpenFolderAfterSave && lastSavedDir) {
          await openLastFolder();
        }
      } catch (error) {
        api.toast(error.message || "Nie udało się zapisać do folderu.");
        setBusy(false, error.message || "Błąd zapisu do folderu.");
      } finally {
        updateResultLabels();
      }
    }

    async function openLastFolder() {
      if (!lastSavedDir) {
        api.toast("Najpierw zapisz dokument do folderu.");
        return;
      }
      try {
        await api.openFolder(lastSavedDir);
      } catch (error) {
        // Fallback: open path (also accepts absolute export dirs)
        try {
          await api.openPath(lastSavedDir);
        } catch (inner) {
          api.toast(inner.message || error.message || "Nie udało się otworzyć folderu.");
        }
      }
    }

    async function openLastFile() {
      if (!lastSavedPath) {
        api.toast("Najpierw zapisz dokument do folderu.");
        return;
      }
      try {
        await api.openPath(lastSavedPath);
      } catch (error) {
        api.toast(error.message || "Nie udało się otworzyć pliku.");
      }
    }

    async function chooseOutputFolder() {
      try {
        const picked = await api.pickFolder();
        if (!picked?.path) return;
        outputFolder = picked.path;
        await api.setSetting("outputFolder", outputFolder);
        api.toast(`Folder wyników: ${outputFolder}`);
        setBusy(false, `Folder wyników ustawiony: ${outputFolder}`);
        updateResultLabels();
      } catch (error) {
        api.toast(error.message || "Nie udało się wybrać folderu.");
      }
    }

    async function clearOutputFolder() {
      if (!outputFolder) {
        api.toast("Już używasz domyślnej ścieżki: supercli-data\\exports\\ocr");
        return;
      }
      outputFolder = "";
      await api.setSetting("outputFolder", "");
      api.toast("Wrócono do domyślnego folderu: supercli-data\\exports\\ocr");
      setBusy(false, "Zapisz do folderu → supercli-data\\exports\\ocr");
      updateResultLabels();
    }

    function updateOutputPresentation() {
      const format = formatSelect.value || "docx";
      const canPreview = format !== "txt" && Boolean(output.value.trim());
      const showPreview = canPreview && !outputEditing;
      const isWord = format === "docx";
      output.hidden = showPreview;
      if (wordStage) wordStage.hidden = !showPreview;
      outputPreview.hidden = !showPreview;
      outputPreview.classList.toggle("ocr-word-page", isWord);
      previewToggle.hidden = !canPreview;
      if (outputEditing) {
        previewToggle.textContent = isWord ? "Jak w Wordzie" : "Podgląd";
      } else {
        previewToggle.textContent = "Edytuj";
      }
      if (canPreview) {
        outputPreview.innerHTML = markdownToHTML(output.value) || "<p></p>";
      }
    }

    function outputFilename() {
      const extension = formatSelect.value || "docx";
      const source = currentFile?.name || documentName.textContent || "transkrypcja";
      return `${source.replace(/\.[^.]+$/, "") || "transkrypcja"}.${extension}`;
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
        return window.supercliSaveFile(filename, await blobToBase64(blob));
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
      if (!model.modelId) throw new Error("Wybierz model obsługujący obrazy.");
      const result = await api.visionTranscribe({
        ...image,
        prompt: buildPrompt(),
        providerId: model.providerId,
        modelId: model.modelId,
      });
      const cleanText = stripReasoning(result.text);
      if (!cleanText) throw new Error("Model nie zwrócił końcowego tekstu dokumentu.");
      return cleanText;
    }

    function showImages(images) {
      pages.replaceChildren();
      $(".ocr-empty-preview").hidden = images.length > 0;
      images.forEach((src, index) => {
        const figure = document.createElement("figure");
        figure.className = "ocr-page";
        const img = document.createElement("img");
        img.src = src;
        img.alt = `Strona ${index + 1}`;
        const caption = document.createElement("figcaption");
        caption.textContent = images.length > 1 ? `Strona ${index + 1}` : "Podgląd dokumentu";
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

    async function saveHistory(name, text) {
      const cleanText = stripReasoning(text);
      try {
        await storeCurrentSource();
      } catch (error) {
        api.toast(`Tekst zapisano, ale nie udalo sie zachowac oryginalu: ${error.message || "blad zapisu pliku"}`);
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
      history = [entry, ...history.filter((item) => item.name !== name || item.text !== text)].slice(0, 12);
      renderHistory();
      await api.setSetting("history", JSON.stringify(history));
    }

    async function restoreHistoryItem(item) {
      currentFile = null;
      currentImages = [];
      currentSourcePath = item.sourcePath || "";
      currentSourceType = item.sourceType || "";
      outputEditing = false;
      showImages([]);
      documentName.textContent = item.name || "Dokument z historii";
      output.value = stripReasoning(item.text);
      modeSelect.value = item.mode || (item.language === "original" ? "original" : "translate");
      languageSelect.value = languages[item.language] ? item.language : "pl";
      formatSelect.value = item.format || "docx";
      updateResultLabels();

      if (!currentSourcePath) {
        setBusy(false, "Wczytano tekst ze starszego wpisu. Ten zapis nie zawiera jeszcze oryginalnego pliku.");
        return;
      }

      setBusy(true, "Wczytywanie oryginalnego dokumentu z historii...");
      try {
        const blob = await api.loadSource(currentSourcePath);
        currentSourceType = blob.type || currentSourceType;
        currentFile = new File([blob], item.name || "dokument", { type: currentSourceType });
        if (currentSourceType === "application/pdf" || /\.pdf$/i.test(item.name || "")) {
          currentImages = await processPDF(blob);
        } else {
          currentImages = [await readAsDataURL(blob)];
        }
        showImages(currentImages);
        setBusy(false, "Wczytano tekst i oryginalny dokument z historii.");
      } catch (error) {
        currentFile = null;
        currentImages = [];
        showImages([]);
        setBusy(false, `Wczytano tekst, ale oryginalny plik jest niedostepny: ${error.message || "blad odczytu"}`);
      }
    }

    async function persistHistory() {
      renderHistory();
      await api.setSetting("history", JSON.stringify(history));
    }

    function requestHistoryDelete(item = null) {
      if (!item && history.length === 0) return;
      pendingHistoryDelete = item ? { id: item.id } : { all: true };
      confirmTitle.textContent = item ? "Usunąć z historii?" : "Wyczyścić historię OCR?";
      confirmText.textContent = item
        ? `Dokument „${item.name || "Dokument"}” zostanie usunięty tylko z historii OCR.`
        : `Usunięte zostaną wszystkie wpisy historii OCR (${history.length}). Pliki źródłowe pozostaną bez zmian.`;
      confirmDialog.returnValue = "";
      confirmDialog.showModal();
    }

    function renderHistory() {
      historyList.replaceChildren();
      clearHistoryButton.hidden = history.length === 0;
      if (history.length === 0) {
        const empty = document.createElement("p");
        empty.className = "ocr-history-empty";
        empty.textContent = "Historia jest pusta.";
        historyList.appendChild(empty);
        return;
      }
      history.forEach((item) => {
        const entry = document.createElement("article");
        entry.className = "ocr-history-entry";
        const row = document.createElement("button");
        row.type = "button";
        row.className = "ocr-history-item";
        row.title = item.name || "Dokument";
        const strong = document.createElement("strong");
        strong.textContent = item.name || "Dokument";
        const preview = document.createElement("span");
        preview.textContent = stripReasoning(item.text).replace(/\s+/g, " ").slice(0, 140);
        const date = document.createElement("small");
        const savedMode = item.mode || (item.language === "original" ? "original" : "translate");
        const savedLanguage = savedMode === "original" ? "język oryginału" : (languages[item.language] || languages.pl);
        const savedFormat = outputFormats[item.format] || outputFormats.docx;
        date.textContent = `${textModes[savedMode] || textModes.original}: ${savedLanguage} · ${savedFormat.label} · ${new Date(item.date).toLocaleString("pl-PL")}`;
        row.append(strong, preview, date);
        row.addEventListener("click", () => restoreHistoryItem(item));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "ocr-history-delete";
        remove.title = `Usuń „${item.name || "Dokument"}” z historii`;
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

    async function transcribeCurrent() {
      if (busy || currentImages.length === 0 || !modeSelect.value) return;
      setBusy(true, `Rozpoznawanie 1 z ${currentImages.length}…`);
      outputEditing = false;
      output.value = "";
      try {
        const chunks = [];
        for (let index = 0; index < currentImages.length; index += 1) {
          setActivePage(index);
          setBusy(true, `Rozpoznawanie strony ${index + 1} z ${currentImages.length}…`);
          const text = await recognizeImage(currentImages[index]);
          const pageLabel = formatSelect.value === "txt" ? `Strona ${index + 1}` : `## Strona ${index + 1}`;
          chunks.push(currentImages.length > 1 ? `${pageLabel}\n\n${text}` : text);
          output.value = chunks.join("\n\n");
          updateResultLabels();
        }
        setActivePage(-1);
        const name = currentFile?.name || documentName.textContent || "Dokument";
        await saveHistory(name, output.value);
        const language = modeSelect.value === "original" ? "język oryginału" : (languages[languageSelect.value] || languages.pl);
        const format = (outputFormats[formatSelect.value] || outputFormats.docx).label;
        setBusy(false, `Gotowe · ${currentImages.length} ${currentImages.length === 1 ? "strona" : "stron"} · ${language} · ${format}`);
      } catch (error) {
        setActivePage(-1);
        setBusy(false, error.message || "Nie udało się rozpoznać tekstu.");
        api.toast(error.message || "Błąd OCR");
      }
    }

    async function processPDF(file) {
      const pdfjs = await ensurePDF();
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data }).promise;
      let pageCount = pdf.numPages;
      const limit = maxPdfPages > 0 ? maxPdfPages : pageCount;
      if (pageCount > limit) {
        const ok = confirm(
          `PDF ma ${pageCount} stron. Według ustawienia OCR weźmie pierwsze ${limit}. Kontynuować?`,
        );
        if (!ok) throw new Error("Anulowano wczytywanie PDF.");
        pageCount = limit;
      }
      // Slightly lower scale on long PDFs to keep memory/time reasonable.
      const scale = pageCount > 8 ? 1.35 : 1.7;
      const images = [];
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        setBusy(true, `Przygotowanie strony ${pageNumber} z ${pageCount}…`);
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d", { alpha: false });
        await page.render({ canvasContext: ctx, viewport }).promise;
        images.push(canvas.toDataURL("image/png"));
      }
      if (pdf.numPages > pageCount) {
        api.toast(`Wzięto ${pageCount} z ${pdf.numPages} stron PDF (limit w toolbarze).`);
      }
      return images;
    }

    function sendResultToChat() {
      const text = stripReasoning(output.value).trim();
      if (!text) return;
      const name = currentFile?.name || documentName.textContent || "dokument";
      const prompt = `Oto wynik OCR z pliku „${name}”.\n\n${text}`;
      const field = document.querySelector("#prompt");
      if (field) {
        field.value = prompt;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.focus();
      }
      window.NestCafe?.closeModule?.() || window.closeNestCafeModule?.();
      api.toast("Wynik OCR wstawiony do czatu. Uzupełnij pytanie i wyślij.");
    }

    async function processFile(file) {
      if (!file || busy) return;
      currentFile = file;
      currentSourcePath = "";
      currentSourceType = file.type || "";
      outputEditing = false;
      documentName.textContent = file.name || "Dokument";
      modeSelect.value = "";
      output.value = "";
      updateResultLabels();
      setBusy(true, "Wczytywanie dokumentu…");
      try {
        if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
          currentImages = await processPDF(file);
        } else if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
          currentImages = [await readAsDataURL(file)];
        } else {
          throw new Error("Obsługiwane są obrazy PNG/JPG/WEBP oraz pliki PDF.");
        }
        showImages(currentImages);
        setBusy(false, "Dokument gotowy. Wybierz „Oryginał” albo „Przetłumacz”, a potem uruchom rozpoznawanie.");
        modeSelect.focus();
      } catch (error) {
        currentImages = [];
        showImages([]);
        setBusy(false, error.message || "Nie można odczytać dokumentu.");
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
          modelSelect.append(new Option("Brak skonfigurowanego modelu", ""));
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
        modelSelect.replaceChildren(new Option("Nie można wczytać modeli", ""));
        status.textContent = error.message;
      }
    }

    fileInput.addEventListener("change", () => processFile(fileInput.files?.[0]));
    runButton.addEventListener("click", transcribeCurrent);
    modeSelect.addEventListener("change", () => {
      updateResultLabels();
      if (modeSelect.value === "original") {
        setBusy(false, "Gotowe do wyciągnięcia tekstu w języku oryginału. Kliknij „Rozpoznaj i przygotuj”.");
      } else if (modeSelect.value === "translate") {
        setBusy(false, `Gotowe do tłumaczenia na język ${languages[languageSelect.value] || languages.pl}. Kliknij „Rozpoznaj i przygotuj”.`);
      } else {
        setBusy(false, "Wybierz „Oryginał” albo „Przetłumacz”.");
      }
    });
    languageSelect.addEventListener("change", () => {
      updateResultLabels();
      api.setSetting("language", languageSelect.value);
      if (currentImages.length && modeSelect.value === "translate") status.textContent = `Język tłumaczenia: ${languages[languageSelect.value]}. Kliknij „Rozpoznaj i przygotuj”.`;
    });
    formatSelect.addEventListener("change", () => {
      outputEditing = false;
      updateResultLabels();
      api.setSetting("format", formatSelect.value);
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
          api.toast("Historia OCR została wyczyszczona.");
        } catch (error) {
          history = previousHistory;
          renderHistory();
          api.toast(error.message || "Nie udało się wyczyścić historii OCR.");
        }
        return;
      }
      const previousLength = history.length;
      history = history.filter((item) => item.id !== deletion.id);
      if (history.length !== previousLength) {
        try {
          await persistHistory();
          api.toast("Usunięto wpis z historii OCR.");
        } catch (error) {
          history = previousHistory;
          renderHistory();
          api.toast(error.message || "Nie udało się usunąć wpisu z historii OCR.");
        }
      }
    });
    $(".ocr-new").addEventListener("click", () => {
      currentFile = null;
      currentImages = [];
      currentSourcePath = "";
      currentSourceType = "";
      outputEditing = false;
      fileInput.value = "";
      modeSelect.value = "";
      output.value = "";
      documentName.textContent = "Brak dokumentu";
      showImages([]);
      updateResultLabels();
      setBusy(false, "Wybierz dokument, aby rozpocząć.");
    });
    $(".ocr-copy").addEventListener("click", async () => {
      if (!output.value) return;
      await navigator.clipboard.writeText(output.value);
      api.toast("Skopiowano transkrypcję.");
    });
    toChatButton?.addEventListener("click", sendResultToChat);
    saveFolderButton?.addEventListener("click", saveToOutputFolder);
    openFolderButton?.addEventListener("click", openLastFolder);
    openFileButton?.addEventListener("click", openLastFile);
    chooseFolderButton?.addEventListener("click", chooseOutputFolder);
    // PPM na „Folder…” = wróć do domyślnego supercli-data\exports\ocr
    chooseFolderButton?.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      clearOutputFolder().catch((error) => {
        api.toast(error.message || "Nie udało się przywrócić domyślnego folderu.");
      });
    });
    pagesLimitSelect?.addEventListener("change", async () => {
      maxPdfPages = Number(pagesLimitSelect.value) || 0;
      await api.setSetting("maxPdfPages", maxPdfPages);
      api.toast(
        maxPdfPages > 0
          ? `Limit PDF: pierwsze ${maxPdfPages} stron`
          : "Limit PDF: wszystkie strony",
      );
    });
    autoOpenFolderInput?.addEventListener("change", async () => {
      autoOpenFolderAfterSave = Boolean(autoOpenFolderInput.checked);
      await api.setSetting("autoOpenFolderAfterSave", autoOpenFolderAfterSave);
      api.toast(
        autoOpenFolderAfterSave
          ? "Po zapisie folder wyników otworzy się automatycznie."
          : "Po zapisie folder nie otwiera się sam.",
      );
    });
    previewToggle.addEventListener("click", () => {
      outputEditing = !outputEditing;
      updateOutputPresentation();
      if (outputEditing) output.focus();
    });
    downloadButton.addEventListener("click", async () => {
      if (!output.value) return;
      downloadButton.disabled = true;
      try {
        const blob = await api.exportDocument({
          format: formatSelect.value,
          filename: outputFilename(),
          text: output.value,
        });
        const result = await saveBlob(blob, outputFilename());
        if (result?.saved) api.toast(`Pobrano: ${result.path || outputFilename()}`);
      } catch (error) {
        if (error?.name !== "AbortError") api.toast(error.message || "Nie udało się przygotować dokumentu.");
      } finally {
        updateResultLabels();
      }
    });
    output.addEventListener("input", updateResultLabels);
    correctionForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const instruction = correctionInput.value.trim();
      if (!instruction || !output.value || busy) return;
      setBusy(true, "AI poprawia transkrypcję…");
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
            `Keep format: ${formatSelect.value === "txt" ? "plain text" : "light Markdown"}.`,
            "",
            "TEXT:",
            output.value,
            "",
            "REQUEST:",
            instruction,
          ].join("\n"),
        });
        output.value = stripReasoning(result.text);
        if (!output.value) throw new Error("Model nie zwrócił poprawionego tekstu końcowego.");
        outputEditing = false;
        correctionInput.value = "";
        updateResultLabels();
        await saveHistory(currentFile?.name || documentName.textContent || "Dokument", output.value);
        setBusy(false, "Transkrypcja została poprawiona.");
      } catch (error) {
        setBusy(false, error.message || "Nie udało się poprawić tekstu.");
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
    setBusy(false, "Wybierz dokument, aby rozpocząć.");

    return () => {
      if (confirmDialog.open) confirmDialog.close("cancel");
      container.replaceChildren();
    };
  }

  window.NestCafeModules["ocr-viewer"] = { mount };
})();
