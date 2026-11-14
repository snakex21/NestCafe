"use strict";

(() => {
  const ui = window.NestCafe?.settings?.ui;
  const register = window.NestCafe?.settings?.registerPage;
  if (!ui || !register) return;

  const postGoal = (body) => ui.json("/api/goal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  register("plan", t("settings.nav.plan"), async (root) => {
    const tabs = document.createElement("div");
    tabs.className = "settings-segmented settings-plan-tabs";
    const goalTab = ui.button(t("settings.plan.tabGoal"), "active");
    const queueTab = ui.button(t("settings.plan.tabQueue"));
    tabs.append(goalTab, queueTab);
    const content = document.createElement("div");
    content.className = "settings-plan-content";
    let selected = "goal";
    let queueLaunchPending = false;

    const mutateGoal = async (body) => {
      await postGoal(body);
      await renderGoal();
    };

    const renderGoal = async () => {
      content.replaceChildren(ui.empty(t("common.loading"), t("settings.plan.loadingGoal")));
      const goal = await ui.json("/api/goal");
      if (!goal) {
        const form = document.createElement("form");
        form.className = "settings-plan-form";
        form.innerHTML = `
          <label><span>${t("settings.plan.goalTitle")}</span><input name="title" required placeholder="${t("settings.plan.goalTitlePlaceholder")}" /></label>
          <label><span>${t("settings.plan.goalDescription")}</span><textarea name="description" rows="3" placeholder="${t("settings.plan.goalDescriptionPlaceholder")}"></textarea></label>
          <label><span>${t("settings.plan.goalCriteria")}</span><input name="criteria" placeholder="${t("settings.plan.goalCriteriaPlaceholder")}" /></label>
          <button class="settings-primary-button" type="submit">${t("settings.plan.createGoal")}</button>`;
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          await mutateGoal({
            action: "set",
            title: data.get("title"),
            description: data.get("description"),
            success_criteria: data.get("criteria"),
            parent_session_id: window.NestCafe?.getSession?.() || "",
          });
        });
        content.replaceChildren(
          ui.sectionHeader(t("settings.plan.noGoalTitle"), t("settings.plan.noGoalHint")),
          form,
        );
        return;
      }

      const tasks = document.createElement("div");
      tasks.className = "settings-plan-task-list";
      for (const task of goal.tasks || []) {
        const row = document.createElement("label");
        row.className = `settings-plan-task${task.status === "done" ? " done" : ""}`;
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.status === "done";
        checkbox.addEventListener("change", () => mutateGoal({ action: "set_task_status", task_seq: task.seq, status: checkbox.checked ? "done" : "pending" }));
        const copy = document.createElement("span");
        copy.textContent = task.title;
        row.append(checkbox, copy);
        tasks.append(row);
      }
      if (!tasks.children.length) tasks.append(ui.empty(t("settings.plan.noStepsTitle"), t("settings.plan.noStepsHint")));

      const add = document.createElement("form");
      add.className = "settings-plan-add";
      add.innerHTML = `<input name="task" required placeholder="${t("settings.plan.addStepPlaceholder")}" aria-label="${t("settings.plan.addStepLabel")}" /><button class="settings-secondary-button" type="submit">${t("common.add")}</button>`;
      add.addEventListener("submit", async (event) => {
        event.preventDefault();
        const input = add.elements.task;
        await mutateGoal({ action: "add_task", title: input.value });
      });

      const actions = document.createElement("div");
      actions.className = "settings-plan-actions";
      const abandon = ui.button(t("settings.plan.abandon"), "settings-danger-button");
      let abandonArmed = false;
      abandon.addEventListener("click", () => {
        if (!abandonArmed) {
          abandonArmed = true;
          abandon.textContent = t("settings.plan.abandonConfirm");
          setTimeout(() => {
            if (!abandon.isConnected) return;
            abandonArmed = false;
            abandon.textContent = t("settings.plan.abandon");
          }, 4000);
          return;
        }
        mutateGoal({ action: "set_status", status: "abandoned" });
      });
      actions.append(abandon);
      if (goal.ready_for_verification && goal.verification_status !== "passed") {
        const verify = ui.button(t("settings.plan.verify"), "settings-primary-button");
        verify.addEventListener("click", () => mutateGoal({ action: "verify", passed: true, text: t("settings.plan.verifiedNote") }));
        actions.append(verify);
      } else if (goal.can_finish) {
        const finish = ui.button(t("settings.plan.finish"), "settings-primary-button");
        finish.addEventListener("click", () => mutateGoal({ action: "set_status", status: "done" }));
        actions.append(finish);
      }
      const done = (goal.tasks || []).filter((task) => ["done", "skipped"].includes(task.status)).length;
      const summary = document.createElement("section");
      summary.className = "settings-plan-summary";
      summary.innerHTML = `<div><span></span><h3></h3><p></p></div><strong></strong>`;
      summary.querySelector("span").textContent = t("settings.plan.activeGoal");
      summary.querySelector("h3").textContent = goal.title;
      summary.querySelector("p").textContent = goal.description || goal.success_criteria || t("settings.plan.noDescription");
      summary.querySelector("strong").textContent = `${done}/${(goal.tasks || []).length}`;
      content.replaceChildren(summary, tasks, add, actions);
    };

    const renderQueue = async () => {
      content.replaceChildren(ui.empty(t("common.loading"), t("settings.plan.loadingQueue")));
      const queue = await ui.json("/api/tasks") || [];
      const add = document.createElement("form");
      add.className = "settings-plan-add";
      add.innerHTML = `<input name="prompt" required placeholder="${t("settings.plan.addTaskPlaceholder")}" aria-label="${t("settings.plan.addTaskLabel")}" /><button class="settings-primary-button" type="submit">${t("common.add")}</button>`;
      add.addEventListener("submit", async (event) => {
        event.preventDefault();
        await ui.json("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: window.NestCafe?.getSession?.() || "", prompt: add.elements.prompt.value }),
        });
        await window.NestCafe?.plan?.refresh?.();
        await renderQueue();
      });
      const list = document.createElement("div");
      list.className = "settings-list";
      queue.forEach((task, index) => {
        const row = document.createElement("article");
        row.className = "settings-list-row";
        const copy = document.createElement("div");
        copy.innerHTML = `<strong></strong><span></span>`;
        copy.querySelector("strong").textContent = task.prompt;
        copy.querySelector("span").textContent = t("settings.plan.taskNumber", { number: index + 1 });
        const actions = document.createElement("div");
        const run = ui.button(t("settings.plan.run"), "settings-primary-button");
        run.addEventListener("click", async () => {
          if (queueLaunchPending) return;
          const canStart = () => {
            if (!window.NestCafe?.isRunning?.()) return true;
            window.NestCafe?.toast?.(t("settings.plan.busy"));
            return false;
          };
          if (!canStart()) return;
          queueLaunchPending = true;
          run.disabled = true;
          try {
            const started = await window.NestCafe?.plan?.runScheduled?.(task, task.prompt, { interrupt: false });
            if (started) document.querySelector("#settings-page-dialog")?.close();
          } catch (error) {
            window.NestCafe?.toast?.(error.message);
          } finally {
            queueLaunchPending = false;
            run.disabled = false;
          }
        });
        const remove = ui.button(t("common.delete"), "settings-danger-button");
        remove.addEventListener("click", async () => {
          await ui.json(`/api/tasks?id=${encodeURIComponent(task.id)}`, { method: "DELETE" });
          await window.NestCafe?.plan?.refresh?.();
          await renderQueue();
        });
        actions.append(run, remove);
        row.append(copy, actions);
        list.append(row);
      });
      if (!queue.length) list.append(ui.empty(t("settings.plan.queueEmptyTitle"), t("settings.plan.queueEmptyHint")));
      content.replaceChildren(ui.sectionHeader(t("settings.plan.queueTitle"), t("settings.plan.queueHint")), add, list);
    };

    const switchTab = async (name) => {
      selected = name;
      goalTab.classList.toggle("active", name === "goal");
      queueTab.classList.toggle("active", name === "queue");
      await (name === "goal" ? renderGoal() : renderQueue());
    };
    goalTab.addEventListener("click", () => switchTab("goal"));
    queueTab.addEventListener("click", () => switchTab("queue"));
    root.replaceChildren(
      ui.sectionHeader(t("settings.nav.plan"), t("settings.plan.description")),
      tabs,
      content,
    );
    await switchTab(selected);
  });
})();
