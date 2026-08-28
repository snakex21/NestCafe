"use strict";

const superCliUI = window.SuperCliUI;
const $ = (selector) => document.querySelector(selector);
const conversation = $("#conversation");
const promptInput = $("#prompt");
const form = $("#composer");
const sendButton = $("#send-button");
const stopButton = $("#stop-button");
const attachButton = $("#attach-button");
const runState = $("#run-state");
const title = $("#conversation-title");
const sessionList = $("#session-list");
const toolRows = new Map();
const questionToolIDs = new Set();
const welcomeHTML = conversation.innerHTML;

let activeSession = "";
let running = false;
let liveTurnAppend = false;
let questionPending = false;
let abortController = null;
let pendingImmediateTask = null;
let followConversation = true;
let conversationScrollFrame = null;
let conversationScrollForced = false;
const liveConversationResizeObserver = typeof ResizeObserver === "function"
  ? new ResizeObserver(() => scrollConversation())
  : null;
let activeWorkspace = "";
const defaultPromptPlaceholder = promptInput.getAttribute("placeholder") || "Wiadomość lub polecenie…";

function scrollConversation(force = false) {
  if (force) {
    followConversation = true;
    conversationScrollForced = true;
  }
  if ((!followConversation && !conversationScrollForced) || conversationScrollFrame !== null) return;
  conversationScrollFrame = requestAnimationFrame(() => {
    conversationScrollFrame = null;
    if (conversationScrollForced || followConversation) conversation.scrollTop = conversation.scrollHeight;
    conversationScrollForced = false;
  });
}

conversation.addEventListener("scroll", () => {
  const distance = conversation.scrollHeight - conversation.scrollTop - conversation.clientHeight;
  followConversation = distance < 72;
}, { passive: true });

// Markdown is rendered on a timer so its height changes after the SSE callback
// returns. Follow that actual paint instead of measuring the old height.
conversation.addEventListener("nestcafe:message-rendered", () => scrollConversation());

// SSE events are not the only thing that can grow the current turn. Markdown
// layout, image decoding and expanded tool output can change its height after
// the event callback has already finished. Observe only nodes from the live
// turn, not the whole historical transcript, so following the tail stays
// reliable without making long conversations expensive.
function observeLiveConversationNode(node) {
  if (node && liveConversationResizeObserver) liveConversationResizeObserver.observe(node);
}

function resetLiveConversationObserver() {
  liveConversationResizeObserver?.disconnect();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 4200);
}

window.NestCafe.export("toast", showToast);

async function json(path, options) {
  return superCliUI.requestJSON(path, options);
}

const SESSION_TITLE_KEY = "nestcafe.session-title-overrides";
const composerDraftStore = superCliUI.createComposerDraftStore({
  storageKey: "nestcafe-composer-drafts-v1",
  input: promptInput,
  getScope: () => activeSession ? `session:${activeSession}` : `new:${activeWorkspace || "default"}`,
  onRestore: () => {
    promptInput.style.height = "auto";
    promptInput.style.height = `${Math.min(promptInput.scrollHeight, 180)}px`;
  },
});

function readSessionTitleOverrides() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_TITLE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function cleanSessionTitleText(text) {
  return String(text || "")
    .replace(/\s*\u{1F4CE}\s*[^\r\n]*$/u, "")
    .trim();
}

function sessionDisplayTitle(session) {
  const overrides = readSessionTitleOverrides();
  const custom = String(overrides[session?.id] || "").trim();
  if (custom) return custom;
  return cleanSessionTitleText(session?.first_user_msg) || "Rozmowa";
}

function saveSessionTitle(sessionID, value) {
  const overrides = readSessionTitleOverrides();
  const titleValue = String(value || "").trim();
  if (titleValue) overrides[sessionID] = titleValue;
  else delete overrides[sessionID];
  localStorage.setItem(SESSION_TITLE_KEY, JSON.stringify(overrides));
}

function removeSessionTitle(sessionID) {
  const overrides = readSessionTitleOverrides();
  if (!(sessionID in overrides)) return;
  delete overrides[sessionID];
  localStorage.setItem(SESSION_TITLE_KEY, JSON.stringify(overrides));
}

function clearSessionTitles() {
  localStorage.removeItem(SESSION_TITLE_KEY);
}

window.NestCafe.export("sessionTitle", sessionDisplayTitle);
window.NestCafe.export("clearSessionTitles", clearSessionTitles);

