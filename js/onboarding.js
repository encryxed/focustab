/*
  onboarding.js — the first-run walkthrough.

  The first time someone opens FocusTab we run a short guided tour: a dimming
  backdrop, a "spotlight" ring around the area being explained, and a card with
  Next / Back / Skip. The final step lets them fire a REAL test reminder so they
  see the popup window and hear the chime.

  We remember that they've seen it with a localStorage flag, so it only appears
  once — but it can be replayed anytime from Settings.

  Note: this builds all DOM with createElement/textContent (never innerHTML with
  dynamic text) — safer, and it keeps the Firefox linter happy.
*/

const Onboarding = {
  KEY: "focustab.onboarded",

  steps: [
    {
      title: "Welcome to FocusTab 👋",
      body: "A calm home base: a clock, a focus list, and reminders for your " +
            "tabs and tasks. It's fully free and open source 💛. " +
            "Want a 20-second tour?",
      primary: "Start tour",
    },
    {
      target: "#settings-gear",
      title: "Make it yours",
      body: "The gear opens Settings — pick a theme (Dark, Midnight, Forest…) " +
            "and 12- or 24-hour time.",
    },
    {
      target: ".remind-widget",
      title: "Remind me about a tab",
      body: "Click any open tab in this list (or drag it into the drop zone), " +
            "then choose when — a preset like “In 1 hour”, or your own day & time.",
    },
    {
      target: ".todo-widget",
      title: "Today's focus",
      body: "Add tasks here. Tap the ⏱ on any task to set a reminder timer for it.",
    },
    {
      title: "You're all set 🎉",
      body: "Try a live reminder right now — you'll see the popup and hear the " +
            "chime. You can replay this tour anytime from ⚙ Settings.",
      primary: "Send a test reminder 🔔",
      isFinal: true,
    },
  ],

  i: 0,

  init() {
    const replay = document.getElementById("replay-tour");
    if (replay) replay.addEventListener("click", () => this.start());

    // First run? Give the widgets a moment to render, then start.
    if (localStorage.getItem(this.KEY) !== "true") {
      setTimeout(() => this.start(), 350);
    }
  },

  start() {
    const panel = document.getElementById("settings-panel");
    if (panel) panel.hidden = true; // close settings if it was open

    this.i = 0;
    this.buildDom();
    this.show();
  },

  buildDom() {
    if (this.backdrop) return;
    this.backdrop = document.createElement("div");
    this.backdrop.className = "tour-backdrop";
    this.card = document.createElement("div");
    this.card.className = "tour-card";
    document.body.append(this.backdrop, this.card);
  },

  show() {
    const step = this.steps[this.i];

    // Move the spotlight to this step's target.
    if (this.highlighted) {
      this.highlighted.classList.remove("tour-target");
      this.highlighted = null;
    }
    if (step.target) {
      const el = document.querySelector(step.target);
      if (el) {
        el.classList.add("tour-target");
        if (el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
        this.highlighted = el;
      }
    }

    this.renderCard(step);
  },

  renderCard(step) {
    const card = this.card;
    card.textContent = ""; // clear

    // Close (×) — same as skipping.
    const close = document.createElement("button");
    close.type = "button";
    close.className = "tour-close";
    close.setAttribute("aria-label", "Skip tour");
    close.textContent = "×";
    close.addEventListener("click", () => this.finish());

    const title = document.createElement("h3");
    title.className = "tour-title";
    title.textContent = step.title;

    const body = document.createElement("p");
    body.className = "tour-body";
    body.textContent = step.body;

    const controls = document.createElement("div");
    controls.className = "tour-controls";

    // Back (not on the first step).
    if (this.i > 0) {
      const back = document.createElement("button");
      back.type = "button";
      back.className = "tour-btn tour-back";
      back.textContent = "Back";
      back.addEventListener("click", () => this.go(this.i - 1));
      controls.appendChild(back);
    }

    const spacer = document.createElement("span");
    spacer.className = "tour-spacer";
    controls.appendChild(spacer);

    // Secondary: Skip (or Finish on the last step).
    const secondary = document.createElement("button");
    secondary.type = "button";
    secondary.className = "tour-btn tour-skip";
    secondary.textContent = step.isFinal ? "Finish" : "Skip";
    secondary.addEventListener("click", () => this.finish());
    controls.appendChild(secondary);

    // Primary: Next / Start / Send test.
    const primary = document.createElement("button");
    primary.type = "button";
    primary.className = "tour-btn tour-primary";
    primary.textContent = step.primary || "Next";
    primary.addEventListener("click", () => {
      if (step.isFinal) this.sendTest();
      else this.go(this.i + 1);
    });
    controls.appendChild(primary);

    // Little "2 / 5" progress hint.
    const progress = document.createElement("span");
    progress.className = "tour-progress";
    progress.textContent = `${this.i + 1} / ${this.steps.length}`;

    card.append(close, title, body, controls, progress);
  },

  go(n) {
    this.i = Math.max(0, Math.min(this.steps.length - 1, n));
    this.show();
  },

  // Fire a real reminder immediately: OS notification + popup window + chime.
  sendTest() {
    this.markDone();

    const api =
      (typeof browser !== "undefined" && browser) ||
      (typeof chrome !== "undefined" && chrome) ||
      null;
    const title = "🎉 Your test reminder — you're ready to focus!";

    if (api && api.windows && api.runtime) {
      if (api.notifications) {
        api.notifications.create("focustab-test", {
          type: "basic",
          iconUrl: api.runtime.getURL("icons/icon-128.png"),
          title: "FocusTab reminder",
          message: title,
        });
      }
      const q = new URLSearchParams({ id: "focustab-test", url: "", title });
      api.windows.create({
        url: api.runtime.getURL("reminder.html") + "?" + q.toString(),
        type: "popup",
        width: 380,
        height: 300,
        focused: true,
      });
    } else {
      // Plain-page preview (no extension APIs).
      alert("Test reminder! Load FocusTab as an extension to see the popup + chime.");
    }

    this.teardown(); // the popup window is the finale; the action popup closes
  },

  finish() {
    this.markDone();
    this.teardown();
  },

  markDone() {
    localStorage.setItem(this.KEY, "true");
  },

  teardown() {
    if (this.highlighted) {
      this.highlighted.classList.remove("tour-target");
      this.highlighted = null;
    }
    if (this.backdrop) { this.backdrop.remove(); this.backdrop = null; }
    if (this.card) { this.card.remove(); this.card = null; }
  },
};
