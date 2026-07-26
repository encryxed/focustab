/*
  settings.js — user preferences + the gear-icon panel.

  Right now there's one preference: 12-hour vs 24-hour time. The value is saved
  in localStorage so it sticks. Other widgets (the clock, the reminder picker)
  don't poll for changes — instead they "subscribe" via Settings.onChange(...),
  and whenever a preference changes we call every subscriber. This keeps the
  widgets decoupled: Settings doesn't need to know who cares.
*/

const Settings = {
  KEY: "focustab.settings",
  // timeFormat: "12" | "24".  theme: "system" | "light" | "dark" | "midnight"
  //                                    | "forest" | "rose".
  defaults: { timeFormat: "12", theme: "system" },

  data: null,
  listeners: [],

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.KEY)) || {};
      this.data = { ...this.defaults, ...saved };
    } catch {
      this.data = { ...this.defaults };
    }
    return this.data;
  },

  get(key) {
    if (!this.data) this.load();
    return this.data[key];
  },

  set(key, value) {
    if (!this.data) this.load();
    this.data[key] = value;
    localStorage.setItem(this.KEY, JSON.stringify(this.data));
    this.notify();
  },

  // Widgets register here to be told when a preference changes.
  onChange(fn) {
    this.listeners.push(fn);
  },
  notify() {
    for (const fn of this.listeners) fn(this.data);
  },

  // Put the chosen theme on <html> so the matching CSS block takes over.
  applyTheme() {
    document.documentElement.setAttribute("data-theme", this.get("theme"));
  },

  // ---- the gear panel UI ----
  init() {
    this.load();
    this.applyTheme(); // paint the saved theme right away

    this.gear = document.getElementById("settings-gear");
    this.panel = document.getElementById("settings-panel");
    this.closeBtn = document.getElementById("settings-close");
    this.fmt12 = document.getElementById("fmt-12");
    this.fmt24 = document.getElementById("fmt-24");
    this.themeBtns = Array.from(document.querySelectorAll(".theme-btn"));

    this.gear.addEventListener("click", () => (this.panel.hidden = false));
    this.closeBtn.addEventListener("click", () => (this.panel.hidden = true));

    this.fmt12.addEventListener("click", () => this.set("timeFormat", "12"));
    this.fmt24.addEventListener("click", () => this.set("timeFormat", "24"));

    for (const btn of this.themeBtns) {
      btn.addEventListener("click", () => this.set("theme", btn.dataset.theme));
    }

    // Whenever a preference changes, re-highlight the active buttons and (in
    // case it was the theme) repaint.
    this.onChange(() => {
      this.renderActive();
      this.applyTheme();
    });
    this.renderActive();
  },

  renderActive() {
    const f = this.get("timeFormat");
    this.fmt12.classList.toggle("active", f === "12");
    this.fmt24.classList.toggle("active", f === "24");

    const theme = this.get("theme");
    for (const btn of this.themeBtns) {
      btn.classList.toggle("active", btn.dataset.theme === theme);
    }
  },
};