function updateComposerState() {
  promptInput.disabled = questionPending;
  if (attachButton) attachButton.disabled = questionPending;
  sendButton.disabled = questionPending;
  sendButton.textContent = questionPending ? "Odpowiedz wyżej" : (running ? "Dodaj do kolejki" : "Wyślij");
  sendButton.classList.toggle("queue-mode", running && !questionPending);
  form.classList.toggle("question-pending", questionPending);
  promptInput.placeholder = questionPending ? "Odpowiedz na pytanie powyżej…" : defaultPromptPlaceholder;
}

function setQuestionPending(value) {
  questionPending = Boolean(value);
  updateComposerState();
  if (!questionPending && document.activeElement !== promptInput) promptInput.focus();
}

window.addEventListener("nestcafe:question-pending", (event) => {
  setQuestionPending(Boolean(event.detail?.pending));
});

function setRunning(value) {
  running = value;
  stopButton.hidden = !value;
  document.body.classList.toggle("running-state", value);
  runState.textContent = value ? "W toku" : "Gotowy";
  updateComposerState();
}

function clearWelcome() {
  const welcome = $("#welcome");
  if (welcome) welcome.remove();
  document.body.classList.remove("empty-state");
}

function chat() {
  return window.NestCafe?.chat || {};
}

function clearPendingQuestion() {
  questionToolIDs.clear();
  chat().clearQuestionBatch?.();
  chat().closeQuestion?.();
  setQuestionPending(false);
}

function interruptWithQueuedTask(task) {
  if (!task?.id) return;
  pendingImmediateTask = { ...task };
  clearPendingQuestion();
  if (running && abortController) {
    showToast("Przerywam bieżące zadanie i uruchomię wybraną wiadomość z kolejki.");
    abortController.abort();
    return;
  }
  const immediate = pendingImmediateTask;
  pendingImmediateTask = null;
  setTimeout(() => window.NestCafe?.plan?.runScheduled?.(immediate, immediate.prompt), 0);
}

function addMessage(role, text, seq = 0, attachments = []) {
  clearWelcome();
  const body = chat().createMessage(role, text, conversation, seq, attachments);
  if (liveTurnAppend) {
    const message = body?.closest?.(".message");
    message?.classList.add("live-turn");
    observeLiveConversationNode(message);
  }
  scrollConversation();
  return body;
}

function addActivity(label, detail, id) {
  clearWelcome();
  const row = chat().createActivity(label, detail, id, conversation);
  if (liveTurnAppend) {
    row?.classList?.add("live-turn");
    observeLiveConversationNode(row);
  }
  if (id) toolRows.set(id, row);
  scrollConversation();
  return row;
}

function addFileChanges(changes) {
  const normalized = superCliUI.normalizeFileChanges(changes);
  if (!normalized.length) return;
  clearWelcome();
  chat().addFileChanges?.(normalized, conversation);
  scrollConversation();
}

function handleEvent(event, current) {
  if (event.type === "session") {
    activeSession = event.session_id || activeSession;
  } else if (event.type === "message") {
    current = current || addMessage("assistant", "");
    if (chat().appendMessage) chat().appendMessage(current, event.text || "");
    else current.textContent += event.text || "";
  } else if (event.type === "tool_call") {
    chat().finalizeMessage?.(current);
    if (event.name === "ask_user") {
      if (event.id) questionToolIDs.add(event.id);
      chat().prepareQuestionBatch?.(event.args || "");
    } else {
      const row = addActivity(event.name || "Narzędzie", event.args || "", event.id);
      row.dataset.toolName = event.name || "";
      row.dataset.toolArgs = event.args || "";
    }
    current = null;
  } else if (event.type === "tool_result") {
    if (questionToolIDs.has(event.id)) {
      questionToolIDs.delete(event.id);
      chat().clearQuestionBatch?.();
    } else {
      const row = toolRows.get(event.id) || addActivity("Wynik narzędzia", "", event.id);
      chat().completeActivity(row, event);
      chat().enhanceToolResult?.(row, event);
    }
  } else if (event.type === "file_changes") {
    addFileChanges(event.file_changes);
  } else if (event.type === "worker" || event.type === "worker_progress") {
    addActivity(`Delegacja · ${event.name || "worker"}`, event.output || event.tool || event.status || "");
  } else if (event.type === "notice" || event.type === "compact" || event.type === "reflection") {
    addActivity(event.type === "compact" ? "Porządkowanie kontekstu" : "Informacja", event.text || "").classList.add("info-line");
  } else if (event.type === "question") {
    if (chat().showQuestion) chat().showQuestion(event.question);
    else addActivity("Pytanie od agenta", event.question?.question || "Odpowiedź wymaga interfejsu pytań.");
  } else if (event.type === "done") {
    chat().finalizeMessage?.(current);
    clearPendingQuestion();
    addFileChanges(event.file_changes);
    const formatTokens = (value) => new Intl.NumberFormat("pl-PL").format(value || 0);
    const cached = event.tok_cached ? ` · cache ${formatTokens(event.tok_cached)}` : "";
    addActivity("✓ Ukończono", `${formatTokens(event.tok_total)} tokenów${cached}`).classList.add("completion-line");
    window.NestCafe?.appearance?.notifyTaskComplete?.(
      "NestCafe zakończyło zadanie",
      title.textContent || "Zadanie zostało ukończone.",
    );
    current = null;
  } else if (event.type === "error") {
    chat().finalizeMessage?.(current);
    clearPendingQuestion();
    addFileChanges(event.file_changes);
    addActivity("Błąd", event.err || "Nieznany błąd").classList.add("error");
  }
  scrollConversation();
  return current;
}

