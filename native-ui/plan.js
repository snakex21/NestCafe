"use strict";

const planDialog = document.querySelector("#plan-dialog");
const goalCreate = document.querySelector("#goal-create");
const goalActive = document.querySelector("#goal-active");
const goalTasks = document.querySelector("#goal-tasks");
const queueList = document.querySelector("#queue-list");
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
  badge.hidden = !currentGoal;
  if (!currentGoal) return;
  const tasks = currentGoal.tasks || [];
  const done = tasks.filter((task) => task.status === "done" || task.status === "skipped").length;
  badge.textContent = `${done}/${tasks.length}`;
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
    window.showNestCafeToast?.(error.message);
  }
}

async function mutateGoal(payload) {
  try {
    currentGoal = await postGoal(payload);
    renderGoal();
  } catch (error) {
    window.showNestCafeToast?.(error.message);
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

function renderQueue() {
  document.querySelector("#queue-count").textContent = queuedTasks.length;
  queueList.replaceChildren();
  if (!queuedTasks.length) {
    const empty = document.createElement("div");
    empty.className = "queue-empty";
    empty.textContent = "Kolejka jest pusta.";
    queueList.appendChild(empty);
    return;
  }
  queuedTasks.forEach((task, index) => {
    const row = document.createElement("div");
    row.className = "queue-row";
    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    const copy = document.createElement("div");
    const prompt = document.createElement("strong");
    prompt.textContent = task.prompt;
    copy.appendChild(prompt);
    const actions = document.createElement("div");
    actions.className = "queue-actions";
    actions.append(
      queueButton("Uruchom", "Uruchom teraz", () => runQueuedTask(task)),
      queueButton("↑", "Przesuń wyżej", () => moveQueuedTask(task, Math.max(0, index - 1))),
      queueButton("×", "Usuń", () => removeQueuedTask(task.id)),
    );
    row.append(number, copy, actions);
    queueList.appendChild(row);
  });
}

async function loadQueue() {
  try {
    queuedTasks = await planJson("/api/tasks") || [];
    renderQueue();
  } catch (error) {
    window.showNestCafeToast?.(error.message);
  }
}

async function enqueueTask(prompt, automatic = false) {
  const text = prompt.trim();
  if (!text) return;
  try {
    await planJson("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: window.getNestCafeSession?.() || "", prompt: text }),
    });
    continueQueuedRuns = continueQueuedRuns || automatic;
    await loadQueue();
    window.showNestCafeToast?.("Dodano do kolejki.");
  } catch (error) {
    window.showNestCafeToast?.(error.message);
  }
}

async function removeQueuedTask(id) {
  try {
    await planJson(`/api/tasks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadQueue();
    return true;
  } catch (error) {
    window.showNestCafeToast?.(error.message);
    return false;
  }
}

async function moveQueuedTask(task, position) {
  try {
    await planJson("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, position }),
    });
    await loadQueue();
  } catch (error) {
    window.showNestCafeToast?.(error.message);
  }
}

async function runQueuedTask(task) {
  if (!task || window.isNestCafeRunning?.()) return;
  try {
    if (task.session_id && task.session_id !== window.getNestCafeSession?.()) {
      await window.resumeNestCafeSession?.(task.session_id);
    }
    if (!await removeQueuedTask(task.id)) return;
    planDialog.close();
    window.runNestCafePrompt?.(task.prompt);
  } catch (error) {
    window.showNestCafeToast?.(error.message);
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

document.querySelectorAll("[data-plan-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-plan-tab]").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".plan-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `plan-${button.dataset.planTab}`));
  });
});

goalCreate.addEventListener("submit", async (event) => {
  event.preventDefault();
  await mutateGoal({
    action: "set",
    title: document.querySelector("#goal-title-input").value,
    description: document.querySelector("#goal-description-input").value,
    success_criteria: document.querySelector("#goal-criteria-input").value,
    parent_session_id: window.getNestCafeSession?.() || "",
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
document.querySelector("#plan-button").addEventListener("click", () => {
  planDialog.showModal();
  Promise.all([loadGoal(), loadQueue(), loadMemory()]);
});
document.querySelector("#close-plan").addEventListener("click", () => planDialog.close());

window.enqueueNestCafePrompt = (prompt) => enqueueTask(prompt, true);
window.onNestCafeRunFinished = async () => {
  if (!continueQueuedRuns) return;
  await loadQueue();
  if (!queuedTasks.length) {
    continueQueuedRuns = false;
    return;
  }
  setTimeout(() => runQueuedTask(queuedTasks[0]), 80);
};

loadGoal();
loadQueue();
