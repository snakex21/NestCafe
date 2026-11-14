"use strict";

const schedulerUI = window.NestCafe?.settings?.ui;
const schedulePrefix = "[NESTCAFE_SCHEDULE] ";

function scheduleDate(value) {
  if (!value) return "—";
  const i18n = window.NestCafe?.i18n;
  if (i18n?.formatDate) return i18n.formatDate(value, { dateStyle: "short", timeStyle: "medium" });
  try {
    return new Date(value).toLocaleString();
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
  meta.textContent = t("settings.scheduler.runs", {
    next: scheduleDate(item.next_run_at),
    last: scheduleDate(item.last_run_at),
  });
  copy.append(cron, prompt, meta);
  const actions = document.createElement("div");
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.className = "settings-switch-input";
  toggle.checked = item.enabled;
  toggle.setAttribute("aria-label", t("settings.scheduler.toggleLabel", { cron: item.cron }));
  toggle.addEventListener("change", async () => {
    await schedulerUI.json("/api/schedules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, enabled: toggle.checked }),
    });
    refresh();
  });
  const remove = schedulerUI.button(t("common.delete"), "settings-danger-button");
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
      <label><span>${t("settings.scheduler.cronLabel")}</span><input name="cron" value="0 9 * * 1-5" required /></label>
      <label class="settings-form-wide"><span>${t("settings.scheduler.promptLabel")}</span><textarea name="prompt" rows="3" required placeholder="${t("settings.scheduler.promptPlaceholder")}"></textarea></label>
    </div>
    <div class="schedule-help">${t("settings.scheduler.help", { example: "<code>0 9 * * 1-5</code>" })}</div>
    <button class="settings-primary-button" type="submit">${t("settings.scheduler.add")}</button>`;
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
    window.NestCafe?.toast?.(t("settings.scheduler.saved"));
    refresh();
  });
  return form;
}

window.NestCafe?.settings?.registerPage?.("scheduler", t("settings.nav.scheduler"), async (root) => {
  const list = document.createElement("div");
  list.className = "settings-list schedule-list";

  const renderList = (data, refresh) => {
    list.replaceChildren();
    for (const item of data.schedules || []) list.append(scheduleRow(item, refresh));
    if (!data.schedules?.length) {
      list.append(
        schedulerUI.empty(
          t("settings.scheduler.emptyTitle"),
          t("settings.scheduler.emptyHint"),
        ),
      );
    }
  };

  const refresh = async () => {
    const data = await schedulerUI.json("/api/schedules");
    renderList(data, refresh);
  };

  // Fetch the data first and only then insert the whole screen, so the form and the
  // green button do not appear high up and then get pushed down once the list loads.
  const initialData = await schedulerUI.json("/api/schedules");
  renderList(initialData, refresh);

  const notice = document.createElement("div");
  notice.className = "settings-notice";
  notice.textContent = t("settings.scheduler.notice");
  root.replaceChildren(
    schedulerUI.sectionHeader(
      t("settings.scheduler.heading"),
      t("settings.scheduler.description"),
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
