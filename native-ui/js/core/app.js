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
// True when the engine answered but reports no usable model (welcome shows a connect CTA).
let modelMissing = false;

let activeSession = "";
let running = false;
let liveTurnAppend = false;
let questionPending = false;
let abortController = null;
let pendingImmediateTask = null;
let runSequence = 0;
let navigationSequence = 0;
let followConversation = true;
let conversationScrollFrame = null;
let conversationScrollForced = false;
const liveConversationResizeObserver = typeof ResizeObserver === "function"
  ? new ResizeObserver(() => scrollConversation())
  : null;
let activeWorkspace = "";
const transcriptPageSize = 60;
let loadedTranscriptMessages = [];
let transcriptHasMore = false;
let transcriptBeforeSeq = 0;
let transcriptSessionID = "";
let transcriptAbortController = null;

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
  return cleanSessionTitleText(session?.first_user_msg) || t("app.session.untitled");
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
  sendButton.textContent = questionPending ? t("app.composer.answerAbove") : (running ? t("app.composer.addToQueue") : t("composer.send"));
  sendButton.classList.toggle("queue-mode", running && !questionPending);
  form.classList.toggle("question-pending", questionPending);
  promptInput.placeholder = questionPending ? t("app.composer.answerPlaceholder") : t("composer.prompt.placeholder");
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
  runState.textContent = value ? t("topbar.state.running") : t("topbar.state.ready");
  updateComposerState();
}

function syncWelcomeConnect() {
  const connect = conversation.querySelector?.("#welcome-connect");
  if (connect) connect.hidden = !modelMissing;
}

// The welcome block is re-created from welcomeHTML, so listen on the conversation.
conversation.addEventListener("click", (event) => {
  if (event.target?.closest?.(".welcome-connect-button")) $("#provider-button")?.click();
});

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
  chat().clearApprovals?.();
  setQuestionPending(false);
}

function interruptWithQueuedTask(task) {
  if (!task?.id) return;
  pendingImmediateTask = { ...task };
  clearPendingQuestion();
  if (running && abortController) {
    showToast(t("app.queue.interrupting"));
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
  } else if (event.type === "reasoning") {
    current = current || addMessage("assistant", "");
    if (chat().appendReasoning) chat().appendReasoning(current, event.text || "");
    else if (chat().appendMessage) chat().appendMessage(current, `<thinking>${event.text || ""}</thinking>\n`);
    else current.textContent += `<thinking>${event.text || ""}</thinking>\n`;
  } else if (event.type === "tool_call") {
    chat().finalizeMessage?.(current);
    if (event.name === "ask_user") {
      if (event.id) questionToolIDs.add(event.id);
      chat().prepareQuestionBatch?.(event.args || "");
    } else {
      const row = addActivity(event.name || t("app.activity.tool"), event.args || "", event.id);
      row.dataset.toolName = event.name || "";
      row.dataset.toolArgs = event.args || "";
    }
    current = null;
  } else if (event.type === "tool_result") {
    if (questionToolIDs.has(event.id)) {
      questionToolIDs.delete(event.id);
      chat().clearQuestionBatch?.();
    } else {
      const row = toolRows.get(event.id) || addActivity(t("app.activity.toolResult"), "", event.id);
      chat().completeActivity(row, event);
      chat().enhanceToolResult?.(row, event);
    }
  } else if (event.type === "file_changes") {
    addFileChanges(event.file_changes);
  } else if (event.type === "worker" || event.type === "worker_progress") {
    addActivity(t("app.activity.delegation", { name: event.name || "worker" }), event.output || event.tool || event.status || "");
  } else if (event.type === "notice" || event.type === "compact" || event.type === "reflection") {
    addActivity(event.type === "compact" ? t("app.activity.compact") : t("app.activity.info"), event.text || "").classList.add("info-line");
  } else if (event.type === "question") {
    if (chat().showQuestion) chat().showQuestion(event.question);
    else addActivity(t("app.activity.question"), event.question?.question || t("app.activity.questionUnsupported"));
  } else if (event.type === "done") {
    chat().ensureReasoningVisibility?.(current, event.reasoning_tok);
    chat().finalizeMessage?.(current);
    clearPendingQuestion();
    addFileChanges(event.file_changes);
    const tokens = tn("app.activity.tokens", event.tok_total || 0);
    const usage = event.tok_cached
      ? t("app.activity.tokensWithCache", { tokens, cached: window.NestCafe.i18n.formatNumber(event.tok_cached) })
      : tokens;
    addActivity(t("app.activity.done"), usage).classList.add("completion-line");
    window.NestCafe?.appearance?.notifyTaskComplete?.(
      t("app.notify.doneTitle"),
      title.textContent || t("app.notify.doneBody"),
    );
    current = null;
  } else if (event.type === "error") {
    chat().finalizeMessage?.(current);
    clearPendingQuestion();
    addFileChanges(event.file_changes);
    const errorRow = addActivity(t("common.error"), event.err || t("app.activity.unknownError"));
    if (window.NestCafe?.errors?.decorate) window.NestCafe.errors.decorate(errorRow, event.err);
    else errorRow.classList.add("error");
  }
  scrollConversation();
  return current;
}

