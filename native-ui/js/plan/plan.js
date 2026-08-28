"use strict";

const planDialog = document.querySelector("#plan-dialog");
const goalCreate = document.querySelector("#goal-create");
const goalActive = document.querySelector("#goal-active");
const goalTasks = document.querySelector("#goal-tasks");
const queueList = document.querySelector("#queue-list");
const composerQueue = document.querySelector("#composer-queue");
const memoryList = document.querySelector("#memory-list");

let currentGoal = null;
let queuedTasks = [];
let continueQueuedRuns = false;

async function planJson(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error((await response.text()).trim() || `HTTP ${response.status}`);
  if (response.status === 204) return null;
  const text = await response.text();
  return text.trim() ? JSON.parse(text) : null;
}

function postGoal(payload) {
  return planJson("/api/goal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function renderGoal() {
  goalCreate.hidden = Boolean(currentGoal);
  goalActive.hidden = !currentGoal;
  const badge = document.querySelector("#plan-badge");
  if (badge) badge.hidden = !currentGoal;
  if (!currentGoal) return;
  const tasks = currentGoal.tasks || [];
  const done = tasks.filter((task) => task.status === "done" || task.status === "skipped").length;
  if (badge) badge.textContent = `${done}/${tasks.length}`;
  document.querySelector("#goal-title").textContent = currentGoal.title;
  const labels = { active: "w toku", done: "zakończony", abandoned: "porzucony" };
  document.querySelector("#goal-status").textContent = currentGoal.verification_status === "passed"
    ? "zweryfikowany" : labels[currentGoal.status] || currentGoal.status;
  document.querySelector("#goal-description").textContent = currentGoal.description || "Bez dodatkowego opisu.";
  const criteria = document.querySelector("#goal-criteria");
  criteria.hidden = !currentGoal.success_criteria;
  criteria.textContent = currentGoal.success_criteria ? `Gotowe, gdy: ${currentGoal.success_criteria}` : "";
  document.querySelector("#goal-progress").textContent = `${done} z ${tasks.length} kroków ukończonych`;
  goalTasks.replaceChildren();
  for (const task of tasks) {
    const row = document.createElement("label");
    row.className = `goal-task${task.status === "done" ? " done" : ""}`;
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = task.status === "done";
    check.addEventListener("change", () => updateTask(task.seq, check.checked ? "done" : "pending"));
    const title = document.createElement("span");
    title.textContent = task.title;
    row.append(check, title);
    goalTasks.appendChild(row);
  }
  const verify = document.querySelector("#goal-verify");
  verify.hidden = !currentGoal.ready_for_verification || currentGoal.verification_status === "passed";
  document.querySelector("#finish-goal").hidden = !currentGoal.can_finish;
}

async function loadGoal() {
  try {
    currentGoal = await planJson("/api/goal");
    renderGoal();
  } catch (error) {
    window.NestCafe?.toast?.(error.message);
  }
}

async function mutateGoal(payload) {
  try {
    currentGoal = await postGoal(payload);
    renderGoal();
  } catch (error) {
    window.NestCafe?.toast?.(error.message);
  }
}

async function updateTask(seq, status) {
  await mutateGoal({ action: "set_task_status", task_seq: seq, status });
}

function queueButton(text, title, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.title = title;
  button.addEventListener("click", handler);
  return button;
}

function queueRow(task, index, compact = false) {
  const row = document.createElement("div");
  row.className = compact ? "composer-queue-row" : "queue-row";
  row.dataset.queueId = task.id;

  const number = document.createElement("button");
  number.type = "button";
  number.className = compact ? "composer-queue-index" : "queue-index-button";
  number.textContent = String(index + 1).padStart(2, "0");
  number.title = "Zmień pozycję w kolejce";
  number.addEventListener("click", () => chooseQueuedTaskPosition(task, index));

  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = compact ? "composer-queue-copy" : "queue-copy-button";
  copy.title = "Edytuj wiadomość";
  const prompt = document.createElement("strong");
  prompt.textContent = task.prompt;
  copy.appendChild(prompt);
  copy.addEventListener("click", () => editQueuedTask(task));

  const actions = document.createElement("div");
  actions.className = compact ? "composer-queue-actions" : "queue-actions";
  const now = queueButton(compact ? "Teraz" : "Uruchom", "Przerwij bieżącą pracę i uruchom teraz", () => runQueuedTask(task));
  now.classList.add("queue-now");
  const edit = queueButton("✎", "Edytuj", () => editQueuedTask(task));
  const up = queueButton("↑", "Przesuń wyżej", () => moveQueuedTask(task, Math.max(0, index - 1)));
  up.disabled = index === 0;
  const down = queueButton("↓", "Przesuń niżej", () => moveQueuedTask(task, Math.min(queuedTasks.length - 1, index + 1)));
  down.disabled = index + 1 >= queuedTasks.length;
  const remove = queueButton("×", "Usuń", () => removeQueuedTask(task.id));
  remove.classList.add("queue-remove");
  actions.append(now, edit, up, down, remove);
  row.append(number, copy, actions);
  return row;
}

function renderComposerQueue() {
  if (!composerQueue) return;
  composerQueue.replaceChildren();
  composerQueue.hidden = !queuedTasks.length;
  if (!queuedTasks.length) return;

  const head = document.createElement("div");
  head.className = "composer-queue-head";
  const label = document.createElement("strong");
  label.textContent = `W kolejce · ${queuedTasks.length}`;
  const hint = document.createElement("span");
  hint.textContent = "Teraz = przerwij bieżącego agenta i uruchom tę wiadomość";
  head.append(label, hint);
  composerQueue.appendChild(head);

  const list = document.createElement("div");
  list.className = "composer-queue-list";
  queuedTasks.forEach((task, index) => list.appendChild(queueRow(task, index, true)));
  composerQueue.appendChild(list);
}

function renderQueue() {
  document.querySelector("#queue-count").textContent = queuedTasks.length;
  queueList.replaceChildren();
  renderComposerQueue();
  if (!queuedTasks.length) {
    const empty = document.createElement("div");
    empty.className = "queue-empty";
    empty.textContent = "Kolejka jest pusta.";
    queueList.appendChild(empty);
    return;
  }
  queuedTasks.forEach((task, index) => queueList.appendChild(queueRow(task, index)));
}

async function patchQueuedTask(task, patch) {
  try {
    await planJson("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, ...patch }),
    });
    await loadQueue();
    return true;
  } catch (error) {
    window.NestCafe?.toast?.(error.message);
    return false;
  }
}

