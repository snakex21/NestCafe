"use strict";

const folderSettingsUI = window.NestCafe?.settings?.ui;

function folderPathKey(path) {
  return String(path || "").replace(/[\\/]+$/, "").toLowerCase();
}

function folderCountSummary(result) {
  if (!result) return "Nie przeskanowano";
  if (result.error) return result.error;
  const parts = [];
  const counts = result.counts || {};
  for (const [key, label] of [
    ["pdf", "PDF"],
    ["docx", "DOCX"],
    ["xlsx", "XLSX"],
    ["pptx", "PPTX"],
    ["md", "MD"],
    ["txt", "TXT"],
    ["eml", "EML"],
    ["png", "PNG"],
    ["jpg", "JPG"],
  ]) {
    if (counts[key]) parts.push(`${counts[key]} ${label}`);
  }
  return parts.length ? parts.join(" · ") : result.total ? `${result.total} innych plików` : "Folder jest pusty";
}

window.NestCafe?.settings?.registerPage?.("folders", "Pliki i foldery", async (root) => {
  let state = { config: { selected_paths: [], custom_paths: [] }, entries: [], suggestions: [] };
  let modelCatalog = [];
  let jobPollActive = false;
  let cancelRequested = false;
  const scans = new Map();
  const list = document.createElement("div");
  list.className = "folder-index-list";
  const suggestions = document.createElement("section");
  suggestions.className = "folder-suggestions";

  const scanButton = folderSettingsUI.button("Odśwież skan");
  const addButton = folderSettingsUI.button("+ Wybierz folder");
  const indexButton = folderSettingsUI.button("Indeksuj z AI", "settings-primary-button");
  const cancelIndexButton = folderSettingsUI.button("Anuluj analizę", "settings-danger-button");
  cancelIndexButton.hidden = true;
  const status = document.createElement("div");
  status.className = "folder-index-status";

  const visionModel = document.createElement("select");
  visionModel.className = "folder-ai-model";
  visionModel.setAttribute("aria-label", "Model AI do indeksowania");
  const visionNote = document.createElement("p");
  visionNote.className = "folder-ai-model-note";
  const report = document.createElement("section");
  report.className = "folder-ai-report";
  report.hidden = true;

  const outlookPanel = document.createElement("section");
  outlookPanel.className = "folder-vision-settings folder-outlook-settings";
  outlookPanel.innerHTML = `
    <div class="folder-vision-copy">
      <span class="folder-vision-mark" aria-hidden="true">@</span>
      <div><strong>Poczta Outlook</strong><small>Indeksuje temat, nadawcę, datę, treść i nazwy załączników z lokalnego Outlooka. Nie wysyła, nie przenosi i nie oznacza wiadomości jako przeczytanych.</small></div>
    </div>
    <div class="folder-vision-controls">
      <label><span>Folder poczty</span><input class="folder-outlook-name" type="text" value="Inbox" placeholder="Inbox lub konto/folder" /></label>
      <label><span>Najnowsze wiadomości</span><input class="folder-outlook-limit" type="number" min="1" max="2000" step="1" value="250" /></label>
      <label class="folder-vision-toggle"><span>Indeksuj</span><input class="settings-switch-input" type="checkbox" aria-label="Włącz indeksowanie poczty Outlook" /></label>
    </div>
    <p class="folder-vision-note">Pierwsze uruchomienie może potrwać dłużej. Następne używa cache i analizuje tylko zmienione wiadomości.</p>`;
  const outlookToggle = outlookPanel.querySelector(".folder-vision-toggle input");
  const outlookFolder = outlookPanel.querySelector(".folder-outlook-name");
  const outlookLimit = outlookPanel.querySelector(".folder-outlook-limit");

  const selectedPaths = () => state.entries.filter((entry) => entry.selected).map((entry) => entry.path);
  const savedPaths = () => state.entries.map((entry) => entry.path);

  const saveSelection = async () => {
    await folderSettingsUI.json("/api/folder-indexing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        selected_paths: selectedPaths(),
        custom_paths: savedPaths(),
        visual_index: Boolean(visionModel.selectedOptions[0]?.dataset.model),
        vision_provider: visionModel.selectedOptions[0]?.dataset.provider || "",
        vision_model: visionModel.selectedOptions[0]?.dataset.model || "",
        outlook_index: outlookToggle.checked,
        outlook_folder: outlookFolder.value.trim() || "Inbox",
        outlook_max_messages: Math.min(2000, Math.max(1, Number(outlookLimit.value) || 250)),
      }),
    });
  };

  const renderStatus = () => {
    const selected = selectedPaths();
    const sourceCount = selected.length + (outlookToggle.checked ? 1 : 0);
    const scannedFiles = selected.reduce((total, path) => total + (scans.get(folderPathKey(path))?.total || 0), 0);
    const last = state.config?.last_indexed_at;
    const job = state.job;
    const jobRunning = job?.state === "running";
    const currentFile = job?.current_file?.split(/[\\/]/).pop() || "Przygotowywanie indeksu";
    status.innerHTML = `
      <div><strong>${sourceCount}</strong><span>Wybrane źródła</span></div>
      <div><strong>${scannedFiles}</strong><span>Pliki w aktualnym skanie</span></div>
      <div><strong>${jobRunning ? `${job.current || 0}/${job.total || "…"}` : last ? new Date(last).toLocaleString("pl-PL") : "—"}</strong><span>${jobRunning ? currentFile : "Ostatnia indeksacja"}</span></div>`;
    indexButton.disabled = !sourceCount || jobRunning || !visionModel.value;
    indexButton.textContent = jobRunning ? `AI analizuje ${job.current || 0}/${job.total || "…"}` : "Indeksuj z AI";
    cancelIndexButton.hidden = !jobRunning;
    cancelIndexButton.disabled = !jobRunning || cancelRequested;
    cancelIndexButton.textContent = cancelRequested ? "Anulowanie…" : "Anuluj analizę";
    status.classList.toggle("working", jobRunning);
  };

  const render = () => {
    suggestions.replaceChildren();
    if (state.suggestions?.length) {
      const copy = document.createElement("div");
      copy.innerHTML = "<strong>Lokalizacje z tego komputera</strong><span>NestCafe odczytuje je z Windows i pokazuje tylko foldery oraz dyski, które rzeczywiście istnieją.</span>";
      const buttons = document.createElement("div");
      for (const suggestion of state.suggestions) {
        const button = folderSettingsUI.button(`+ ${suggestion.label}`);
        button.title = suggestion.path;
        button.addEventListener("click", async () => addFolder(suggestion));
        buttons.append(button);
      }
      suggestions.append(copy, buttons);
    }
    suggestions.hidden = !state.suggestions?.length;

    list.replaceChildren();
    for (const entry of state.entries || []) {
      const row = document.createElement("article");
      row.className = `folder-index-row${entry.selected ? " selected" : ""}`;
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.className = "folder-index-check";
      toggle.checked = entry.selected;
      const icon = document.createElement("span");
      icon.className = "folder-index-icon";
      icon.textContent = /^[a-z]:[\\/]?$/i.test(entry.path) ? "▣" : "▱";
      const copy = document.createElement("div");
      const titleLine = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = entry.label;
      titleLine.append(title);
      if (entry.indexed) {
        const badge = document.createElement("span");
        badge.className = "settings-status-badge online";
        badge.textContent = "Indeks AI";
        titleLine.append(badge);
      }
      const path = document.createElement("code");
      path.textContent = entry.path;
      const scan = document.createElement("span");
      const result = scans.get(folderPathKey(entry.path));
      scan.className = result?.error ? "folder-index-scan error" : "folder-index-scan";
      scan.textContent = folderCountSummary(result);
      if (entry.indexed) {
        scan.textContent += ` · AI opisało ${entry.indexed.ai_file_count || 0}/${entry.indexed.file_count} plików`;
        if (entry.indexed.content_file_count) scan.textContent += ` · treść ${entry.indexed.content_file_count}`;
        if (entry.indexed.reused_file_count) scan.textContent += ` · z cache ${entry.indexed.reused_file_count}`;
        if (entry.indexed.visual_file_count) scan.textContent += ` · wizja ${entry.indexed.visual_file_count}`;
        if (entry.indexed.skipped_file_count) scan.textContent += ` · pominięte ${entry.indexed.skipped_file_count}`;
      }
      copy.append(titleLine, path, scan);
      const actions = document.createElement("div");
      const remove = folderSettingsUI.button("Usuń", "settings-danger-button");
      remove.addEventListener("click", async () => {
        remove.disabled = true;
        state.entries = state.entries.filter((item) => item.id !== entry.id);
        scans.delete(folderPathKey(entry.path));
        try {
          await saveSelection();
          await loadState(false);
          window.NestCafe?.toast?.("Folder został usunięty z indeksowania.");
        } catch (error) {
          window.NestCafe?.toast?.(error.message);
          await loadState(false);
        }
      });
      actions.append(remove);
      toggle.addEventListener("change", async () => {
        entry.selected = toggle.checked;
        toggle.disabled = true;
        try {
          await saveSelection();
          if (entry.selected) await scanPaths([entry.path]);
          render();
        } catch (error) {
          entry.selected = !toggle.checked;
          toggle.checked = entry.selected;
          window.NestCafe?.toast?.(error.message);
        } finally {
          toggle.disabled = false;
        }
      });
      row.append(toggle, icon, copy, actions);
      list.append(row);
    }
    if (!state.entries?.length) {
      list.append(folderSettingsUI.empty("Nie dodano folderów", "Wybierz proponowaną lokalizację albo dodaj dowolny folder z dysku."));
    }
    renderStatus();
  };

  const renderReport = (results = []) => {
    report.replaceChildren();
    if (!results.length) {
      report.hidden = true;
      return;
    }
    report.hidden = false;
    const totals = results.reduce(
      (sum, result) => ({
        ai: sum.ai + (result.ai_indexed || 0),
        reused: sum.reused + (result.reused || 0),
        images: sum.images + (result.visual_indexed || 0),
        skipped: sum.skipped + (result.skipped_total || 0),
      }),
      { ai: 0, reused: 0, images: 0, skipped: 0 },
    );
    const head = document.createElement("header");
    head.innerHTML = `<div><strong>Raport indeksowania AI</strong><span>AI ${totals.ai} · cache ${totals.reused} · obrazy ${totals.images} · pominięte ${totals.skipped}</span></div>`;
    report.append(head);
    for (const result of results) {
      const item = document.createElement("article");
      const title = document.createElement("strong");
      title.textContent = result.path || "Poczta Outlook";
      const metrics = document.createElement("span");
      metrics.textContent = result.error
        ? result.error
        : `AI ${result.ai_indexed || 0} · cache ${result.reused || 0} · pominięte ${result.skipped_total || 0}`;
      item.append(title, metrics);
      if (result.folder_summary) {
        const summary = document.createElement("p");
        summary.textContent = result.folder_summary;
        item.append(summary);
      }
      const skipped = result.skipped || [];
      if (skipped.length) {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = `Pokaż pominięte pliki (${result.skipped_total || skipped.length})`;
        const skippedList = document.createElement("ul");
        for (const entry of skipped) {
          const row = document.createElement("li");
          const path = document.createElement("code");
          path.textContent = entry.path || "Nieznany plik";
          const reason = document.createElement("span");
          reason.textContent = entry.reason || "AI nie mogło przeanalizować pliku";
          row.append(path, reason);
          skippedList.append(row);
        }
        const hiddenCount = Math.max(0, (result.skipped_total || 0) - skipped.length);
        if (hiddenCount) {
          const more = document.createElement("li");
          more.textContent = `…oraz ${hiddenCount} dalszych plików`;
          skippedList.append(more);
        }
        details.append(summary, skippedList);
        item.append(details);
      }
      report.append(item);
    }
  };

  const updateModelNote = () => {
    const selected = visionModel.selectedOptions[0];
    if (!selected) {
      visionNote.textContent = "Brak skonfigurowanych modeli AI. Dodaj model u dostawcy, aby utworzyć indeks.";
      return;
    }
    visionNote.textContent = "NestCafe wyśle obsługiwane dokumenty i obrazy do wybranego AI. Jeśli model czegoś nie przyjmie, zobaczysz to w raporcie.";
  };

  const scanPaths = async (paths) => {
    if (!paths.length) {
      render();
      return;
    }
    scanButton.disabled = true;
    scanButton.textContent = "Skanowanie…";
    try {
      const response = await folderSettingsUI.json("/api/folder-indexing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan", paths }),
      });
      for (const result of response.results || []) scans.set(folderPathKey(result.path), result);
    } finally {
      scanButton.disabled = false;
      scanButton.textContent = "Odśwież skan";
      render();
    }
  };

  const loadState = async () => {
    const [folderState, models] = await Promise.all([
      folderSettingsUI.json("/api/folder-indexing"),
      folderSettingsUI.json("/api/models"),
    ]);
    state = folderState;
    modelCatalog = [...(models.models || [])].sort((left, right) => {
      if (left.active !== right.active) return left.active ? -1 : 1;
      return `${left.provider}/${left.id}`.localeCompare(`${right.provider}/${right.id}`, "pl");
    });
    visionModel.replaceChildren();
    for (const model of modelCatalog) {
      const option = document.createElement("option");
      option.value = `${encodeURIComponent(model.provider || "")}::${encodeURIComponent(model.id)}`;
      option.dataset.provider = model.provider || "";
      option.dataset.model = model.id;
      option.textContent = `${model.id} · ${model.provider || "provider"}`;
      visionModel.append(option);
    }
    const savedModel = state.config?.vision_model || "";
    const savedProvider = state.config?.vision_provider || "";
    const savedOption = [...visionModel.options].find((option) => option.dataset.model === savedModel && (!savedProvider || option.dataset.provider === savedProvider));
    const activeOption = [...visionModel.options].find((option) => {
      const model = modelCatalog.find((item) => item.id === option.dataset.model && item.provider === option.dataset.provider);
      return model?.active;
    });
    (savedOption || activeOption || visionModel.options[0])?.setAttribute("selected", "selected");
    if (savedOption || activeOption) visionModel.value = (savedOption || activeOption).value;
    visionModel.disabled = modelCatalog.length === 0;
    updateModelNote();
    outlookToggle.checked = Boolean(state.config?.outlook_index);
    outlookFolder.value = state.config?.outlook_folder || "Inbox";
    outlookLimit.value = String(state.config?.outlook_max_messages || 250);
    render();
    if (state.job?.state === "completed") renderReport(state.job.results || []);
    if (state.job?.state === "running" && !jobPollActive) void watchIndexJob(state.job.id);
  };

  const watchIndexJob = async (jobID) => {
    if (jobPollActive) return state.job;
    jobPollActive = true;
    try {
      while (root.isConnected) {
        await new Promise((resolve) => setTimeout(resolve, 850));
        const next = await folderSettingsUI.json("/api/folder-indexing");
        state = next;
        render();
        if (!next.job || next.job.id !== jobID || next.job.state !== "running") {
          cancelRequested = false;
          return next.job;
        }
      }
      return state.job;
    } finally {
      jobPollActive = false;
    }
  };

  visionModel.addEventListener("change", async () => {
    updateModelNote();
    renderStatus();
    await saveSelection();
  });
  outlookToggle.addEventListener("change", async () => {
    await saveSelection();
    render();
  });
  outlookFolder.addEventListener("change", saveSelection);
  outlookLimit.addEventListener("change", saveSelection);

  scanButton.addEventListener("click", () => scanPaths(selectedPaths()));
  cancelIndexButton.addEventListener("click", async () => {
    cancelRequested = true;
    renderStatus();
    try {
      await folderSettingsUI.json("/api/folder-indexing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
    } catch (error) {
      cancelRequested = false;
      renderStatus();
      window.NestCafe?.toast?.(error.message);
    }
  });
  const addFolder = async (folder) => {
    const key = folderPathKey(folder.path);
    const existing = state.entries.find((entry) => folderPathKey(entry.path) === key);
    if (existing) {
      existing.selected = true;
    } else {
      state.entries.push({
        id: `custom-${Date.now()}`,
        label: folder.label || folder.path.split(/[\\/]/).filter(Boolean).pop() || folder.path,
        path: folder.path,
        kind: "saved",
        selected: true,
      });
    }
    await saveSelection();
    await loadState(false);
    await scanPaths([folder.path]);
  };
  addButton.addEventListener("click", async () => {
    const picked = await folderSettingsUI.json("/api/folder-picker");
    if (!picked.path) return;
    await addFolder({ path: picked.path });
  });

  indexButton.addEventListener("click", async () => {
    const paths = selectedPaths();
    if (!paths.length && !outlookToggle.checked) return;
    indexButton.disabled = true;
    cancelRequested = false;
    indexButton.textContent = "Indeksowanie…";
    status.classList.add("working");
    try {
      let response = await folderSettingsUI.json("/api/folder-indexing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "index",
          paths,
          background: true,
          vision_provider: visionModel.selectedOptions[0]?.dataset.provider || "",
          vision_model: visionModel.selectedOptions[0]?.dataset.model || "",
        }),
      });
      if (response.job) {
        state.job = response.job;
        render();
        const finished = await watchIndexJob(response.job.id);
        if (!finished) return;
        if (finished.state === "canceled") {
          renderReport(finished.results || []);
          window.NestCafe?.toast?.("Analiza AI została anulowana. Już przeanalizowane pliki pozostają w cache.");
          return;
        }
        if (finished.state === "failed") throw new Error(finished.error || "Indeksowanie nie powiodło się.");
        response = { results: finished.results || [] };
      }
      const failed = (response.results || []).filter((result) => result.error);
      const visual = (response.results || []).reduce((total, result) => total + (result.visual_indexed || 0), 0);
      const analyzed = (response.results || []).reduce((total, result) => total + (result.ai_indexed || 0), 0);
      const reused = (response.results || []).reduce((total, result) => total + (result.reused || 0), 0);
      const skipped = (response.results || []).reduce((total, result) => total + (result.skipped_total || 0), 0);
      const analysisErrors = (response.results || []).filter((result) => result.analysis_error || result.visual_error);
      renderReport(response.results || []);
      window.NestCafe?.toast?.(
        failed.length
          ? `Indeks zapisany, ale ${failed.length} folderów zwróciło błąd.`
          : analysisErrors.length
            ? `Indeks zapisany. AI przeanalizowało ${analyzed} plików, ale część analizy się nie udała.`
            : analyzed || reused
              ? `Indeks AI zapisany. AI: ${analyzed}, cache: ${reused}, obrazy: ${visual}, pominięte: ${skipped}.`
              : "Indeks treści dokumentów został zapisany w pamięci NestCafe.",
      );
      await loadState();
    } catch (error) {
      window.NestCafe?.toast?.(error.message);
    } finally {
      status.classList.remove("working");
      indexButton.disabled = false;
      indexButton.textContent = "Indeksuj z AI";
    }
  });

  const headerActions = document.createElement("div");
  headerActions.className = "settings-header-actions";
  headerActions.append(scanButton, addButton);
  const actionBar = document.createElement("div");
  actionBar.className = "folder-index-action";
  actionBar.innerHTML = `
    <div class="folder-ai-action-copy"><strong>Indeks AI źródeł</strong><span>Skan zbiera tylko listę plików. Wybrany model AI tworzy krótkie notatki o plikach i całym folderze.</span></div>`;
  const modelControl = document.createElement("label");
  modelControl.className = "folder-ai-model-control";
  const modelLabel = document.createElement("span");
  modelLabel.textContent = "Model AI";
  modelControl.append(modelLabel, visionModel);
  actionBar.append(modelControl, indexButton, cancelIndexButton, visionNote);

  root.replaceChildren(
    folderSettingsUI.sectionHeader(
      "Źródła dokumentów",
      "Dodaj foldery do spisu. Sam skan tylko liczy pliki — przeszukiwalny indeks i notatkę o folderze tworzy dopiero wybrane AI.",
      headerActions,
    ),
    status,
    outlookPanel,
    suggestions,
    list,
    actionBar,
    report,
  );
  await loadState();
});
