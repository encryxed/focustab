/*
  reminder-alert.js — runs inside the reminder popup window.

  It does three things:
    1. Reads the reminder details from the URL (the background worker put them
       there when it opened this window).
    2. Plays a soft two-note chime using the Web Audio API — no sound file
       needed, so we stay fully offline.
    3. Wires up "Open the page" (reopens the tab) and "Dismiss" (just closes).
*/

// Cross-browser API handle (Firefox `browser`, Chrome `chrome`).
const api =
  (typeof browser !== "undefined" && browser) ||
  (typeof chrome !== "undefined" && chrome) ||
  null;

// Match the user's chosen theme (this window doesn't have the settings panel,
// so we just load the saved preference and apply it).
if (typeof Settings !== "undefined") {
  Settings.load();
  Settings.applyTheme();
}

const params = new URLSearchParams(location.search);
const reminderId = params.get("id") || "";
const url = params.get("url") || "";
const title = params.get("title") || "your tab";

// --- fill in the content ---
document.getElementById("alert-title").textContent = title;
const favicon = document.getElementById("alert-favicon");
if (url) {
  // A reliable favicon without extra permissions: derive it from the domain.
  try {
    favicon.src = new URL(url).origin + "/favicon.ico";
  } catch {
    favicon.style.display = "none";
  }
} else {
  favicon.style.display = "none";
}
favicon.addEventListener("error", () => (favicon.style.display = "none"));

// Task timers have no URL — there's nothing to open, so tweak the wording and
// hide the "Open the page" button (Dismiss is enough).
if (!url) {
  document.querySelector(".alert-heading").textContent = "Task reminder";
  document.getElementById("alert-open").style.display = "none";
}

// --- the soft chime ---
// A gentle E5 → B5 with a slow fade, kept quiet on purpose.
function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();

    const ring = (freq, startOffset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + startOffset;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.04);       // soft attack
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1); // long, gentle tail
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.2);
    };

    ring(659.25, 0);     // E5
    ring(987.77, 0.18);  // B5

    // Browsers may start audio "suspended" until a user gesture. If so, resume
    // it the moment the user interacts with the window.
    if (ctx.state === "suspended") {
      const resume = () => {
        ctx.resume();
        window.removeEventListener("click", resume);
        window.removeEventListener("keydown", resume);
      };
      window.addEventListener("click", resume);
      window.addEventListener("keydown", resume);
    }
  } catch {
    /* no audio available — the popup + notification still work */
  }
}
playChime();

// --- clear this reminder's "fired" record so it can't be double-opened ---
async function clearFired() {
  if (!api || !api.storage) return;
  const KEY = "focustab.fired";
  const obj = await api.storage.local.get(KEY);
  const fired = obj[KEY] || {};
  delete fired[reminderId];
  await api.storage.local.set({ [KEY]: fired });
}

// If the page is already open in a tab, switch to it; otherwise open it fresh.
async function openOrFocus(targetUrl) {
  if (!targetUrl) return;
  if (!api || !api.tabs) {
    window.open(targetUrl, "_blank");
    return;
  }
  // Compare URLs ignoring a trailing slash and the #hash, so tiny differences
  // still count as "the same page".
  const norm = (u) => {
    try {
      const x = new URL(u);
      return x.origin + x.pathname.replace(/\/$/, "") + x.search;
    } catch {
      return u;
    }
  };
  const tabs = await api.tabs.query({});
  const match = tabs.find((t) => t.url && norm(t.url) === norm(targetUrl));

  if (match) {
    await api.tabs.update(match.id, { active: true });
    if (api.windows && match.windowId != null) {
      await api.windows.update(match.windowId, { focused: true });
    }
  } else {
    await api.tabs.create({ url: targetUrl });
  }
}

// --- buttons ---
document.getElementById("alert-open").addEventListener("click", async () => {
  await openOrFocus(url);
  await clearFired();
  window.close();
});

document.getElementById("alert-dismiss").addEventListener("click", async () => {
  await clearFired();
  window.close();
});