async function chooseQueuedTaskPosition(task, index) {
  const value = window.prompt(`Pozycja w kolejce (1-${queuedTasks.length})`, String(index + 1));
  if (value == null) return;
  const position = Number(value) - 1;
  if (!Number.isInteger(position) || position < 0 || position >= queuedTasks.length) {
    window.NestCafe?.toast?.("Podaj prawidłową pozycję kolejki.");
    return;
  }
  await moveQueuedTask(task, position);
}

function editQueuedTask(task) {
  const dialog = document.createElement("dialog");
  dialog.className = "confirm-dialog queue-edit-dialog";
  const heading = document.createElement("h3");
  heading.textContent = "Edytuj wiadomość w kolejce";
  const input = document.createElement("textarea");
  input.rows = 6;
  input.value = task.prompt || "";
  const actions = document.createElement("div");
  const cancel = queueButton("Anuluj", "Anuluj", () => dialog.close());
  cancel.className = "confirm-cancel";
  const save = queueButton("Zapisz", "Zapisz wiadomość", async () => {
    const prompt = input.value.trim();
    if (!prompt) return input.focus();
    save.disabled = true;
    if (await patchQueuedTask(task, { prompt })) dialog.close();
    else save.disabled = false;
  });
  save.className = "confirm-save";
  actions.append(cancel, save);
  dialog.append(heading, input, actions);
  dialog.addEventListener("close", () => dialog.remove());
  document.body.appendChild(dialog);
  dialog.showModal();
  input.focus();
  input.select();
}

async function loadQueue() {
  try {
    queuedTasks = await planJson("/api/tasks") || [];
    renderQueue();
  } catch (error) {
    window.NestCafe?.toast?.(error.message);
  }
}

async function enqueueTask(prompt, automatic = false) {
  const text = prompt.trim();
  if (!text) return false;
  try {
    await planJson("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: window.NestCafe?.getSession?.() || "", prompt: text }),
    });
    continueQueuedRuns = continueQueuedRuns || automatic;
    await loadQueue();
    window.NestCafe?.toast?.("Dodano do kolejki.");
    return true;
  } catch (error) {
    window.NestCafe?.toast?.(error.message);
    return false;
  }
}