async function sendPrompt(text, attachments = [], draft = null, onAccepted = null) {
  const prompt = String(text || "").trim();
  const sentAttachments = [...(attachments || [])];
  if (running || (!prompt && !sentAttachments.length)) return false;
  const sequence = ++runSequence;
  // A prompt keeps the currently displayed conversation. Older navigation
  // responses must never replace its live transcript, even after it finishes.
  navigationSequence++;

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
    title.textContent = (prompt || t("app.newConversation")).slice(0, 56);
  }
  setRunning(true);
  abortController = new AbortController();
  let current = null;
  let draftAccepted = false;
  let outcome = "incomplete";
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt || t("app.prompt.describeAttachments"),
        session_id: activeSession,
        attachments: sentAttachments,
      }),
      signal: abortController.signal,
    });
    if (!response.ok || !response.body) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
    draftAccepted = true;
    if (draft) composerDraftStore.clear(draft.scope, draft.text);
    window.NestCafe?.attachments?.clear?.();
    if (onAccepted) await onAccepted(abortController.signal);
    await superCliUI.readSSE(response.body, (event) => {
      if (event.type === "done") outcome = "done";
      else if (event.type === "error") outcome = "error";
      current = handleEvent(event, current);
    });
    if (outcome === "incomplete") {
      addActivity(t("app.activity.connection"), t("app.activity.connectionIncomplete")).classList.add("error");
    }
  } catch (error) {
    outcome = error.name === "AbortError" ? "interrupted" : "error";
    if (error.name !== "AbortError") {
      addActivity(t("app.activity.connection"), error.message).classList.add("error");
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
    chat().finishPendingActivities?.(toolRows.values(), outcome);
    if (outcome !== "done" && !pendingImmediateTask) window.NestCafe?.plan?.pause?.();
    setRunning(false);
    if (outcome !== "done") runState.textContent = outcome === "interrupted" ? t("topbar.state.interrupted") : t("common.error");
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
      // turns with attachments, so "Rewind" works immediately and consistently
      // without requiring the user to reopen the conversation first.
      if (activeSession) {
        const latestSeq = await findLatestUserSeq(activeSession);
        if (latestSeq) {
          if (sentAttachments.length) {
            window.NestCafe?.attachments?.remember?.(activeSession, latestSeq, sentAttachments);
          }
          const liveMessage = userMessage?.closest?.(".message");
          chat().enableRewind?.(liveMessage, latestSeq, prompt, sentAttachments);
        }
      }
    } catch {
      // Non-fatal: the live turn already rendered.
    }
    // A newer prompt may start while the finished run refreshes its transcript.
    // Its queue and explicit replacement choice belong to that newer run.
    if (sequence === runSequence) {
      const immediate = pendingImmediateTask;
      pendingImmediateTask = null;
      if (immediate) {
        setTimeout(() => window.NestCafe?.plan?.runScheduled?.(immediate, immediate.prompt), 0);
      } else {
        window.NestCafe?.plan?.onRunFinished?.(outcome);
      }
      promptInput.focus();
    }
  }
  return draftAccepted;
}

