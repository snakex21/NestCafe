"use strict";

const THINKING_OPEN_KEY = "nestcafe.chat.thinking-open";
let activeQuestionOverlay = null;
let pendingQuestionBatch = null;
let questionBatchSeq = 0;

function notifyQuestionPending() {
  window.dispatchEvent(new CustomEvent("nestcafe:question-pending", {
    detail: { pending: Boolean(activeQuestionOverlay) },
  }));
}

function preferredThinkingOpen() {
  return localStorage.getItem(THINKING_OPEN_KEY) === "1";
}

function rememberThinkingOpen(open) {
  localStorage.setItem(THINKING_OPEN_KEY, open ? "1" : "0");
}

const toolLabels = {
  read_lines: "Odczyt pliku",
  read_many: "Odczyt plików",
  list_dir: "Lista folderu",
  search_code: "Wyszukiwanie w kodzie",
  ctx_execute: "Polecenie",
  write_file: "Zapis pliku",
  edit_line: "Edycja pliku",
  edit_lines: "Edycja pliku",
  insert_after: "Edycja pliku",
  delete_lines: "Edycja pliku",
  apply_patch: "Edycja pliku",
  patch: "Edycja pliku",
  make_dir: "Utworzenie folderu",
  move: "Przeniesienie pliku",
  copy: "Skopiowanie pliku",
  trash: "Usunięcie pliku",
  edit_docx: "Edycja dokumentu Word",
  edit_xlsx: "Edycja arkusza",
  web_lookup: "Wyszukiwanie w sieci",
  web_fetch: "Odczyt strony",
  task: "Delegowane zadanie",
  ask_user: "Pytanie",
  bash: "Polecenie",
  shell: "Polecenie",
  run_command: "Polecenie",
  read_file: "Odczyt pliku",
  write: "Zapis pliku",
  edit: "Edycja pliku",
  glob: "Wyszukiwanie plików",
  grep: "Wyszukiwanie w plikach",
};

function executionTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function compactHint(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  try {
    const args = JSON.parse(text);
    if (Array.isArray(args)) return args.map((part) => String(part)).join(" ");
    if (args && typeof args === "object") {
      if (Array.isArray(args.command)) return args.command.map((part) => String(part)).join(" ");
      return args.path || args.file || args.command || args.query || args.pattern || args.reads || text;
    }
    return String(args ?? text);
  } catch {
    return text;
  }
}

function inlineMarkdown(parent, text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = part.slice(2, -2);
      parent.appendChild(strong);
    } else if (part.startsWith("`") && part.endsWith("`")) {
      const code = document.createElement("code");
      code.textContent = part.slice(1, -1);
      parent.appendChild(code);
    } else {
      parent.appendChild(document.createTextNode(part));
    }
  }
}

function parseMarkdownTableRow(line) {
  const source = String(line || "").trim();
  if (!source.includes("|")) return [];
  const cells = [];
  let current = "";
  let escaped = false;
  let inCode = false;
  for (const ch of source) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "`") {
      inCode = !inCode;
      current += ch;
      continue;
    }
    if (ch === "|" && !inCode) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (escaped) current += "\\";
  cells.push(current.trim());
  if (cells.length && cells[0] === "") cells.shift();
  if (cells.length && cells[cells.length - 1] === "") cells.pop();
  return cells;
}

