/*
  todo.js — the focus / to-do list, now with a per-task timer.

  The big idea here is "single source of truth":
  - `this.items` is an array that holds the REAL state of the list.
  - Every change (add / toggle / delete / clear / set-timer) updates that array,
    saves it, then calls render() to rebuild the visible list from scratch.

  A task item looks like:
    { id, text, done, remindAt?: number, reminderId?: string }

  The timer reuses the SAME machinery as the tab reminders (see remind.js):
  ReminderStore holds the pending reminders, and the background script fires the
  notification + popup + chime when the time comes. Here we just add a reminder
  of type "task" (no URL). Sharing that pipeline means we didn't have to rebuild
  alarms, sounds, or notifications.
*/

const Todo = {
  STORAGE_KEY: "focustab.todos",

  init() {
    this.items = this.load();
    this.timerOpenFor = null; // id of the task whose timer picker is open

    this.form = document.getElementById("todo-form");
    this.input = document.getElementById("todo-input");
    this.listEl = document.getElementById("todo-list");
    this.countEl = document.getElementById("todo-count");
    this.clearBtn = document.getElementById("todo-clear");

    this.form.addEventListener("submit", (e) => {
      e.preventDefault();            // stop the page from reloading
      this.add(this.input.value);
      this.input.value = "";         // clear the box for the next task
    });

    this.clearBtn.addEventListener("click", () => this.clearCompleted());

    this.save();  // persist any timer cleanup that load() did
    this.render();
  },

  // ---- Data operations (each one changes state, saves, re-renders) ----

  add(text) {
    const trimmed = text.trim();
    if (!trimmed) return;            // ignore empty input
    this.items.push({
      id: Date.now(),               // a simple unique-enough id
      text: trimmed,
      done: false,
    });
    this.save();
    this.render();
  },

  toggle(id) {
    const item = this.items.find((t) => t.id === id);
    if (item) item.done = !item.done;
    this.save();
    this.render();
  },

  remove(id) {
    const item = this.items.find((t) => t.id === id);
    if (item && item.reminderId) this.cancelTimer(item); // tidy up its alarm
    this.items = this.items.filter((t) => t.id !== id);
    this.save();
    this.render();
  },

  clearCompleted() {
    for (const t of this.items) if (t.done && t.reminderId) this.cancelTimer(t);
    this.items = this.items.filter((t) => !t.done);
    this.save();
    this.render();
  },

  // ---- Timers (reuse the reminder pipeline from remind.js) ----

  async setTimer(item, minutes) {
    const when = Date.now() + minutes * 60000;
    const reminder = { id: "t" + Date.now(), type: "task", title: item.text, url: "", when };

    try {
      const all = await ReminderStore.getAll();
      all.push(reminder);
      await ReminderStore.setAll(all);
      if (typeof Ext !== "undefined" && Ext.hasAlarms) {
        api.alarms.create(reminder.id, { when });
      }
    } catch {
      /* storage/alarms unavailable (e.g. plain-page preview) — badge still shows */
    }

    item.remindAt = when;
    item.reminderId = reminder.id;
    this.timerOpenFor = null;
    this.save();
    this.render();
  },

  async cancelTimer(item) {
    try {
      if (item.reminderId) {
        const all = await ReminderStore.getAll();
        await ReminderStore.setAll(all.filter((r) => r.id !== item.reminderId));
        if (typeof Ext !== "undefined" && Ext.hasAlarms) api.alarms.clear(item.reminderId);
      }
    } catch {
      /* ignore */
    }
    delete item.remindAt;
    delete item.reminderId;
    this.save();
    this.render();
  },

  // ---- Persistence ----

  load() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      const items = raw ? JSON.parse(raw) : [];
      // Drop timers that have already elapsed — the notification already fired,
      // so the badge would just be stale.
      const now = Date.now();
      for (const it of items) {
        if (it.remindAt && it.remindAt <= now) {
          delete it.remindAt;
          delete it.reminderId;
        }
      }
      return items;
    } catch {
      return []; // corrupted data → start fresh instead of crashing
    }
  },

  save() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.items));
  },

  // ---- Rendering (turn the state array into HTML elements) ----

  render() {
    this.listEl.innerHTML = ""; // wipe the old list

    for (const item of this.items) {
      this.listEl.appendChild(this.rowFor(item));
      // Show the duration picker right under the task it belongs to.
      if (this.timerOpenFor === item.id && !item.remindAt) {
        this.listEl.appendChild(this.timerPickerFor(item));
      }
    }

    this.renderFooter();
  },

  // Build one <li> row for a single task.
  rowFor(item) {
    const li = document.createElement("li");
    li.className = "todo-item" + (item.done ? " done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.done;
    checkbox.addEventListener("change", () => this.toggle(item.id));

    const span = document.createElement("span");
    span.className = "todo-text";
    span.textContent = item.text; // textContent = safe, shown literally

    // Timer control: a pill if a reminder is set (click to cancel), otherwise a
    // small ⏱ button (click to choose a duration).
    let timerEl;
    if (item.remindAt) {
      timerEl = document.createElement("button");
      timerEl.type = "button";
      timerEl.className = "todo-remind-badge";
      timerEl.title = "Reminder set — click to cancel";
      timerEl.textContent = "⏰ " + this.formatClock(item.remindAt);
      timerEl.addEventListener("click", () => this.cancelTimer(item));
    } else {
      timerEl = document.createElement("button");
      timerEl.type = "button";
      timerEl.className = "todo-timer";
      timerEl.title = "Set a reminder timer";
      timerEl.textContent = "⏱";
      timerEl.addEventListener("click", () => {
        this.timerOpenFor = this.timerOpenFor === item.id ? null : item.id;
        this.render();
      });
    }

    const del = document.createElement("button");
    del.type = "button";
    del.className = "todo-delete";
    del.setAttribute("aria-label", "Delete task");
    del.textContent = "×";
    del.addEventListener("click", () => this.remove(item.id));

    li.append(checkbox, span, timerEl, del);
    return li;
  },

  // The little "remind me in…" picker shown under a task.
  timerPickerFor(item) {
    const wrap = document.createElement("li");
    wrap.className = "timer-picker";

    const label = document.createElement("span");
    label.className = "timer-picker-label";
    label.textContent = "Remind me in";

    const quick = document.createElement("div");
    quick.className = "timer-quick";
    for (const [mins, lbl] of [[5, "5m"], [15, "15m"], [25, "25m"], [60, "1h"]]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "timer-q-btn";
      b.textContent = lbl;
      b.addEventListener("click", () => this.setTimer(item, mins));
      quick.appendChild(b);
    }

    const custom = document.createElement("div");
    custom.className = "timer-custom";
    const num = document.createElement("input");
    num.type = "number";
    num.min = "1";
    num.max = "1440";
    num.className = "timer-num";
    num.placeholder = "min";
    num.addEventListener("input", () => {
      num.value = num.value.replace(/\D/g, "").slice(0, 4);
    });
    const set = document.createElement("button");
    set.type = "button";
    set.className = "timer-set";
    set.textContent = "Set";
    set.addEventListener("click", () => {
      const m = parseInt(num.value, 10);
      if (m > 0) this.setTimer(item, m);
    });

    custom.append(num, set);
    wrap.append(label, quick, custom);
    return wrap;
  },

  // Format a timestamp as a clock time, honoring the 12/24-hour setting.
  formatClock(ts) {
    const d = new Date(ts);
    const use24 =
      typeof Settings !== "undefined" && Settings.get("timeFormat") === "24";
    return d.toLocaleTimeString(
      [],
      use24
        ? { hour: "2-digit", minute: "2-digit", hour12: false }
        : { hour: "numeric", minute: "2-digit", hour12: true }
    );
  },

  renderFooter() {
    const remaining = this.items.filter((t) => !t.done).length;
    const hasCompleted = this.items.some((t) => t.done);

    if (this.items.length === 0) {
      this.countEl.textContent = "Nothing yet — add your first task.";
    } else {
      this.countEl.textContent =
        `${remaining} ${remaining === 1 ? "task" : "tasks"} left`;
    }

    this.clearBtn.style.visibility = hasCompleted ? "visible" : "hidden";
  },
};