// Older engines return the whole transcript as a bare array (no paging fields).
function transcriptPageMessages(page) {
  return Array.isArray(page) ? page : page?.messages || [];
}

async function findLatestUserSeq(sessionID) {
  let before = 0;
  for (;;) {
    const suffix = before ? `&before=${before}` : "";
    const page = await json(`/api/transcript?id=${encodeURIComponent(sessionID)}&limit=${transcriptPageSize}${suffix}`);
    const messages = transcriptPageMessages(page);
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.role === "user" && Number(message.seq) > 0) return Number(message.seq);
    }
    if (!page?.has_more || !page?.before_seq) return 0;
    before = Number(page?.before_seq);
  }
}

function fileLabelFromAttachments(paths) {
  const names = (paths || []).map((path) => path.split(/[\\/]/).pop()).filter(Boolean);
  if (!names.length) return t("app.attachments.label");
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

async function loadHealth() {
  try {
    const health = await json("/api/health");
    activeWorkspace = health.home || "";
    const model = String(health.model || "").trim();
    const hasModel = Boolean(model) && model !== "no model";
    $("#status-dot").classList.remove("offline");
    $("#status-dot").classList.toggle("online", hasModel);
    $("#status-dot").classList.toggle("warning", !hasModel);
    $("#engine-label").textContent = hasModel ? t("sidebar.engine.connected") : t("sidebar.engine.addProvider");
    $("#model-label").textContent = hasModel ? model : t("sidebar.engine.noModel");
    modelMissing = !hasModel;
    syncWelcomeConnect();
    window.NestCafe?.attachments?.setWorkspace?.(health.home || "");
  } catch (error) {
    $("#status-dot").classList.remove("online", "warning");
    $("#status-dot").classList.add("offline");
    $("#engine-label").textContent = t("sidebar.engine.offline");
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
  heading.textContent = t("sidebar.rename.title");
  const copy = document.createElement("p");
  copy.textContent = t("sidebar.rename.body");
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 120;
  input.value = sessionDisplayTitle(session);
  input.setAttribute("aria-label", t("sidebar.rename.label"));
  const actions = document.createElement("div");
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "confirm-cancel";
  cancel.textContent = t("common.cancel");
  const save = document.createElement("button");
  save.type = "button";
  save.className = "confirm-save";
  save.textContent = t("common.save");
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
  dialog.innerHTML = `<h3></h3><p></p><div><button class="confirm-cancel" type="button"></button><button class="confirm-delete" type="button"></button></div>`;
  dialog.querySelector("h3").textContent = t("sidebar.delete.title");
  dialog.querySelector("p").textContent = t("sidebar.delete.body");
  const cancel = dialog.querySelector(".confirm-cancel");
  const confirm = dialog.querySelector(".confirm-delete");
  cancel.textContent = t("common.cancel");
  confirm.textContent = t("common.delete");
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
    $("#clear-sessions").hidden = !sessions.length;
    sessionList.replaceChildren();
    if (!sessions.length) {
      const empty = document.createElement("p");
      empty.className = "session-list-empty";
      empty.textContent = t("sidebar.history.empty");
      sessionList.appendChild(empty);
    }
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
      const count = Number(session.message_count) || 0;
      meta.textContent = `${tn("sidebar.history.messages", count)}${session.model ? ` · ${session.model}` : ""}`;
      button.append(dot, name, meta);
      window.NestCafe?.favorites?.decorateSession?.(button, session);
      button.append(
        makeSessionAction("✎", t("sidebar.history.rename"), "session-edit", () => renameSessionDialog(session)),
        makeSessionAction("×", t("sidebar.history.delete"), "session-delete", () => deleteSessionDialog(session)),
      );
      button.addEventListener("click", () => openSession(session));
      sessionList.appendChild(button);
    }
    return sessions;
  } catch (error) {
    showToast(t("sidebar.history.loadFailed", { error: error.message }));
    return [];
  }
}

