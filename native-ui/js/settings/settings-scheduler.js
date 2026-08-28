"use strict";

const schedulerUI = window.NestCafe?.settings?.ui;
const schedulePrefix = "[NESTCAFE_SCHEDULE] ";

function scheduleDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pl-PL");
  } catch {
    return value;
  }
}

function scheduleRow(item, refresh) {
  const row = document.createElement("article");
  row.className = `schedule-row${item.enabled ? "" : " disabled"}`;
  const copy = document.createElement("div");
  const cron = document.createElement("code");
  cron.textContent = item.cron;
  const prompt = document.createElement("strong");
  prompt.textContent = item.prompt;
  const meta = document.createElement("span");
  meta.textContent = `Następne: ${scheduleDate(item.next_run_at)} · Ostatnie: ${scheduleDate(item.last_run_at)}`;
  copy.append(cron, prompt, meta);
  const actions = document.createElement("div");
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.className = "settings-switch-input";
  toggle.checked = item.enabled;
  toggle.addEventListener("change", async () => {
    await schedulerUI.json("/api/schedules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, enabled: toggle.checked }),
    });
    refresh();
  });
  const remove = schedulerUI.button("Usuń", "settings-danger-button");
  remove.addEventListener("click", async () => {
    await schedulerUI.json(`/api/schedules?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    refresh();
  });
  actions.append(toggle, remove);
  row.append(copy, actions);
  return row;
}

function scheduleForm(refresh) {
  const form = document.createElement("form");
  form.className = "schedule-create";
  form.innerHTML = `
    <div class="schedule-form-grid">
      <label><span>Wyrażenie cron</span><input name="cron" value="0 9 * * 1-5" required /></label>
      <label class="settings-form-wide"><span>Zadanie</span><textarea name="prompt" rows="3" required placeholder="Np. przygotuj poranny przegląd wiadomości i spotkań."></textarea></label>
    </div>
    <div class="schedule-help">Format: minuta · godzina · dzień · miesiąc · dzień tygodnia. Przykład <code>0 9 * * 1-5</code> oznacza dni robocze o 09:00.</div>
    <button class="settings-primary-button" type="submit">Dodaj harmonogram</button>`;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    await schedulerUI.json("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cron: String(data.get("cron") || ""),
        prompt: String(data.get("prompt") || ""),
      }),
    });
    form.querySelector("textarea").value = "";
    window.NestCafe?.toast?.("Harmonogram został zapisany.");
    refresh();
  });
  return form;
}

window.NestCafe?.settings?.registerPage?.("scheduler", "Harmonogram", async (root) => {
  const list = document.createElement("div");
  list.className = "settings-list schedule-list";

  const renderList = (data, refresh) => {
    list.replaceChildren();
    for (const item of data.schedules || []) list.append(scheduleRow(item, refresh));
    if (!data.schedules?.length) {
      list.append(
        schedulerUI.empty(
          "Brak zaplanowanych zadań",
          "Utwórz harmonogram, aby NestCafe dodawało zadanie do kolejki o określonej porze.",
        ),
      );
    }
  };

  const refresh = async () => {
    const data = await schedulerUI.json("/api/schedules");
    renderList(data, refresh);
  };

  // Najpierw pobierz dane, a dopiero potem wstaw cały ekran. Dzięki temu formularz
  // i zielony przycisk nie pojawiają się wysoko i nie są spychane w dół po doładowaniu listy.
  const initialData = await schedulerUI.json("/api/schedules");
  renderList(initialData, refresh);

  const notice = document.createElement("div");
  notice.className = "settings-notice";
  notice.textContent =
    "Harmonogram działa w natywnej wersji Go. Gdy aplikacja jest zamknięta, zaległe zadanie zostanie dodane do kolejki przy następnym uruchomieniu.";
  root.replaceChildren(
    schedulerUI.sectionHeader(
      "Zaplanowane zadania",
      "Automatyzuj powtarzalną pracę za pomocą pięciopolowych wyrażeń cron.",
    ),
    notice,
    list,
    scheduleForm(refresh),
  );
});

async function runPendingSchedules() {
  if (window.NestCafe?.isRunning?.()) return;
  try {
    const tasks = await schedulerUI.json("/api/tasks");
    const scheduled = (tasks || []).find((task) => task.prompt?.startsWith(schedulePrefix));
    if (!scheduled) return;
    const prompt = scheduled.prompt.slice(schedulePrefix.length).trim();
    await window.NestCafe?.plan?.runScheduled?.(scheduled, prompt);
  } catch {
  }
}

setInterval(runPendingSchedules, 15000);
setTimeout(runPendingSchedules, 2500);