async function sendPrompt(text, attachments = [], draft = null) {
  const prompt = String(text || "").trim();
  const sentAttachments = [...(attachments || [])];
  if (running || (!prompt && !sentAttachments.length)) return;

  // A question belongs to the run that created it. Never let a stale panel
  // survive into a newer run and keep the composer locked.
  clearPendingQuestion();
  resetLiveConversationObserver();
  followConversation = true;
  liveTurnAppend = true;
  const userMessage = addMessage("user", prompt || " ");
  scrollConversation(true);
  if (sentAttachments.length) {
    window.NestCafe?.attachments?.renderSent?.(userMessage, sentAttachments);
  }
  if (!activeSession) {
    title.textContent = (prompt || "Nowa rozmowa").slice(0, 56);
  }
  setRunning(true);
  abortController = new AbortController();
  let current = null;
  let draftAccepted = false;
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt || "Opisz załączone pliki.",
        session_id: activeSession,
        attachments: sentAttachments,
      }),
      signal: abortController.signal,
    });
    if (!response.ok || !response.body) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
    draftAccepted = true;
    if (draft) composerDraftStore.clear(draft.scope, draft.text);
    window.NestCafe?.attachments?.clear?.();
    await superCliUI.readSSE(response.body, (event) => {
      current = handleEvent(event, current);
    });
  } catch (error) {
    if (error.name !== "AbortError") {
      addActivity("Połączenie", error.message).classList.add("error");
      showToast(error.message);
    }
  } finally {
    if (draft && !draftAccepted && !promptInput.value && composerDraftStore.scope() === draft.scope) {
      composerDraftStore.restore(draft.scope);
    }
    // The backend can end/cancel a run while ask_user is still visible. Retire
    // that question before unlocking the next turn so the UI can never get
    // stuck on an answer endpoint that already returned HTTP 410.
    clearPendingQuestion();
    chat().finalizeMessage?.(current);
    setRunning(false);
    liveTurnAppend = false;
    resetLiveConversationObserver();
    conversation.querySelectorAll(".live-turn").forEach((node) => node.classList.remove("live-turn"));
    abortController = null;
    // Do NOT full-reload the conversation here — that wiped live image galleries.
    // Only refresh the session list and remember attachment paths for later opens.
    try {
      await loadSessions();
      // The live user bubble is created before the backend assigns its durable
      // transcript sequence number. Resolve that seq after EVERY turn, not only
      // turns with attachments, so "Cofnij" works immediately and consistently
      // without requiring the user to reopen the conversation first.
      if (activeSession) {
        const transcript = await json(`/api/transcript?id=${encodeURIComponent(activeSession)}`);
        const list = Array.isArray(transcript) ? transcript : transcript?.messages || [];
        let latestUserSeq = 0;
        for (const message of list) {
          if (message.role === "user" && Number(message.seq) > latestUserSeq) {
            latestUserSeq = Number(message.seq);
          }
        }
        if (latestUserSeq) {
          if (sentAttachments.length) {
            window.NestCafe?.attachments?.remember?.(activeSession, latestUserSeq, sentAttachments);
          }
          const liveMessage = userMessage?.closest?.(".message");
          chat().enableRewind?.(liveMessage, latestUserSeq, prompt, sentAttachments);
        }
      }
    } catch {
      // Non-fatal: the live turn already rendered.
    }
    const immediate = pendingImmediateTask;
    pendingImmediateTask = null;
    if (immediate) {
      setTimeout(() => window.NestCafe?.plan?.runScheduled?.(immediate, immediate.prompt), 0);
    } else {
      window.NestCafe?.plan?.onRunFinished?.();
    }
    promptInput.focus();
  }
}

