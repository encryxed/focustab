/*
  remind.js — "Remind me about a tab".

  The flow:
    1. We list your open tabs as draggable cards.
    2. You drag a card onto the drop zone. It glows, then the card "clicks in"
       with a little animation.
    3. A time picker slides up: pick a preset (In 1 hour, This evening, …) or a
       custom date & time.
    4. We save the reminder and set a browser alarm. When the time comes, the
       background script (js/background.js) shows a notification.

  About "Ext": this same page can also be opened as a plain file for previewing
  the design. In that case the extension APIs (chrome.tabs, chrome.alarms, …)
  don't exist, so Ext falls back to a few demo tabs and stores reminders in
  localStorage. That way the animation and picker are fully testable without
  installing anything.
*/

// Cross-browser: Firefox uses `browser` (promises), Chrome uses `chrome`
// (promises in MV3). On a plain web page neither exists, so this is null and we
// fall back to demo data.
const api =
  (typeof browser !== "undefined" && browser) ||
  (typeof chrome !== "undefined" && chrome) ||
  null;

// A thin layer over the browser-extension APIs, with graceful fallbacks so the
// popup still works when opened as a normal web page.
const Ext = {
  hasTabs: !!(api && api.tabs && api.tabs.query),
  hasStorage: !!(api && api.storage && api.storage.local),
  hasAlarms: !!(api && api.alarms && api.alarms.create),

  // Return the open tabs as simple {title, url, favIconUrl} objects.
  async listTabs() {
    if (this.hasTabs) {
      const tabs = await api.tabs.query({ currentWindow: true });
      return tabs
        .filter((t) => t.url && /^https?:/.test(t.url)) // real web pages only
        .map((t) => ({ title: t.title || t.url, url: t.url, favIconUrl: t.favIconUrl || "" }));
    }
    // Demo data for plain-page previews.
    return [
      { title: "GitHub — where the world builds software", url: "https://github.com", favIconUrl: "" },
      { title: "Hacker News", url: "https://news.ycombinator.com", favIconUrl: "" },
      { title: "MDN Web Docs", url: "https://developer.mozilla.org", favIconUrl: "" },
    ];
  },
};

// Reminders are stored so the background script can read them. Prefer
// chrome.storage.local (shared with the background worker); fall back to
// localStorage for plain-page previews.
const ReminderStore = {
  KEY: "focustab.reminders",

  async getAll() {
    if (Ext.hasStorage) {
      const obj = await api.storage.local.get(this.KEY);
      return obj[this.KEY] || [];
    }
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch {
      return [];
    }
  },

  async setAll(list) {
    if (Ext.hasStorage) return api.storage.local.set({ [this.KEY]: list });
    localStorage.setItem(this.KEY, JSON.stringify(list));
  },
};