function renderLoadedTranscript(preserveScroll = false) {
  const oldHeight = conversation.scrollHeight;
  const oldTop = conversation.scrollTop;
  resetLiveConversationObserver();
  toolRows.clear();
  questionToolIDs.clear();
  chat().closeQuestion?.();
  conversation.replaceChildren();

  if (transcriptHasMore) {
    const older = document.createElement("button");
    older.type = "button";
    older.className = "history-older";
    older.textContent = t("app.transcript.older");
    older.addEventListener("click", loadOlderTranscript);
    conversation.appendChild(older);
  }

  const questionResults = new Map(
    loadedTranscriptMessages
      .filter((message) => message.role === "tool" && message.name === "ask_user" && message.tool_call_id)
      .map((message) => [message.tool_call_id, message.content || ""]),
  );
  for (const message of loadedTranscriptMessages) {
    if (message.role === "user") {
      addMessage("user", message.content || "", message.seq || 0, message.attachments || []);
    } else if (message.role === "assistant") {
      const content = chat().withReasoningFallback?.(
        message.content || "",
        message.turn?.reasoning_tok,
      ) || message.content || "";
      if (content.trim()) addMessage("assistant", content, message.seq || 0, message.attachments || []);
      for (const call of message.tool_calls || []) {
        if (call.name !== "ask_user") continue;
        const stored = questionResults.get(call.id);
        if (stored != null) chat().renderStoredQuestion?.(call, stored, conversation);
      }
      addFileChanges(message.turn?.file_changes);
    } else if (message.role === "tool") {
      if (message.name === "ask_user") continue;
      const row = addActivity(message.name || t("app.activity.tool"), "", `history-${message.seq || Math.random()}`);
      row.dataset.toolName = message.name || "";
      chat().completeActivity(row, { output: message.content || "" });
    }
  }

  if (preserveScroll) {
    conversation.scrollTop = oldTop + Math.max(0, conversation.scrollHeight - oldHeight);
  } else {
    scrollConversation(true);
  }
}

async function loadOlderTranscript() {
  if (!transcriptHasMore || !transcriptBeforeSeq || !transcriptSessionID) return;
  const sessionID = transcriptSessionID;
  const button = conversation.querySelector(".history-older");
  if (button) {
    button.disabled = true;
    button.textContent = t("app.transcript.loading");
  }
  transcriptAbortController?.abort();
  const controller = new AbortController();
  transcriptAbortController = controller;
  try {
    const page = await json(
      `/api/transcript?id=${encodeURIComponent(sessionID)}&limit=${transcriptPageSize}&before=${transcriptBeforeSeq}`,
      { signal: controller.signal },
    );
    if (sessionID !== transcriptSessionID || controller !== transcriptAbortController) return;
    loadedTranscriptMessages = [...transcriptPageMessages(page), ...loadedTranscriptMessages];
    transcriptHasMore = Boolean(page?.has_more);
    transcriptBeforeSeq = Number(page?.before_seq || 0);
    renderLoadedTranscript(true);
  } catch (error) {
    if (error.name !== "AbortError") {
      showToast(error.message);
      if (button?.isConnected) {
        button.disabled = false;
        button.textContent = t("app.transcript.older");
      }
    }
  } finally {
    if (controller === transcriptAbortController) transcriptAbortController = null;
  }
}

