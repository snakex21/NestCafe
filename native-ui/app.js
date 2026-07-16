"use strict";

const $ = (selector) => document.querySelector(selector);
const conversation = $("#conversation");
const promptInput = $("#prompt");
const form = $("#composer");
const sendButton = $("#send-button");
const stopButton = $("#stop-button");
const runState = $("#run-state");
const title = $("#conversation-title");
const sessionList = $("#session-list");
const toolRows = new Map();

let activeSession = "";
let running = false;
let abortController = null;

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 4200);
}

window.showNestCafeToast = showToast;

async function json(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
  return response.json();
}

function setRunning(value) {
  running = value;
  sendButton.textContent = value ? "Pracuję…" : "Wyślij";
  sendButton.disabled = value;
  stopButton.hidden = !value;
  runState.textContent = value ? "SuperCli pracuje" : "Gotowy";
}

function clearWelcome() {
  const welcome = $("#welcome");
  if (welcome) welcome.remove();
}

function addMessage(role, text) {
  clearWelcome();
  const article = document.createElement("article");
  article.className = `message ${role}`;
  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = role === "user" ? "Ty" : "NestCafe";
  const body = document.createElement("pre");
  body.className = "message-body";
  body.textContent = text || "";
  article.append(label, body);
  conversation.appendChild(article);
  conversation.scrollTop = conversation.scrollHeight;
  return body;
}

function addActivity(label, detail, id) {
  clearWelcome();
  const row = document.createElement("div");
  row.className = "activity";
  row.textContent = detail ? `${label} · ${detail}` : label;
  conversation.appendChild(row);
  if (id) toolRows.set(id, row);
  conversation.scrollTop = conversation.scrollHeight;
  return row;
}

function handleEvent(event, current) {
  if (event.type === "session") {
    activeSession = event.session_id || activeSession;
  } else if (event.type === "message") {
    current = current || addMessage("assistant", "");
    current.textContent += event.text || "";
  } else if (event.type === "tool_call") {
    addActivity(event.name || "Narzędzie", event.args || "", event.id);
  } else if (event.type === "tool_result") {
    const row = toolRows.get(event.id) || addActivity("Wynik narzędzia", "", event.id);
    row.classList.add(event.err ? "error" : "done");
    row.textContent = event.err || event.output || "Gotowe";
  } else if (event.type === "worker" || event.type === "worker_progress") {
    addActivity(`Delegacja · ${event.name || "worker"}`, event.output || event.tool || event.status || "");
  } else if (event.type === "notice" || event.type === "compact" || event.type === "reflection") {
    addActivity(event.type === "compact" ? "Porządkowanie kontekstu" : "Informacja", event.text || "");
  } else if (event.type === "question") {
    addActivity("Pytanie od agenta", event.question?.question || "Odpowiedź wymaga interfejsu pytań.");
  } else if (event.type === "done") {
    const cached = event.tok_cached ? ` · cache ${event.tok_cached}` : "";
    addActivity("Ukończono", `${event.tok_total || 0} tokenów${cached}`);
  } else if (event.type === "error") {
    addActivity("Błąd", event.err || "Nieznany błąd").classList.add("error");
  }
  conversation.scrollTop = conversation.scrollHeight;
  return current;
}

function processSseFrame(frame, current) {
  const line = frame.split(/\r?\n/).find((part) => part.startsWith("data:"));
  if (!line) return current;
  try {
    return handleEvent(JSON.parse(line.slice(5).trim()), current);
  } catch {
    return current;
  }
}

async function sendPrompt(text) {
  if (running || !text.trim()) return;
  addMessage("user", text.trim());
  title.textContent = text.trim().slice(0, 56);
  setRunning(true);
  abortController = new AbortController();
  let current = null;
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: text.trim(), session_id: activeSession }),
      signal: abortController.signal,
    });
    if (!response.ok || !response.body) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() || "";
      for (const frame of frames) current = processSseFrame(frame, current);
    }
    buffer += decoder.decode();
    if (buffer.trim()) processSseFrame(buffer, current);
  } catch (error) {
    if (error.name !== "AbortError") {
      addActivity("Połączenie", error.message).classList.add("error");
      showToast(error.message);
    }
  } finally {
    setRunning(false);
    abortController = null;
    await loadSessions();
    promptInput.focus();
  }
}

async function loadHealth() {
  try {
    const health = await json("/api/health");
    $("#status-dot").classList.add("online");
    $("#engine-label").textContent = "SuperCli połączone";
    $("#model-label").textContent = health.model || "Brak wybranego modelu";
  } catch (error) {
    $("#engine-label").textContent = "Brak połączenia";
    $("#model-label").textContent = error.message;
  }
}

async function loadSessions() {
  try {
    const sessions = await json("/api/sessions?limit=30");
    sessionList.replaceChildren();
    for (const session of sessions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `session-item${session.id === activeSession ? " active" : ""}`;
      const name = document.createElement("strong");
      name.textContent = session.first_user_msg || "Rozmowa";
      const meta = document.createElement("span");
      meta.textContent = `${session.message_count || 0} wiadomości · ${session.model || "model"}`;
      button.append(name, meta);
      button.addEventListener("click", () => openSession(session));
      sessionList.appendChild(button);
    }
  } catch (error) {
    showToast(`Nie udało się wczytać rozmów: ${error.message}`);
  }
}

async function openSession(session) {
  if (running) return;
  try {
    const messages = await json(`/api/transcript?id=${encodeURIComponent(session.id)}`);
    activeSession = session.id;
    conversation.replaceChildren();
    title.textContent = session.first_user_msg || "Rozmowa";
    for (const message of messages) {
      if (message.role === "user" || message.role === "assistant") {
        addMessage(message.role, message.content || "");
      } else if (message.role === "tool") {
        addActivity(message.name || "Narzędzie", message.content || "");
      }
    }
    await loadSessions();
  } catch (error) {
    showToast(error.message);
  }
}

function newConversation() {
  if (running) return;
  activeSession = "";
  toolRows.clear();
  conversation.innerHTML = `
    <div class="welcome" id="welcome">
      <span class="welcome-mark">N</span>
      <h2>W czym mogę dziś pomóc?</h2>
      <p>Napisz, co trzeba przygotować, sprawdzić lub uporządkować.</p>
    </div>`;
  title.textContent = "Dzień dobry";
  loadSessions();
  promptInput.focus();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = promptInput.value;
  promptInput.value = "";
  promptInput.style.height = "auto";
  sendPrompt(text);
});

promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

promptInput.addEventListener("input", () => {
  promptInput.style.height = "auto";
  promptInput.style.height = `${Math.min(promptInput.scrollHeight, 180)}px`;
});

stopButton.addEventListener("click", () => abortController?.abort());
$("#new-chat").addEventListener("click", newConversation);
$("#refresh-sessions").addEventListener("click", loadSessions);

Promise.all([loadHealth(), loadSessions()]).finally(() => promptInput.focus());
window.refreshNestCafeHealth = loadHealth;