function markdownTableAlignments(line) {
  const cells = parseMarkdownTableRow(line);
  if (cells.length < 2 || cells.some((cell) => !/^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")))) return null;
  return cells.map((cell) => {
    const compact = cell.replace(/\s+/g, "");
    if (compact.startsWith(":") && compact.endsWith(":")) return "center";
    if (compact.endsWith(":")) return "right";
    return "left";
  });
}

function appendMarkdownTable(host, headerCells, alignments, bodyRows) {
  const wrap = document.createElement("div");
  wrap.className = "message-table-wrap";
  const table = document.createElement("table");
  table.className = "message-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headerCells.forEach((cell, index) => {
    const th = document.createElement("th");
    th.style.textAlign = alignments[index] || "left";
    inlineMarkdown(th, cell);
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  bodyRows.forEach((cells) => {
    const row = document.createElement("tr");
    for (let index = 0; index < headerCells.length; index++) {
      const td = document.createElement("td");
      td.style.textAlign = alignments[index] || "left";
      inlineMarkdown(td, cells[index] || "");
      row.appendChild(td);
    }
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  host.appendChild(wrap);
}

function renderTextBlock(host, text) {
  const lines = String(text).replace(/<\/?(?:thinking|think|reasoning|reflection)>/gi, "").split(/\r?\n/);
  let list = null;
  let code = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      if (code) {
        host.appendChild(code);
        code = null;
      } else {
        code = document.createElement("pre");
      }
      list = null;
      continue;
    }
    if (code) {
      code.textContent += `${line}\n`;
      continue;
    }
    const headerCells = parseMarkdownTableRow(line);
    const alignments = i + 1 < lines.length ? markdownTableAlignments(lines[i + 1]) : null;
    if (headerCells.length >= 2 && alignments && alignments.length === headerCells.length) {
      const rows = [];
      i += 2;
      while (i < lines.length) {
        if (!lines[i].trim()) break;
        const cells = parseMarkdownTableRow(lines[i]);
        if (cells.length < 2) break;
        rows.push(cells);
        i++;
      }
      i--;
      list = null;
      appendMarkdownTable(host, headerCells, alignments, rows);
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    if (bullet) {
      if (!list) {
        list = document.createElement("ul");
        host.appendChild(list);
      }
      const item = document.createElement("li");
      inlineMarkdown(item, bullet[1]);
      list.appendChild(item);
      continue;
    }
    list = null;
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,3})\s+(.+)/);
    const node = document.createElement(heading ? `h${Math.min(heading[1].length + 2, 5)}` : "p");
    inlineMarkdown(node, heading ? heading[2] : line);
    host.appendChild(node);
  }
  if (code) host.appendChild(code);
}

function splitReasoningSegments(text) {
  const source = String(text || "");
  const segments = [];
  const tags = /<\/?(?:thinking|think|reasoning|reflection)>/gi;
  let outside = 0;
  let inside = 0;
  let depth = 0;
  let thought = "";
  let match;
  const append = (kind, value) => {
    if (value.trim()) segments.push({ kind, text: value });
  };
  while ((match = tags.exec(source))) {
    const closing = match[0][1] === "/";
    if (depth === 0) {
      append("text", source.slice(outside, match.index));
      if (closing) {
        outside = tags.lastIndex;
        continue;
      }
      depth = 1;
      thought = "";
      inside = tags.lastIndex;
      outside = tags.lastIndex;
      continue;
    }
    thought += source.slice(inside, match.index);
    depth += closing ? -1 : 1;
    inside = tags.lastIndex;
    if (depth === 0) {
      append("thinking", thought);
      thought = "";
      outside = tags.lastIndex;
    }
  }
  if (depth > 0) {
    thought += source.slice(inside);
    append("thinking", thought);
  } else {
    append("text", source.slice(outside));
  }
  return segments;
}

function createMessageSegment(segment) {
  if (segment.kind === "text") {
    const host = document.createElement("div");
    host.className = "message-text-segment";
    host.dataset.segmentKind = "text";
    renderTextBlock(host, segment.text);
    return host;
  }

  const thinking = document.createElement("details");
  thinking.className = "thinking-block";
  thinking.dataset.segmentKind = "thinking";
  thinking.innerHTML = `<summary>Myślenie</summary><pre></pre>`;
  thinking.open = preferredThinkingOpen();
  thinking.addEventListener("toggle", () => rememberThinkingOpen(thinking.open));
  thinking.querySelector("pre").textContent = segment.text.trim();
  return thinking;
}

function updateMessageSegment(node, segment) {
  if (segment.kind === "thinking") {
    const pre = node.querySelector("pre");
    if (pre && pre.textContent !== segment.text.trim()) pre.textContent = segment.text.trim();
    return;
  }
  node.replaceChildren();
  renderTextBlock(node, segment.text);
}

function renderMessageContent(container, raw, live) {
  const segments = splitReasoningSegments(raw);
  // Persisted assistant messages are initialized with raw textContent before
  // they are formatted. Remove only those direct text nodes; otherwise the raw
  // <thinking>...</thinking> transcript stays visible above the formatted
  // segments every time an old conversation is reopened.
  for (const node of [...container.childNodes]) {
    // nodeType 3 is TEXT_NODE. Using the numeric DOM constant also works in
    // older WebView2 document realms where the global Node constructor can be
    // missing even though the text nodes themselves are perfectly valid.
    if (node.nodeType === 3) node.remove();
  }
  const existing = [...container.children];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    let node = existing[i];
    if (!node || node.dataset.segmentKind !== segment.kind) {
      const replacement = createMessageSegment(segment);
      if (node) container.replaceChild(replacement, node);
      else container.appendChild(replacement);
      node = replacement;
      existing[i] = node;
    } else {
      updateMessageSegment(node, segment);
    }
  }

  while (container.children.length > segments.length) {
    container.lastElementChild?.remove();
  }
}