function fileLabelFromAttachments(paths) {
  const names = (paths || []).map((path) => path.split(/[\\/]/).pop()).filter(Boolean);
  if (!names.length) return "Załączniki";
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

async function loadHealth() {
  try {
    const health = await json("/api/health");
    activeWorkspace = health.home || "";
    $("#status-dot").classList.add("online");
    $("#engine-label").textContent = "SuperCli połączone";
    $("#model-label").textContent = health.model || "Brak wybranego modelu";
    window.NestCafe?.attachments?.setWorkspace?.(health.home || "");
  } catch (error) {
    $("#engine-label").textContent = "Brak połączenia";
    $("#model-label").textContent = error.message;
  }
}

function makeSessionAction(symbol, label, className, handler) {
  const action = document.createElement("span");
  action.className = `session-action ${className}`;
  action.setAttribute("role", "button");
  action.tabIndex = 0;
  action.title = label;
  action.setAttribute("aria-label", label);
  action.textContent = symbol;
  const activate = (event) => {
    event.preventDefault();
    event.stopPropagation();
    handler();
  };
  action.addEventListener("click", activate);
  action.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") activate(event);
  });
  return action;
}

function renameSessionDialog(session) {
  const dialog = document.createElement("dialog");
  dialog.className = "confirm-dialog session-edit-dialog";
  const heading = document.createElement("h3");
  heading.textContent = "Edytuj nazwę rozmowy";
  const copy = document.createElement("p");
  copy.textContent = "Zmień nazwę widoczną w historii NestCafe.";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 120;
  input.value = sessionDisplayTitle(session);
  input.setAttribute("aria-label", "Nazwa rozmowy");
  const actions = document.createElement("div");
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "confirm-cancel";
  cancel.textContent = "Anuluj";
  const save = document.createElement("button");
  save.type = "button";
  save.className = "confirm-save";
  save.textContent = "Zapisz";
  cancel.addEventListener("click", () => dialog.close());
  const commit = async () => {
    const value = input.value.trim();
    if (!value) return input.focus();
    saveSessionTitle(session.id, value);
    window.NestCafe?.favorites?.updateTitle?.(session.id, value);
    if (activeSession === session.id) title.textContent = value;
    dialog.close();
    await loadSessions();
  };
  save.addEventListener("click", commit);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  });
  actions.append(cancel, save);
  dialog.append(heading, copy, input, actions);
  dialog.addEventListener("close", () => dialog.remove());
  document.body.appendChild(dialog);
  dialog.showModal();
  input.select();
}

function deleteSessionDialog(session) {
  const dialog = document.createElement("dialog");
  dialog.className = "confirm-dialog";
  dialog.innerHTML = `<h3>Usunąć rozmowę?</h3><p>Ta rozmowa zostanie trwale usunięta. Dokumenty i pliki na dysku nie zostaną zmienione.</p><div><button class="confirm-cancel" type="button">Anuluj</button><button class="confirm-delete" type="button">Usuń</button></div>`;
  const cancel = dialog.querySelector(".confirm-cancel");
  const confirm = dialog.querySelector(".confirm-delete");
  cancel.addEventListener("click", () => dialog.close());
  confirm.addEventListener("click", async () => {
    confirm.disabled = true;
    try {
      await json(`/api/sessions?id=${encodeURIComponent(session.id)}`, { method: "DELETE" });
      removeSessionTitle(session.id);
      window.NestCafe?.favorites?.remove?.(session.id);
      dialog.close();
      if (activeSession === session.id) newConversation();
      else await loadSessions();
    } catch (error) {
      showToast(error.message);
      confirm.disabled = false;
    }
  });
  dialog.addEventListener("close", () => dialog.remove());
  document.body.appendChild(dialog);
  dialog.showModal();
}