const Remind = {
  init() {
    this.dropZone = document.getElementById("drop-zone");
    this.tabListEl = document.getElementById("tab-list");
    this.picker = document.getElementById("time-picker");
    this.pickerTitle = document.getElementById("picker-tab-title");
    this.presetGrid = document.getElementById("preset-grid");
    this.dayInput = document.getElementById("day-input");
    this.hourInput = document.getElementById("hour-input");
    this.minInput = document.getElementById("min-input");
    this.amBtn = document.getElementById("am-btn");
    this.pmBtn = document.getElementById("pm-btn");
    this.ampmToggle = document.getElementById("ampm-toggle");
    this.ampm = "AM";
    this.customSet = document.getElementById("custom-set");
    this.cancelBtn = document.getElementById("picker-cancel");
    this.reminderListEl = document.getElementById("reminder-list");

    this.dragging = null;   // the tab currently being dragged
    this.pendingTab = null; // the tab awaiting a chosen time

    this.setupDropZone();
    this.setupPicker();
    this.renderTabs();
    this.renderReminders();
  },

  // ---------- Tab cards ----------

  async renderTabs() {
    const tabs = await Ext.listTabs();
    this.tabListEl.innerHTML = "";

    for (const tab of tabs) {
      const li = document.createElement("li");
      li.className = "tab-card";
      li.draggable = true;

      const icon = document.createElement("img");
      icon.className = "tab-favicon";
      icon.alt = "";
      if (tab.favIconUrl) icon.src = tab.favIconUrl;

      const title = document.createElement("span");
      title.className = "tab-title";
      title.textContent = tab.title;

      // A little clock affordance so it's obvious a tab is clickable.
      const cue = document.createElement("span");
      cue.className = "tab-cue";
      cue.textContent = "⏰";

      li.append(icon, title, cue);

      // Easiest path: just click a tab to pick a reminder time — no dragging.
      li.addEventListener("click", () => this.openPicker(tab));

      // Bonus path: drag the card into the drop zone (both live inside the
      // popup, so nothing closes). When the drag starts, remember which tab.
      li.addEventListener("dragstart", (e) => {
        this.dragging = tab;
        li.classList.add("dragging");
        // Some browsers require data to be set for a drag to begin.
        e.dataTransfer.setData("text/plain", tab.url);
        e.dataTransfer.effectAllowed = "move";
      });
      li.addEventListener("dragend", () => {
        li.classList.remove("dragging");
        this.dragging = null;
      });

      this.tabListEl.appendChild(li);
    }

    if (tabs.length === 0) {
      const empty = document.createElement("li");
      empty.className = "tab-empty";
      empty.textContent =
        "Open a website in another tab (like github.com), then reopen " +
        "FocusTab. Browser pages such as chrome:// can't be reminded about.";
      this.tabListEl.appendChild(empty);
    }
  },

  // ---------- Drop zone ----------

  setupDropZone() {
    const zone = this.dropZone;

    // dragover must call preventDefault, otherwise "drop" never fires.
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("drag-over");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      if (!this.dragging) return;

      // Play the satisfying "click into place" animation, then open the picker.
      zone.classList.remove("landed");
      void zone.offsetWidth; // force a reflow so the animation can replay
      zone.classList.add("landed");

      this.openPicker(this.dragging);
    });
  },

  // ---------- Time picker ----------

  setupPicker() {
    this.renderPresets();

    // AM / PM toggle (only used in 12-hour mode).
    this.amBtn.addEventListener("click", () => this.setAmpm("AM"));
    this.pmBtn.addEventListener("click", () => this.setAmpm("PM"));

    // Keep the typed fields tidy AS YOU TYPE: digits only, capped length, and
    // never above the maximum. The hour maximum depends on the time format
    // (12 vs 23), so we read this.hourMax which applyTimeFormat sets.
    this.hourInput.addEventListener("input", () => {
      this.hourInput.value = this.clampField(this.hourInput.value, 2, this.hourMax);
    });
    this.minInput.addEventListener("input", () => {
      this.minInput.value = this.clampField(this.minInput.value, 2, 59);
    });
    this.dayInput.addEventListener("input", () => {
      this.dayInput.value = this.clampField(this.dayInput.value, 3, 365);
    });

    this.customSet.addEventListener("click", () => {
      const when = this.computeCustomWhen();
      if (when <= Date.now()) {
        alert("That time is in the past — pick a later time or add a day.");
        return;
      }
      this.schedule(this.pendingTab, when);
    });

    this.cancelBtn.addEventListener("click", () => this.closePicker());

    // Apply the current time format now, and again whenever it changes.
    this.applyTimeFormat();
    if (typeof Settings !== "undefined") {
      Settings.onChange(() => {
        this.applyTimeFormat();
        this.renderPresets();
        this.renderReminders();
      });
    }
  },

  // (Re)build the preset buttons. Called again on a format change so their
  // "Today 5:19 PM" style labels follow the 12/24-hour preference.
  renderPresets() {
    this.presetGrid.innerHTML = "";
    for (const preset of this.presets()) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset";

      // Build the two lines with textContent (safe) instead of innerHTML.
      const label = document.createElement("span");
      label.className = "preset-label";
      label.textContent = preset.label;

      const when = document.createElement("span");
      when.className = "preset-when";
      when.textContent = this.formatWhen(preset.when);

      btn.append(label, when);
      btn.addEventListener("click", () => this.schedule(this.pendingTab, preset.when));
      this.presetGrid.appendChild(btn);
    }
  },

  // Reshape the custom time inputs for the current 12/24-hour preference.
  applyTimeFormat() {
    this.timeFormat =
      typeof Settings !== "undefined" ? Settings.get("timeFormat") : "12";
    const is24 = this.timeFormat === "24";

    this.hourMax = is24 ? 23 : 12;
    this.ampmToggle.hidden = is24;          // hide AM/PM in 24-hour mode
    this.hourInput.min = is24 ? 0 : 1;
    this.hourInput.max = this.hourMax;

    this.prefillNow();
  },

  // Pre-fill the inputs with the current local time, in whichever format.
  prefillNow() {
    const now = new Date();
    const h = now.getHours();
    if (this.timeFormat === "24") {
      this.hourInput.value = h;             // 0–23 as-is
    } else {
      this.hourInput.value = h % 12 === 0 ? 12 : h % 12;
      this.setAmpm(h >= 12 ? "PM" : "AM");
    }
    this.minInput.value = now.getMinutes();
  },

  // Turn whatever was typed into "digits only, at most maxLen chars, not above
  // maxVal". Returns a string so an empty field stays empty while editing.
  clampField(value, maxLen, maxVal) {
    let v = String(value).replace(/\D/g, "").slice(0, maxLen);
    if (v !== "" && parseInt(v, 10) > maxVal) v = String(maxVal);
    return v;
  },

  setAmpm(period) {
    this.ampm = period;
    this.amBtn.classList.toggle("active", period === "AM");
    this.pmBtn.classList.toggle("active", period === "PM");
  },

  // Read the typed day/time inputs and turn them into a timestamp. Values are
  // clamped so typos (like "99") can't produce a nonsense time.
  computeCustomWhen() {
    const days = Math.max(0, parseInt(this.dayInput.value, 10) || 0);

    let min = parseInt(this.minInput.value, 10);
    if (isNaN(min)) min = 0;
    min = Math.min(59, Math.max(0, min));

    let hour24;
    if (this.timeFormat === "24") {
      // Typed directly as 0–23.
      hour24 = parseInt(this.hourInput.value, 10);
      if (isNaN(hour24)) hour24 = 0;
      hour24 = Math.min(23, Math.max(0, hour24));
    } else {
      // 12-hour → 24-hour: 12 wraps to 0, then PM adds 12.
      let hour12 = parseInt(this.hourInput.value, 10);
      if (isNaN(hour12)) hour12 = 12;
      hour12 = Math.min(12, Math.max(1, hour12));
      hour24 = hour12 % 12;
      if (this.ampm === "PM") hour24 += 12;
    }

    const when = new Date();
    when.setDate(when.getDate() + days);
    when.setHours(hour24, min, 0, 0);
    return when.getTime();
  },

  openPicker(tab) {
    this.pendingTab = tab;
    this.pickerTitle.textContent = " " + tab.title;
    this.picker.hidden = false;
  },

  closePicker() {
    this.picker.hidden = true;
    this.pendingTab = null;
    this.dropZone.classList.remove("landed");
  },

  // The preset reminder times, computed from "now".
  presets() {
    const now = new Date();

    // "This evening" = 6pm today, or 6pm tomorrow if it's already past.
    const evening = new Date(now);
    evening.setHours(18, 0, 0, 0);
    if (evening <= now) evening.setDate(evening.getDate() + 1);

    // "Tomorrow morning" = 9am tomorrow.
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    // "This weekend" = 9am on the coming Saturday.
    const weekend = new Date(now);
    weekend.setHours(9, 0, 0, 0);
    const daysToSat = (6 - weekend.getDay() + 7) % 7 || 7;
    weekend.setDate(weekend.getDate() + daysToSat);

    return [
      { label: "In 1 hour", when: now.getTime() + 60 * 60 * 1000 },
      { label: "In 3 hours", when: now.getTime() + 3 * 60 * 60 * 1000 },
      { label: "This evening", when: evening.getTime() },
      { label: "Tomorrow 9am", when: tomorrow.getTime() },
      { label: "This weekend", when: weekend.getTime() },
      { label: "Next week", when: now.getTime() + 7 * 24 * 60 * 60 * 1000 },
    ];
  },

  // ---------- Scheduling ----------

  async schedule(tab, whenMs) {
    if (!tab) return;

    const reminder = {
      id: "r" + Date.now(),
      type: "tab",
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl || "",
      when: whenMs,
    };

    const all = await ReminderStore.getAll();
    all.push(reminder);
    await ReminderStore.setAll(all);

    // Ask the browser to wake our background script at the chosen time.
    if (Ext.hasAlarms) api.alarms.create(reminder.id, { when: whenMs });

    this.closePicker();
    this.renderReminders();
  },

  async removeReminder(id) {
    const all = await ReminderStore.getAll();
    await ReminderStore.setAll(all.filter((r) => r.id !== id));
    if (Ext.hasAlarms) api.alarms.clear(id);
    this.renderReminders();
  },

  async renderReminders() {
    // Only tab reminders belong in this list; task timers live on their tasks.
    const all = (await ReminderStore.getAll())
      .filter((r) => r.type !== "task")
      .sort((a, b) => a.when - b.when);
    this.reminderListEl.innerHTML = "";

    for (const r of all) {
      const li = document.createElement("li");
      li.className = "reminder-item";

      const text = document.createElement("span");
      text.className = "reminder-text";
      text.textContent = r.title;
      text.title = r.url;

      const when = document.createElement("span");
      when.className = "reminder-when";
      when.textContent = this.formatWhen(r.when);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "reminder-del";
      del.setAttribute("aria-label", "Cancel reminder");
      del.textContent = "×";
      del.addEventListener("click", () => this.removeReminder(r.id));

      li.append(text, when, del);
      this.reminderListEl.appendChild(li);
    }
  },

  // Turn a timestamp into a short friendly label like "Today 18:00" or
  // "Sat 09:00".
  formatWhen(ms) {
    const d = new Date(ms);
    const now = new Date();
    const use24 = typeof Settings !== "undefined" && Settings.get("timeFormat") === "24";
    const time = use24
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
      : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });

    const sameDay = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    if (sameDay) return `Today ${time}`;
    if (isTomorrow) return `Tomorrow ${time}`;
    const day = d.toLocaleDateString([], { weekday: "short" });
    return `${day} ${time}`;
  },
};