function renderLiveMessage(container) {
  if (!container) return;
  renderMessageContent(container, container._rawText || "", true);
  container.dispatchEvent(new CustomEvent("nestcafe:message-rendered", { bubbles: true }));
}

// Rebuilding every accumulated paragraph for every SSE fragment is quadratic
// work. On the long Thunderbird conversation this ran roughly 25 times per
// second against a six-figure transcript. Keep live feedback quick for short
// replies and progressively relax the cadence as the current answer grows.
function scheduleMessageRender(container) {
  if (!container || container._renderTimer != null) return;
  const length = (container._rawText || "").length;
  const delay = length > 48000 ? 250 : (length > 16000 ? 120 : (length > 4000 ? 60 : 40));
  container._renderTimer = setTimeout(() => {
    container._renderTimer = null;
    renderLiveMessage(container);
  }, delay);
}

function appendMessage(container, chunk) {
  if (!container) return;
  container._rawText = `${container._rawText || ""}${chunk || ""}`;
  container.dataset.formatted = "false";
  scheduleMessageRender(container);
}

function finalizeMessage(container) {
  if (!container) return;
  if (container._renderTimer != null) {
    clearTimeout(container._renderTimer);
    container._renderTimer = null;
  }
  if (container.dataset.formatted === "true") return;
  const raw = container._rawText ?? container.textContent ?? "";
  container._rawText = raw;
  container.dataset.formatted = "true";
  renderMessageContent(container, raw, false);
  container.dispatchEvent(new CustomEvent("nestcafe:message-rendered", { bubbles: true }));
}

function ensureRewindControl(article, seq, text, messageAttachments = []) {
  if (!article || !seq || !article.classList.contains("user")) return;
  article.dataset.seq = String(seq);
  const meta = article.querySelector(".message-meta");
  if (!meta || meta.querySelector(".message-rewind")) return;
  const rewind = document.createElement("button");
  rewind.type = "button";
  rewind.className = "message-rewind";
  rewind.textContent = "↶ Cofnij";
  rewind.title = "Cofnij rozmowę do tej wiadomości";
  rewind.addEventListener("click", () => {
    window.NestCafe?.rewindMessage?.(
      seq,
      text,
      rewind,
      messageAttachments.slice(),
    );
  });
  meta.append(rewind);
}

function enableRewind(message, seq, text, messageAttachments = []) {
  const article = message?.classList?.contains("message")
    ? message
    : message?.closest?.(".message");
  ensureRewindControl(article, seq, text, messageAttachments);
}

function createMessage(role, text, conversation, seq = 0, persistedAttachments = []) {
  const rawText = text || "";
  const attachmentsApi = window.NestCafe?.attachments;
  const displayText =
    role === "user" && attachmentsApi?.displayText
      ? attachmentsApi.displayText(rawText)
      : rawText;
  const attachmentNames =
    role === "user" && attachmentsApi?.namesFromTranscript
      ? attachmentsApi.namesFromTranscript(rawText)
      : [];
  const sessionID = role === "user" ? window.NestCafe?.getSession?.() || "" : "";
  const remembered =
    role === "user" && seq && sessionID
      ? attachmentsApi?.forMessage?.(sessionID, seq) || []
      : [];
  const restoredAttachments =
    role === "user" && persistedAttachments.length
      ? persistedAttachments.slice()
      : remembered;

  const article = document.createElement("article");
  article.className = `message ${role}`;
  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = role === "user" ? "Ty" : "NestCafe";
  const body = document.createElement("div");
  body.className = "message-body";
  const content = document.createElement("div");
  content.className = "message-content";
  content._rawText = displayText;
  content._renderTimer = null;
  content.textContent = displayText;
  const time = document.createElement("time");
  time.className = "message-time";
  time.textContent = executionTime();
  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.append(time);
  body.append(content, meta);
  article.append(label, body);
  if (seq) article.dataset.seq = String(seq);
  conversation.appendChild(article);
  if (role === "user" && seq) {
    ensureRewindControl(article, seq, displayText, restoredAttachments);
  }
  if (role === "user") {
    if (restoredAttachments.length) {
      attachmentsApi.renderSent?.(content, restoredAttachments);
    } else if (attachmentNames.length) {
      attachmentsApi.renderTranscriptChips?.(content, attachmentNames);
    }
  }
  if (role === "assistant" && displayText) finalizeMessage(content);
  return content;
}