async function loadSessions() {
  try {
    const sessions = await json("/api/sessions?limit=30");
    $("#clear-sessions").hidden = false;
    sessionList.replaceChildren();
    for (const session of sessions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `session-item${session.id === activeSession ? " active" : ""}`;
      const dot = document.createElement("i");
      dot.className = "session-dot";
      const sessionTitle = sessionDisplayTitle(session);
      const name = window.NestCafe?.marquee?.create?.(sessionTitle, { tagName: "strong", className: "session-title" }) || document.createElement("strong");
      if (!name.textContent) name.textContent = sessionTitle;
      const meta = document.createElement("span");
      meta.className = "session-meta";
      meta.textContent = `${session.message_count || 0} wiadomości · ${session.model || "model"}`;
      button.append(dot, name, meta);
      window.NestCafe?.favorites?.decorateSession?.(button, session);
      button.append(
        makeSessionAction("✎", "Edytuj nazwę", "session-edit", () => renameSessionDialog(session)),
        makeSessionAction("×", "Usuń rozmowę", "session-delete", () => deleteSessionDialog(session)),
      );
      button.addEventListener("click", () => openSession(session));
      sessionList.appendChild(button);
    }
    return sessions;
  } catch (error) {
    showToast(`Nie udało się wczytać rozmów: ${error.message}`);
    return [];
  }
}

async function openSession(session, skipSessionReload = false) {
  if (running) return;
  try {
    const transcript = await json(`/api/transcript?id=${encodeURIComponent(session.id)}`);
    const messages = Array.isArray(transcript) ? transcript : transcript?.messages || [];
    activeSession = session.id;
    composerDraftStore.restore(`session:${session.id}`);
    resetLiveConversationObserver();
    followConversation = true;
    toolRows.clear();
    questionToolIDs.clear();
    chat().closeQuestion?.();
    document.body.classList.remove("empty-state");
    conversation.replaceChildren();
    title.textContent = sessionDisplayTitle(session);
    const questionResults = new Map(
      messages
        .filter((message) => message.role === "tool" && message.name === "ask_user" && message.tool_call_id)
        .map((message) => [message.tool_call_id, message.content || ""]),
    );
    for (const message of messages) {
      if (message.role === "user") {
        // createMessage restores remembered image galleries via session+seq.
        addMessage("user", message.content || "", message.seq || 0, message.attachments || []);
      } else if (message.role === "assistant") {
        const content = message.content || "";
        const assistantMessage = content.trim()
          ? addMessage("assistant", content, message.seq || 0, message.attachments || [])
          : null;
        for (const call of message.tool_calls || []) {
          if (call.name !== "ask_user") continue;
          const stored = questionResults.get(call.id);
          if (stored != null) chat().renderStoredQuestion?.(call, stored, conversation);
        }
        addFileChanges(message.turn?.file_changes);
      } else if (message.role === "tool") {
        if (message.name === "ask_user") continue;
        const row = addActivity(message.name || "Narzędzie", "", `history-${message.seq || Math.random()}`);
        row.dataset.toolName = message.name || "";
        chat().completeActivity(row, { output: message.content || "" });
      }
    }
    scrollConversation(true);
    if (!skipSessionReload) await loadSessions();
  } catch (error) {
    showToast(error.message);
  }
}

function rewindDialog(sessionID, seq, text, preview, messageAttachments = []) {
  const dialog = document.createElement("dialog");
  dialog.className = "nestcafe-rewind-dialog";
  const form = document.createElement("form");
  form.method = "dialog";
  const heading = document.createElement("h3");
  heading.textContent = "Cofnij rozmowę do tej wiadomości";
  const copy = document.createElement("p");
  copy.textContent = messageAttachments.length
    ? "Ta wiadomość i wszystkie późniejsze odpowiedzi zostaną trwale usunięte. Jej tekst i zdjęcia wrócą do pola pisania."
    : "Ta wiadomość i wszystkie późniejsze odpowiedzi zostaną trwale usunięte. Jej tekst wróci do pola pisania.";
  const reason = document.createElement("textarea");
  reason.maxLength = 400;
  reason.placeholder = "Opcjonalnie: co było nie tak?";
  let rewindFiles = null;
  if (preview?.available && preview.files?.length) {
    const option = document.createElement("label");
    rewindFiles = document.createElement("input");
    rewindFiles.type = "checkbox";
    const optionCopy = document.createElement("span");
    optionCopy.textContent = `Cofnij również zmiany w ${preview.files.length} pliku/plikach. Domyślnie pliki pozostają bez zmian.`;
    option.append(rewindFiles, optionCopy);
    form.append(heading, copy, reason, option);
  } else {
    form.append(heading, copy, reason);
  }
  const actions = document.createElement("div");
  actions.className = "nestcafe-rewind-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "settings-secondary-button";
  cancel.textContent = "Anuluj";
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = "settings-primary-button";
  confirm.textContent = "Cofnij";
  cancel.addEventListener("click", () => dialog.close());
  confirm.addEventListener("click", async () => {
    confirm.disabled = true;
    cancel.disabled = true;
    try {
      const result = await json("/api/session/rewind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionID,
          selected_seq: seq,
          rewind_files: Boolean(rewindFiles?.checked),
          reason: reason.value.trim(),
        }),
      });
      dialog.close();
      const sessions = await loadSessions();
      // Rewind must not depend on the conversation being present in the first
      // page of the sidebar. The backend has already committed the truncate, so
      // always reload this exact session id even if /api/sessions?limit=30 did
      // not return it (older conversation, transient ordering, etc.).
      const session = sessions.find((item) => item.id === sessionID) || {
        id: sessionID,
        first_user_msg: title.textContent || "Rozmowa",
      };
      await openSession(session, true);
      promptInput.value = text || "";
      promptInput.dispatchEvent(new Event("input"));
      const restoredAttachments =
        Array.isArray(result.attachments) && result.attachments.length
          ? result.attachments
          : messageAttachments;
      window.NestCafe?.attachments?.replace?.(restoredAttachments);
      window.NestCafe?.attachments?.forget?.(sessionID, seq);
      promptInput.focus();
      showToast(result.warning || "Rozmowa została cofnięta.");
    } catch (error) {
      showToast(error.message);
      confirm.disabled = false;
      cancel.disabled = false;
    }
  });
  actions.append(cancel, confirm);
  form.append(actions);
  dialog.append(form);
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  reason.focus();
}

