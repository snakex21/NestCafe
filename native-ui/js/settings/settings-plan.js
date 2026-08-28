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

  register("plan", "Plan pracy", async (root) => {
    const tabs = document.createElement("div");
    tabs.className = "settings-segmented settings-plan-tabs";
    const goalTab = ui.button("Cel", "active");
    const queueTab = ui.button("Kolejka");
    tabs.append(goalTab, queueTab);
    const content = document.createElement("div");
    content.className = "settings-plan-content";
    let selected = "goal";

    const mutateGoal = async (body) => {
      await postGoal(body);
      await renderGoal();
    };

    const renderGoal = async () => {
      content.replaceChildren(ui.empty("Ładowanie…", "Pobieram aktywny cel."));
      const goal = await ui.json("/api/goal");
      if (!goal) {
        const form = document.createElement("form");
        form.className = "settings-plan-form";
        form.innerHTML = `
          <label><span>Nazwa celu</span><input name="title" required placeholder="Np. uporządkuj dokumenty projektu" /></label>
          <label><span>Co ma powstać</span><textarea name="description" rows="3" placeholder="Krótki opis wyniku"></textarea></label>
          <label><span>Kiedy praca będzie gotowa</span><input name="criteria" placeholder="Warunek zakończenia" /></label>
          <button class="settings-primary-button" type="submit">Utwórz cel</button>`;
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
          ui.sectionHeader("Brak aktywnego celu", "Cel utrzymuje kierunek pracy między rozmowami i pokazuje agentowi otwarte kroki."),
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
      if (!tasks.children.length) tasks.append(ui.empty("Brak kroków", "Dodaj pierwszy krok poniżej."));

      const add = document.createElement("form");
      add.className = "settings-plan-add";
      add.innerHTML = `<input name="task" required placeholder="Dodaj kolejny krok…" /><button class="settings-secondary-button" type="submit">Dodaj</button>`;
      add.addEventListener("submit", async (event) => {
        event.preventDefault();
        const input = add.elements.task;
        await mutateGoal({ action: "add_task", title: input.value });
      });

      const actions = document.createElement("div");
      actions.className = "settings-plan-actions";
      const abandon = ui.button("Porzuć cel", "settings-danger-button");
      let abandonArmed = false;
      abandon.addEventListener("click", () => {
        if (!abandonArmed) {
          abandonArmed = true;
          abandon.textContent = "Kliknij ponownie, aby porzucić";
          setTimeout(() => {
            if (!abandon.isConnected) return;
            abandonArmed = false;
            abandon.textContent = "Porzuć cel";
          }, 4000);
          return;
        }
        mutateGoal({ action: "set_status", status: "abandoned" });
      });
      actions.append(abandon);
      if (goal.ready_for_verification && goal.verification_status !== "passed") {
        const verify = ui.button("Potwierdź wykonanie", "settings-primary-button");
        verify.addEventListener("click", () => mutateGoal({ action: "verify", passed: true, text: "Potwierdzone przez użytkownika w NestCafe." }));
        actions.append(verify);
      } else if (goal.can_finish) {
        const finish = ui.button("Zakończ cel", "settings-primary-button");
        finish.addEventListener("click", () => mutateGoal({ action: "set_status", status: "done" }));
        actions.append(finish);
      }
      const done = (goal.tasks || []).filter((task) => ["done", "skipped"].includes(task.status)).length;
      const summary = document.createElement("section");
      summary.className = "settings-plan-summary";
      summary.innerHTML = `<div><span>AKTYWNY CEL</span><h3></h3><p></p></div><strong></strong>`;
      summary.querySelector("h3").textContent = goal.title;
      summary.querySelector("p").textContent = goal.description || goal.success_criteria || "Bez dodatkowego opisu.";
      summary.querySelector("strong").textContent = `${done}/${(goal.tasks || []).length}`;
      content.replaceChildren(summary, tasks, add, actions);
    };

    const renderQueue = async () => {
      content.replaceChildren(ui.empty("Ładowanie…", "Pobieram kolejkę."));
      const queue = await ui.json("/api/tasks") || [];
      const add = document.createElement("form");
      add.className = "settings-plan-add";
      add.innerHTML = `<input name="prompt" required placeholder="Dodaj zadanie do wykonania później…" /><button class="settings-primary-button" type="submit">Dodaj</button>`;
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
        copy.innerHTML = `<strong></strong><span>Zadanie ${index + 1}</span>`;
        copy.querySelector("strong").textContent = task.prompt;
        const actions = document.createElement("div");
        const run = ui.button("Uruchom", "settings-primary-button");
        run.addEventListener("click", async () => {
          if (task.session_id && task.session_id !== window.NestCafe?.getSession?.()) await window.NestCafe?.resumeSession?.(task.session_id);
          await ui.json(`/api/tasks?id=${encodeURIComponent(task.id)}`, { method: "DELETE" });
          await window.NestCafe?.plan?.refresh?.();
          document.querySelector("#settings-page-dialog")?.close();
          window.NestCafe?.runPrompt?.(task.prompt);
        });
        const remove = ui.button("Usuń", "settings-danger-button");
        remove.addEventListener("click", async () => {
          await ui.json(`/api/tasks?id=${encodeURIComponent(task.id)}`, { method: "DELETE" });
          await window.NestCafe?.plan?.refresh?.();
          await renderQueue();
        });
        actions.append(run, remove);
        row.append(copy, actions);
        list.append(row);
      });
      if (!queue.length) list.append(ui.empty("Kolejka jest pusta", "Dodaj zadanie, które NestCafe wykona później."));
      content.replaceChildren(ui.sectionHeader("Kolejka zadań", "Zadania pozostają zapisane po zamknięciu aplikacji."), add, list);
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
      ui.sectionHeader("Plan pracy", "Cel i kolejka są częścią ustawień pracy, bez osobnego ekranu zasłaniającego rozmowę."),
      tabs,
      content,
    );
    await switchTab(selected);
  });
})();