function createActivity(label, detail, id, conversation) {
  if (!id) {
    const line = document.createElement("div");
    line.className = "activity event-line";
    line.innerHTML = `<strong></strong><span></span>`;
    line.querySelector("strong").textContent = label;
    line.querySelector("span").textContent = detail || "";
    conversation.appendChild(line);
    return line;
  }
  const row = document.createElement("details");
  row.className = "activity tool-activity running";
  row._started = performance.now();
  row.innerHTML = `<summary><span class="tool-icon">›</span><strong></strong><span class="tool-hint"></span><small>W toku</small></summary><div class="tool-body"><label>Dane wejściowe</label><pre></pre></div>`;
  row.querySelector("strong").textContent = toolLabels[label] || label;
  row.querySelector(".tool-hint").textContent = compactHint(detail);
  row.querySelector(".tool-body pre").textContent = detail || "";
  row._clock = setInterval(() => {
    row.querySelector("small").textContent = `W toku · ${((performance.now() - row._started) / 1000).toFixed(1)}s`;
  }, 250);
  conversation.appendChild(row);
  return row;
}

function completeActivity(row, event) {
  clearInterval(row._clock);
  row.classList.remove("running");
  row.classList.add(event.err ? "error" : "done");
  const elapsed = row._started ? `${((performance.now() - row._started) / 1000).toFixed(1)}s` : "gotowe";
  const stat = row.querySelector("small");
  if (stat) stat.textContent = event.err ? `Błąd · ${elapsed}` : `Gotowe · ${elapsed}`;
  const mutationKind = window.SuperCliUI?.mutationKind(row.dataset.toolName, event.output, Boolean(event.err));
  const mutationLabel = {
    created: "Utworzono plik",
    modified: "Zmodyfikowano plik",
    deleted: "Usunięto plik",
    "folder-created": "Utworzono folder",
    moved: "Przeniesiono plik",
    copied: "Skopiowano plik",
  }[mutationKind];
  if (mutationLabel) {
    row.querySelector("strong").textContent = mutationLabel;
    row.classList.add("has-changes");
  }
  const body = row.querySelector(".tool-body");
  if (body) {
    const label = document.createElement("label");
    label.textContent = event.err ? "Błąd" : "Wynik";
    const output = document.createElement("pre");
    output.className = event.err ? "error" : "";
    output.textContent = event.err || event.output || "Gotowe";
    body.append(label, output);
  }
}

function closeQuestion(expectedOverlay = null) {
  if (expectedOverlay && activeQuestionOverlay !== expectedOverlay) {
    expectedOverlay.remove();
    return;
  }
  if (activeQuestionOverlay) activeQuestionOverlay.remove();
  activeQuestionOverlay = null;
  notifyQuestionPending();
}

function normalizeQuestionSpec(question) {
  return {
    header: String(question?.header || ""),
    question: String(question?.question || ""),
    options: Array.isArray(question?.options) ? question.options.map((option) => ({
      label: String(option?.label || ""),
      description: String(option?.description || ""),
      preview: String(option?.preview || ""),
      image: String(option?.image || ""),
    })) : [],
    multi_select: Boolean(question?.multi_select ?? question?.multiSelect),
    allow_custom: question?.allow_custom !== false && question?.allowCustom !== false,
  };
}

function prepareQuestionBatch(rawArgs) {
  let parsed;
  try {
    parsed = JSON.parse(String(rawArgs || "{}"));
  } catch {
    pendingQuestionBatch = null;
    return;
  }
  const questions = Array.isArray(parsed?.questions)
    ? parsed.questions.map(normalizeQuestionSpec).filter((question) => question.question)
    : [];
  if (questions.length <= 1) {
    pendingQuestionBatch = null;
    return;
  }
  pendingQuestionBatch = {
    id: ++questionBatchSeq,
    questions,
    answers: questions.map(() => ({ selected: [], custom: "" })),
    current: 0,
    serverQuestions: [],
    received: 0,
    sent: 0,
    sending: false,
    committing: false,
    overlay: null,
    panel: null,
  };
}

function clearQuestionBatch() {
  const batch = pendingQuestionBatch;
  pendingQuestionBatch = null;
  if (batch?.overlay && activeQuestionOverlay === batch.overlay) closeQuestion(batch.overlay);
}