async function openSession(session, skipSessionReload = false, navigation = null) {
  if (running) return false;
  const sequence = navigation ?? ++navigationSequence;
  transcriptAbortController?.abort();
  const controller = new AbortController();
  transcriptAbortController = controller;
  try {
    const page = await json(
      `/api/transcript?id=${encodeURIComponent(session.id)}&limit=${transcriptPageSize}`,
      { signal: controller.signal },
    );
    if (controller !== transcriptAbortController || sequence !== navigationSequence || running) return false;
    activeSession = session.id;
    transcriptSessionID = session.id;
    loadedTranscriptMessages = transcriptPageMessages(page);
    transcriptHasMore = Boolean(page?.has_more);
    transcriptBeforeSeq = Number(page?.before_seq || 0);
    composerDraftStore.restore(`session:${session.id}`);
    followConversation = true;
    document.body.classList.remove("empty-state");
    title.textContent = sessionDisplayTitle(session);
    renderLoadedTranscript(false);
    if (!skipSessionReload) await loadSessions();
    return sequence === navigationSequence && !running;
  } catch (error) {
    if (error.name !== "AbortError" && sequence === navigationSequence && !running) showToast(error.message);
    return false;
  } finally {
    if (controller === transcriptAbortController) transcriptAbortController = null;
  }
}

function rewindDialog(sessionID, seq, text, preview, messageAttachments = []) {
  const dialog = document.createElement("dialog");
  dialog.className = "nestcafe-rewind-dialog";
  const form = document.createElement("form");
  form.method = "dialog";
  const heading = document.createElement("h3");
  heading.textContent = t("app.rewind.title");
  const copy = document.createElement("p");
  copy.textContent = messageAttachments.length
    ? t("app.rewind.bodyWithImages")
    : t("app.rewind.body");
  const reason = document.createElement("textarea");
  reason.maxLength = 400;
  reason.placeholder = t("app.rewind.reasonPlaceholder");
  let rewindFiles = null;
  if (preview?.available && preview.files?.length) {
    const option = document.createElement("label");
    rewindFiles = document.createElement("input");
    rewindFiles.type = "checkbox";
    const optionCopy = document.createElement("span");
    optionCopy.textContent = tn("app.rewind.files", preview.files.length);
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
  cancel.textContent = t("common.cancel");
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = "settings-primary-button";
  confirm.textContent = t("app.rewind.confirm");
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
        first_user_msg: title.textContent || t("app.session.untitled"),
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
      showToast(result.warning || t("app.rewind.done"));
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
    showToast(t("app.rewind.busy"));
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
  if (running) return false;
  // Claim navigation before either request, so a slow catalog lookup cannot
  // resurrect a selection that New chat or a newer selection has superseded.
  const sequence = ++navigationSequence;
  try {
    const sessions = await json("/api/sessions?limit=100");
    if (sequence !== navigationSequence || running) return false;
    const session = sessions.find((item) => item.id === id);
    if (!session) throw new Error(t("app.session.notFound"));
    return await openSession(session, false, sequence);
  } catch (error) {
    if (sequence !== navigationSequence || running) return false;
    throw error;
  }
}

function newConversation() {
  if (running) return;
  navigationSequence++;
  activeSession = "";
  toolRows.clear();
  conversation.innerHTML = welcomeHTML;
  window.NestCafe?.i18n?.apply?.(conversation);
  syncWelcomeConnect();
  window.NestCafe?.favorites?.render?.();
  document.body.classList.add("empty-state");
  title.textContent = t("app.newConversation");
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
    showToast(t("app.composer.answerFirst"));
    return;
  }
  if (running) {
    if (pendingAttachments.length) {
      showToast(t("app.composer.attachmentsBusy"));
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

stopButton.addEventListener("click", () => {
  // Stop pauses the queue; the separate explicit "Now" action replaces a run.
  window.NestCafe?.plan?.pause?.();
  pendingImmediateTask = null;
  abortController?.abort();
});
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
