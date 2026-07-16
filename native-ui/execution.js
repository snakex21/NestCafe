"use strict";

const toolLabels = {
  read_lines: "Odczyt pliku",
  read_many: "Odczyt plików",
  list_dir: "Lista folderu",
  search_code: "Wyszukiwanie w kodzie",
  ctx_execute: "Polecenie",
  write_file: "Zapis pliku",
  edit_line: "Edycja pliku",
  edit_docx: "Edycja dokumentu Word",
  edit_xlsx: "Edycja arkusza",
  web_lookup: "Wyszukiwanie w sieci",
  web_fetch: "Odczyt strony",
  task: "Delegowane zadanie",
};

function executionTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function compactHint(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  try {
    const args = JSON.parse(text);
    return args.path || args.file || args.command || args.query || args.reads || text;
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

function renderTextBlock(host, text) {
  const lines = String(text).replace(/<\/?(?:thinking|think)>/gi, "").split(/\r?\n/);
  let list = null;
  let code = null;
  for (const line of lines) {
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

window.finalizeNestCafeMessage = (container) => {
  if (!container || container.dataset.formatted === "true") return;
  const raw = container.textContent || "";
  container.dataset.formatted = "true";
  container.replaceChildren();
  const pattern = /<(?:thinking|think)>([\s\S]*?)<\/(?:thinking|think)>/gi;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(raw))) {
    renderTextBlock(container, raw.slice(cursor, match.index));
    const thinking = document.createElement("details");
    thinking.className = "thinking-block";
    thinking.innerHTML = `<summary>Myślenie</summary><pre></pre>`;
    thinking.querySelector("pre").textContent = match[1].trim();
    container.appendChild(thinking);
    cursor = pattern.lastIndex;
  }
  renderTextBlock(container, raw.slice(cursor));
};

window.createNestCafeMessage = (role, text, conversation) => {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = role === "user" ? "Ty" : "NestCafe";
  const body = document.createElement("div");
  body.className = "message-body";
  const content = document.createElement("div");
  content.className = "message-content";
  content.textContent = text || "";
  const time = document.createElement("time");
  time.className = "message-time";
  time.textContent = executionTime();
  body.append(content, time);
  article.append(label, body);
  conversation.appendChild(article);
  if (role === "assistant" && text) window.finalizeNestCafeMessage(content);
  return content;
};

window.createNestCafeActivity = (label, detail, id, conversation) => {
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
  row.innerHTML = `<summary><span class="tool-icon">⌁</span><strong></strong><span class="tool-hint"></span><small>W toku</small></summary><div class="tool-body"><label>Dane wejściowe</label><pre></pre></div>`;
  row.querySelector("strong").textContent = toolLabels[label] || label;
  row.querySelector(".tool-hint").textContent = compactHint(detail);
  row.querySelector(".tool-body pre").textContent = detail || "";
  row._clock = setInterval(() => {
    row.querySelector("small").textContent = `W toku · ${((performance.now() - row._started) / 1000).toFixed(1)}s`;
  }, 250);
  conversation.appendChild(row);
  return row;
};

window.completeNestCafeActivity = (row, event) => {
  clearInterval(row._clock);
  row.classList.remove("running");
  row.classList.add(event.err ? "error" : "done");
  const elapsed = row._started ? `${((performance.now() - row._started) / 1000).toFixed(1)}s` : "gotowe";
  const stat = row.querySelector("small");
  if (stat) stat.textContent = event.err ? `Błąd · ${elapsed}` : `Gotowe · ${elapsed}`;
  const body = row.querySelector(".tool-body");
  if (body) {
    const label = document.createElement("label");
    label.textContent = event.err ? "Błąd" : "Wynik";
    const output = document.createElement("pre");
    output.className = event.err ? "error" : "";
    output.textContent = event.err || event.output || "Gotowe";
    body.append(label, output);
  }
};