function questionAnswerFromPanel(panel) {
  const selected = [...panel.querySelectorAll('input[name="question-choice"]:checked')]
    .filter((input) => input.dataset.customChoice !== "1")
    .map((input) => input.value);
  const customInput = panel.querySelector('.question-choice-custom[data-custom-choice="1"]');
  const customField = panel.querySelector(".question-custom");
  const customEnabled = customInput ? customInput.checked : Boolean(customField);
  const custom = customEnabled ? (customField?.value.trim() || "") : "";
  return { selected, custom };
}

function questionAnswerValid(answer) {
  return Boolean(answer && (answer.selected.length || answer.custom));
}

function questionAnswerText(answer) {
  if (answer?.cancelled) return "Anulowano";
  const picked = Array.isArray(answer?.selected) ? answer.selected.filter(Boolean) : [];
  const custom = String(answer?.custom || "").trim();
  if (picked.length && custom) return [...picked, custom].join(", ");
  if (picked.length) return picked.join(", ");
  return custom || "Brak odpowiedzi";
}

function parseStoredQuestionAnswers(text, count) {
  const source = String(text || "");
  if (/^error:/i.test(source.trim())) return [];
  const answers = [];
  const re = /user\s+(?:selected|answered):\s*([^\r\n]+)/gi;
  let match;
  while ((match = re.exec(source))) {
    answers.push({ selected: [match[1].trim()], custom: "", cancelled: false });
  }
  while (answers.length < count) answers.push({ selected: [], custom: "", cancelled: false });
  return answers.slice(0, count);
}

function finishQuestionNode(node) {
  if (activeQuestionOverlay === node) {
    activeQuestionOverlay = null;
    notifyQuestionPending();
  }
}

function renderQuestionReceipt(node, questions, answers) {
  if (!node) return;
  node.classList.add("answered");
  node.replaceChildren();
  const panel = document.createElement("div");
  panel.className = "question-panel question-receipt-panel";
  const kicker = document.createElement("div");
  kicker.className = "question-kicker";
  kicker.textContent = "Odpowiedziano";
  panel.appendChild(kicker);
  questions.forEach((spec, index) => {
    const item = document.createElement("div");
    item.className = "question-receipt-item";
    const question = document.createElement("div");
    question.className = "question-receipt-question";
    question.textContent = spec.question || "Pytanie od agenta";
    const answer = document.createElement("div");
    answer.className = "question-receipt-answer";
    answer.textContent = `✓ ${questionAnswerText(answers[index])}`;
    item.append(question, answer);
    panel.appendChild(item);
  });
  node.appendChild(panel);
  finishQuestionNode(node);
}

function renderStoredQuestion(toolCall, resultText, conversation) {
  if (!toolCall || toolCall.name !== "ask_user" || !conversation) return false;
  let parsed;
  try {
    parsed = JSON.parse(String(toolCall.arguments || "{}"));
  } catch {
    return false;
  }
  const questions = Array.isArray(parsed?.questions)
    ? parsed.questions.map(normalizeQuestionSpec).filter((item) => item.question)
    : [normalizeQuestionSpec(parsed)].filter((item) => item.question);
  if (!questions.length) return false;
  const answers = parseStoredQuestionAnswers(resultText, questions.length);
  if (!answers.length) return false;
  const node = document.createElement("div");
  node.className = "question-overlay question-inline answered history";
  conversation.appendChild(node);
  renderQuestionReceipt(node, questions, answers);
  return true;
}