async function removeQueuedTask(id) {
  try {
    await planJson(`/api/tasks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadQueue();
    return true;
  } catch (error) {
    window.NestCafe?.toast?.(error.message);
    return false;
  }
}

async function moveQueuedTask(task, position) {
  await patchQueuedTask(task, { position });
}

async function runQueuedTask(task, promptOverride = "") {
  if (!task) return;
  if (window.NestCafe?.isRunning?.()) {
    window.NestCafe?.interruptWithQueuedTask?.({ ...task, prompt: promptOverride || task.prompt });
    return;
  }
  try {
    if (task.session_id && task.session_id !== window.NestCafe?.getSession?.()) {
      await window.NestCafe?.resumeSession?.(task.session_id);
    }
    if (!await removeQueuedTask(task.id)) return;
    if (planDialog.open) planDialog.close();
    window.NestCafe?.runPrompt?.(promptOverride || task.prompt);
  } catch (error) {
    window.NestCafe?.toast?.(error.message);
  }
}

async function loadMemory() {
  memoryList.innerHTML = '<div class="memory-empty">Wczytuję pamięć…</div>';
  try {
    const rows = await planJson("/api/memory?limit=60") || [];
    memoryList.replaceChildren();
    if (!rows.length) {
      memoryList.innerHTML = '<div class="memory-empty">Agent nie zapisał jeszcze żadnych faktów.</div>';
      return;
    }
    for (const item of rows) {
      const row = document.createElement("div");
      row.className = "memory-row";
      const copy = document.createElement("div");
      const content = document.createElement("p");
      content.textContent = item.content;
      copy.appendChild(content);
      if (item.tags?.length) {
        const tags = document.createElement("div");
        tags.className = "memory-tags";
        tags.textContent = item.tags.join(" · ");
        copy.appendChild(tags);
      }
      const scope = document.createElement("small");
      scope.textContent = item.scope || "pamięć";
      row.append(copy, scope);
      memoryList.appendChild(row);
    }
  } catch (error) {
    memoryList.innerHTML = `<div class="memory-empty">${error.message}</div>`;
  }
}

function activatePlanTab(name) {
  document.querySelectorAll("[data-plan-tab]").forEach((item) => {
    item.classList.toggle("active", item.dataset.planTab === name);
  });
  document.querySelectorAll(".plan-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `plan-${name}`);
  });
}

document.querySelectorAll("[data-plan-tab]").forEach((button) => {
  button.addEventListener("click", () => activatePlanTab(button.dataset.planTab));
});

goalCreate.addEventListener("submit", async (event) => {
  event.preventDefault();
  await mutateGoal({
    action: "set",
    title: document.querySelector("#goal-title-input").value,
    description: document.querySelector("#goal-description-input").value,
    success_criteria: document.querySelector("#goal-criteria-input").value,
    parent_session_id: window.NestCafe?.getSession?.() || "",
  });
  goalCreate.reset();
});

document.querySelector("#goal-add-task").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#goal-task-input");
  await mutateGoal({ action: "add_task", title: input.value });
  input.value = "";
});

document.querySelector("#verify-goal").addEventListener("click", () => mutateGoal({
  action: "verify",
  passed: true,
  text: document.querySelector("#goal-evidence").value || "Potwierdzone przez użytkownika w NestCafe.",
}));
document.querySelector("#finish-goal").addEventListener("click", () => mutateGoal({ action: "set_status", status: "done" }));
document.querySelector("#abandon-goal").addEventListener("click", () => {
  if (confirm("Porzucić aktywny cel?")) mutateGoal({ action: "set_status", status: "abandoned" });
});

document.querySelector("#queue-add").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#queue-input");
  await enqueueTask(input.value);
  input.value = "";
});
document.querySelector("#run-queue").addEventListener("click", () => runQueuedTask(queuedTasks[0]));
document.querySelector("#refresh-memory").addEventListener("click", loadMemory);
function openPlanDialog(page = "goal") {
  const memoryView = page === "memory";
  planDialog.classList.toggle("memory-view", memoryView);
  document.querySelector(".plan-head h2").textContent = memoryView ? "Pamięć" : "Plan pracy";
  activatePlanTab(memoryView ? "memory" : page);
  window.NestCafe?.settings?.setPlanNavigation?.(memoryView ? "memory" : "plan");
  planDialog.showModal();
  Promise.all([loadGoal(), loadQueue(), loadMemory()]);
}

document.querySelector("#plan-button")?.addEventListener("click", () => openPlanDialog("goal"));
document.querySelector("#close-plan").addEventListener("click", () => planDialog.close());
async function onRunFinished() {
  if (!continueQueuedRuns) return;
  await loadQueue();
  if (!queuedTasks.length) {
    continueQueuedRuns = false;
    return;
  }
  setTimeout(() => runQueuedTask(queuedTasks[0]), 80);
}

const planApi = {
  open: openPlanDialog,
  enqueue: (prompt) => enqueueTask(prompt, true),
  runScheduled: (task, prompt) => runQueuedTask(task, prompt),
  refresh: loadQueue,
  onRunFinished,
};

window.NestCafe.export("plan", planApi);

loadGoal();
loadQueue();
