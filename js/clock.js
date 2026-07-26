/*
  clock.js — the live clock and the time-aware greeting.

  Concepts introduced here:
  - document.getElementById(...) finds an element on the page by its id.
  - new Date() gives the current date and time.
  - setInterval(fn, 1000) runs fn once every 1000 milliseconds (1 second).

  We wrap everything in an object called `Clock` with an init() function.
  app.js will call Clock.init() once the page is ready. Grouping code like this
  keeps each widget self-contained and avoids leaking variables into the page.
*/

const Clock = {
  // Where we remember the user's name in the browser.
  NAME_KEY: "focustab.name",

  init() {
    this.clockEl = document.getElementById("clock");
    this.greetingEl = document.getElementById("greeting-text");
    this.nameEl = document.getElementById("name");

    this.renderName();
    this.tick();                     // draw immediately so there's no blank second
    setInterval(() => this.tick(), 1000); // then update every second

    // Redraw immediately when the 12/24-hour preference changes.
    Settings.onChange(() => this.tick());

    // Let the user click (or press Enter on) their name to change it.
    this.nameEl.addEventListener("click", () => this.editName());
    this.nameEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.editName();
    });
  },

  // Runs every second: updates the time and the greeting.
  tick() {
    const now = new Date();
    this.clockEl.textContent = this.formatTime(now);
    this.greetingEl.textContent = this.greetingFor(now.getHours());
  },

  // Turn a Date into local time, honoring the 12/24-hour preference. getHours()
  // is already in the user's own timezone, so this is always their local time.
  formatTime(date) {
    const minutes = String(date.getMinutes()).padStart(2, "0");

    if (Settings.get("timeFormat") === "24") {
      // 24-hour: continuous 00:00 → 23:59, zero-padded, no AM/PM.
      const hours = String(date.getHours()).padStart(2, "0");
      return `${hours}:${minutes}`;
    }

    // 12-hour: 1–12 with an AM/PM suffix.
    let hours = date.getHours() % 12;
    if (hours === 0) hours = 12; // midnight/noon show as 12, not 0
    const period = date.getHours() >= 12 ? "PM" : "AM";
    return `${hours}:${minutes} ${period}`;
  },

  // Pick a greeting based on the hour of the day (0–23).
  greetingFor(hour) {
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  },

  // Read the saved name, or fall back to "friend" the first time.
  renderName() {
    const saved = localStorage.getItem(this.NAME_KEY);
    this.nameEl.textContent = saved && saved.trim() ? saved : "friend";
  },

  // Ask for a new name and save it. prompt() is a simple built-in dialog —
  // fine for a small personal tool like this.
  editName() {
    const current = localStorage.getItem(this.NAME_KEY) || "";
    const next = window.prompt("What should I call you?", current);
    if (next === null) return;       // user hit Cancel
    const trimmed = next.trim();
    if (trimmed) {
      localStorage.setItem(this.NAME_KEY, trimmed);
    } else {
      localStorage.removeItem(this.NAME_KEY); // empty name → back to "friend"
    }
    this.renderName();
  },
};