function appendQuestionChoices(panel, spec, answer) {
  const options = document.createElement("div");
  options.className = "question-options";
  for (const option of spec.options || []) {
    const choice = document.createElement("label");
    choice.className = "question-option";
    const input = document.createElement("input");
    input.type = spec.multi_select ? "checkbox" : "radio";
    input.name = "question-choice";
    input.value = option.label || "";
    input.checked = answer.selected.includes(input.value);
    const copy = document.createElement("span");
    copy.className = "question-option-copy";
    const label = document.createElement("strong");
    label.textContent = option.label || "Opcja";
    copy.appendChild(label);
    if (option.description) {
      const description = document.createElement("span");
      description.className = "question-option-desc";
      description.textContent = option.description;
      copy.appendChild(description);
    }
    if (option.preview) {
      const preview = document.createElement("span");
      preview.className = "question-option-preview";
      preview.textContent = option.preview;
      copy.appendChild(preview);
    }
    if (option.image) {
      const image = document.createElement("img");
      image.className = "question-option-image";
      image.src = option.image;
      image.alt = option.label || "Podgląd";
      copy.appendChild(image);
    }
    choice.append(input, copy);
    options.appendChild(choice);
  }

  const allowCustom = spec.allow_custom !== false || !options.childElementCount;
  if (allowCustom) {
    const customChoice = document.createElement("div");
    customChoice.className = "question-option question-custom-option";
    const customToggle = document.createElement("input");
    customToggle.type = spec.multi_select ? "checkbox" : "radio";
    customToggle.name = "question-choice";
    customToggle.value = "__custom__";
    customToggle.dataset.customChoice = "1";
    customToggle.className = "question-choice-custom";
    customToggle.checked = Boolean(answer.custom);

    const copy = document.createElement("span");
    copy.className = "question-option-copy";
    const label = document.createElement("strong");
    label.textContent = "Własna odpowiedź";
    const custom = document.createElement("textarea");
    custom.className = "question-custom";
    custom.rows = 3;
    custom.value = answer.custom || "";
    custom.placeholder = "Wpisz własną odpowiedź…";

    custom.addEventListener("input", () => {
      if (custom.value.trim()) customToggle.checked = true;
    });
    custom.addEventListener("focus", () => {
      if (custom.value.trim()) customToggle.checked = true;
    });
    customToggle.addEventListener("change", () => {
      if (customToggle.checked) custom.focus();
    });
    customChoice.addEventListener("click", (event) => {
      if (event.target === customToggle || event.target === custom) return;
      customToggle.checked = true;
      custom.focus();
    });

    copy.append(label, custom);
    customChoice.append(customToggle, copy);
    options.appendChild(customChoice);
  }

  if (options.childElementCount) panel.appendChild(options);
}

function renderQuestionBatchStep(batch, message = "") {
  const panel = batch.panel;
  if (!panel) return;
  panel.replaceChildren();
  const index = batch.current;
  const spec = batch.questions[index];
  const answer = batch.answers[index];

  const head = document.createElement("div");
  head.className = "question-progress";
  const kicker = document.createElement("div");
  kicker.className = "question-kicker";
  kicker.textContent = spec.header || "Pytanie od agenta";
  const counter = document.createElement("span");
  counter.textContent = `Pytanie ${index + 1} z ${batch.questions.length}`;
  head.append(kicker, counter);
  const heading = document.createElement("h2");
  heading.className = "question-text";
  heading.textContent = spec.question || "Wybierz odpowiedź";
  panel.append(head, heading);

  appendQuestionChoices(panel, spec, answer);

  const error = document.createElement("div");
  error.className = "question-error";
  error.textContent = message;
  const actions = document.createElement("div");
  actions.className = "question-actions question-actions-spread";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "question-cancel";
  cancel.textContent = "Anuluj";
  const nav = document.createElement("div");
  nav.className = "question-nav";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "question-cancel";
  back.textContent = "Wstecz";
  back.hidden = index === 0;
  const next = document.createElement("button");
  next.type = "button";
  next.className = "question-submit";
  next.textContent = index === batch.questions.length - 1 ? "Odpowiedz" : "Dalej";
  nav.append(back, next);
  actions.append(cancel, nav);
  panel.append(error, actions);

  const saveCurrent = () => {
    batch.answers[index] = questionAnswerFromPanel(panel);
    return batch.answers[index];
  };

  back.addEventListener("click", () => {
    saveCurrent();
    batch.current = Math.max(0, index - 1);
    renderQuestionBatchStep(batch);
  });
  next.addEventListener("click", () => {
    const currentAnswer = saveCurrent();
    if (!questionAnswerValid(currentAnswer)) {
      error.textContent = "Wybierz opcję albo wpisz własną odpowiedź.";
      return;
    }
    if (index < batch.questions.length - 1) {
      batch.current = index + 1;
      renderQuestionBatchStep(batch);
      return;
    }
    const missing = batch.answers.findIndex((item) => !questionAnswerValid(item));
    if (missing >= 0) {
      batch.current = missing;
      renderQuestionBatchStep(batch, "To pytanie wymaga odpowiedzi.");
      return;
    }
    batch.committing = true;
    renderQuestionBatchSending(batch);
    flushQuestionBatch(batch);
  });
  cancel.addEventListener("click", async () => {
    const active = batch.serverQuestions[batch.sent];
    if (!active?.id) {
      closeQuestion(batch.overlay);
      clearQuestionBatch();
      return;
    }
    cancel.disabled = true;
    try {
      await postQuestionAnswer(active.id, { selected: [], custom: "", cancelled: true });
    } finally {
      closeQuestion(batch.overlay);
      clearQuestionBatch();
    }
  });

  setTimeout(() => {
    const first = panel.querySelector('input[name="question-choice"]') || panel.querySelector(".question-custom");
    first?.focus();
  }, 0);
}