async function rewindMessage(seq, text, trigger, messageAttachments = []) {
  if (!activeSession || !seq) return;
  if (running) {
    showToast("Poczekaj, aż bieżące zadanie się zakończy, zanim cofniesz wiadomość.");
    return;
  }
  trigger.disabled = true;
  let preview = null;
  try {
    preview = await json(`/api/checkpoint/rewind?session=${encodeURIComponent(activeSession)}&from_seq=${seq}`);
  } catch {
    // Conversation rewind remains available even when no file checkpoint exists.
  } finally {
    trigger.disabled = false;
  }
  rewindDialog(activeSession, seq, text, preview, messageAttachments);
}

async function resumeSessionByID(id) {
  const sessions = await json("/api/sessions?limit=100");
  const session = sessions.find((item) => item.id === id);
  if (!session) throw new Error("Nie znaleziono rozmowy powiązanej z zadaniem.");
  await openSession(session);
}

function newConversation() {
  if (running) return;
  activeSession = "";
  toolRows.clear();
  conversation.innerHTML = welcomeHTML;
  window.NestCafe?.favorites?.render?.();
  document.body.classList.add("empty-state");
  title.textContent = "Nowa rozmowa";
  window.NestCafe?.attachments?.clear?.();
  composerDraftStore.restore();
  loadSessions();
  promptInput.focus();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = promptInput.value;
  const draft = { scope: composerDraftStore.scope(), text };
  const pendingAttachments = window.NestCafe?.attachments?.list?.() || [];
  if (questionPending) {
    showToast("Najpierw odpowiedz na pytanie agenta powyżej.");
    return;
  }
  if (running) {
    if (pendingAttachments.length) {
      showToast("Załączniki można wysłać po zakończeniu bieżącego zadania.");
      return;
    }
    if (!text.trim()) return;
    promptInput.value = "";
    promptInput.style.height = "auto";
    if (await window.NestCafe?.plan?.enqueue?.(text)) composerDraftStore.clear(draft.scope, draft.text);
    else composerDraftStore.restore(draft.scope);
    return;
  }
  if (!text.trim() && !pendingAttachments.length) return;
  promptInput.value = "";
  promptInput.style.height = "auto";
  sendPrompt(text, pendingAttachments, draft);
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
$("#execution-back").addEventListener("click", newConversation);
$("#refresh-sessions").addEventListener("click", loadSessions);

Promise.all([loadHealth(), loadSessions()])
  .then(() => composerDraftStore.load())
  .finally(() => promptInput.focus());

window.NestCafe.export("refreshHealth", loadHealth);
window.NestCafe.export("startConversation", newConversation);
window.NestCafe.export("getSession", () => activeSession);
window.NestCafe.export("isRunning", () => running);
window.NestCafe.export("runPrompt", sendPrompt);
window.NestCafe.export("interruptWithQueuedTask", interruptWithQueuedTask);
window.NestCafe.export("resumeSession", resumeSessionByID);
window.NestCafe.export("rewindMessage", rewindMessage);