function renderQuestionBatchSending(batch, message = "") {
  const panel = batch.panel;
  if (!panel) return;
  panel.replaceChildren();
  const progress = document.createElement("div");
  progress.className = "question-progress";
  const kicker = document.createElement("div");
  kicker.className = "question-kicker";
  kicker.textContent = "Odpowiedzi gotowe";
  const counter = document.createElement("span");
  counter.textContent = `${Math.min(batch.sent + 1, batch.questions.length)} z ${batch.questions.length}`;
  progress.append(kicker, counter);
  const heading = document.createElement("h2");
  heading.className = "question-text";
  heading.textContent = message || "Przekazuję odpowiedzi agentowi…";
  const note = document.createElement("p");
  note.className = "question-sending-note";
  note.textContent = "NestCafe wysyła zebrane odpowiedzi po kolei. Nie musisz już nic klikać.";
  panel.append(progress, heading, note);
}

async function postQuestionAnswer(id, answer) {
  const response = await fetch("/api/question/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, selected: answer.selected || [], custom: answer.custom || "", cancelled: Boolean(answer.cancelled) }),
  });
  if (!response.ok) {
    const error = new Error((await response.text()).trim() || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
}

function expireQuestion(node, batch = null) {
  if (batch && pendingQuestionBatch === batch) pendingQuestionBatch = null;
  closeQuestion(node);
  window.NestCafe?.toast?.("To pytanie już wygasło. Możesz normalnie pisać dalej.");
}

async function flushQuestionBatch(batch) {
  if (!batch.committing || batch.sending || pendingQuestionBatch !== batch) return;
  if (batch.sent >= batch.questions.length) {
    renderQuestionReceipt(batch.overlay, batch.questions, batch.answers);
    if (pendingQuestionBatch === batch) pendingQuestionBatch = null;
    return;
  }
  const serverQuestion = batch.serverQuestions[batch.sent];
  if (!serverQuestion?.id) return;

  batch.sending = true;
  renderQuestionBatchSending(batch);
  try {
    await postQuestionAnswer(serverQuestion.id, batch.answers[batch.sent]);
    batch.sent++;
    batch.sending = false;
    if (batch.sent >= batch.questions.length) {
      renderQuestionReceipt(batch.overlay, batch.questions, batch.answers);
      if (pendingQuestionBatch === batch) pendingQuestionBatch = null;
      return;
    }
    renderQuestionBatchSending(batch);
    flushQuestionBatch(batch);
  } catch (err) {
    batch.sending = false;
    if (err?.status === 410) {
      expireQuestion(batch.overlay, batch);
      return;
    }
    batch.committing = false;
    batch.current = Math.min(batch.sent, batch.questions.length - 1);
    renderQuestionBatchStep(batch, err.message || "Nie udało się wysłać odpowiedzi. Spróbuj ponownie.");
  }
}

function mountQuestionSurface(surface) {
  const conversation = document.querySelector("#conversation");
  if (!conversation) {
    document.body.appendChild(surface);
    surface.scrollIntoView?.({ block: "nearest" });
    return;
  }
  conversation.appendChild(surface);
  // ask_user blocks the normal composer until the user answers. Always bring
  // the inline question into view, even if the user had scrolled up to inspect
  // older output; otherwise the UI says "Odpowiedz wyżej" while the actual
  // question can sit unseen below the viewport.
  requestAnimationFrame(() => surface.scrollIntoView({ block: "nearest", behavior: "smooth" }));
}

function showQuestionBatch(question) {
  const batch = pendingQuestionBatch;
  if (!batch || !question?.id) return false;
  const index = batch.received++;
  if (index >= batch.questions.length) return false;
  batch.serverQuestions[index] = question;
  // The first live wire question may contain server-resolved preview URLs.
  // Keep the batch ordering from the original tool call, but prefer those
  // resolved presentation fields when they are available.
  batch.questions[index] = { ...batch.questions[index], ...normalizeQuestionSpec(question) };

  if (!batch.overlay) {
    closeQuestion();
    const overlay = document.createElement("div");
    overlay.className = "question-overlay";
    overlay.dataset.questionBatch = String(batch.id);
    const panel = document.createElement("form");
    panel.className = "question-panel";
    panel.addEventListener("submit", (event) => event.preventDefault());
    overlay.appendChild(panel);
    mountQuestionSurface(overlay);
    activeQuestionOverlay = overlay;
    notifyQuestionPending();
    batch.overlay = overlay;
    batch.panel = panel;
    renderQuestionBatchStep(batch);
  }

  if (batch.committing) flushQuestionBatch(batch);
  return true;
}

function showQuestion(question) {
  if (!question?.id) return;
  if (showQuestionBatch(question)) return;
  closeQuestion();

  const overlay = document.createElement("div");
  overlay.className = "question-overlay";
  const panel = document.createElement("form");
  panel.className = "question-panel";

  const kicker = document.createElement("div");
  kicker.className = "question-kicker";
  kicker.textContent = question.header || "Pytanie od agenta";
  const heading = document.createElement("h2");
  heading.className = "question-text";
  heading.textContent = question.question || "Wybierz odpowiedź";
  panel.append(kicker, heading);
  appendQuestionChoices(panel, normalizeQuestionSpec(question), { selected: [], custom: "" });

  const error = document.createElement("div");
  error.className = "question-error";
  const actions = document.createElement("div");
  actions.className = "question-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "question-cancel";
  cancel.textContent = "Anuluj";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "question-submit";
  submit.textContent = "Odpowiedz";
  actions.append(cancel, submit);
  panel.append(error, actions);
  overlay.appendChild(panel);
  mountQuestionSurface(overlay);
  activeQuestionOverlay = overlay;
  notifyQuestionPending();

  async function answer(cancelled) {
    const answerData = questionAnswerFromPanel(panel);
    if (!cancelled && !questionAnswerValid(answerData)) {
      error.textContent = "Wybierz opcję albo wpisz własną odpowiedź.";
      return;
    }
    submit.disabled = true;
    cancel.disabled = true;
    error.textContent = "";
    try {
      const completed = { ...answerData, cancelled };
      await postQuestionAnswer(question.id, completed);
      renderQuestionReceipt(overlay, [normalizeQuestionSpec(question)], [completed]);
    } catch (err) {
      if (err?.status === 410) {
        expireQuestion(overlay);
        return;
      }
      error.textContent = err.message || "Nie udało się wysłać odpowiedzi.";
      submit.disabled = false;
      cancel.disabled = false;
    }
  }

  panel.addEventListener("submit", (event) => {
    event.preventDefault();
    answer(false);
  });
  cancel.addEventListener("click", () => answer(true));
  setTimeout(() => {
    const first = panel.querySelector('input[name="question-choice"]') || panel.querySelector(".question-custom");
    first?.focus();
  }, 0);
}

function addFileChanges(changes, conversation) {
  const summary = document.createElement("details");
  summary.className = "file-change-summary";

  const heading = document.createElement("summary");
  const mark = document.createElement("span");
  mark.className = "file-change-mark";
  mark.textContent = "✓";
  const title = document.createElement("strong");
  title.textContent = changes.length === 1 ? "1 zmiana w pliku" : `${changes.length} zmiany w plikach`;
  const hint = document.createElement("span");
  hint.className = "file-change-hint";
  hint.textContent = "Szczegóły";
  heading.append(mark, title, hint);

  const list = document.createElement("div");
  list.className = "file-change-list";
  const labels = { created: "Utworzono", modified: "Zmodyfikowano", deleted: "Usunięto" };
  for (const change of changes) {
    const item = document.createElement("div");
    item.className = `file-change-item ${change.kind}`;
    const kind = document.createElement("span");
    kind.textContent = labels[change.kind] || labels.modified;
    const path = document.createElement("code");
    path.textContent = change.path;
    path.title = change.path;
    item.append(kind, path);
    list.appendChild(item);
  }
  summary.append(heading, list);
  conversation.appendChild(summary);
}

const chatApi = {
  appendMessage,
  finalizeMessage,
  createMessage,
  enableRewind,
  createActivity,
  completeActivity,
  showQuestion,
  renderStoredQuestion,
  closeQuestion,
  prepareQuestionBatch,
  clearQuestionBatch,
  addFileChanges,
};

window.NestCafe.export("chat", chatApi);
