# 🎯 FocusTab

A calm little dashboard that lives in your browser toolbar. Click the FocusTab
icon and a popup greets you with the time, a short focus list, and a quote for
the day — nothing more, nothing noisy.

> Made by [encryxed](https://github.com/encryxed) · free & open source (MIT)

- 🕒 **Live clock + greeting** that changes with the time of day
- ✅ **Focus list** — a tiny to-do that remembers your tasks, each with an
  optional **⏱ timer** that reminds you (notification + popup + chime)
- 💬 **Quote of the day** — a gentle nudge, rotated daily
- ⏰ **Remind me about a tab** — pick any open tab, choose a time (*In 1 hour ·
  This evening · Tomorrow · or a custom day + 12-hour time*), and when it's due
  FocusTab shows a **notification**, opens a **popup window**, and plays a
  **soft chime**
- ⚙️ **Settings** — a gear menu to switch between **12-hour and 24-hour** time
  (applies to the clock, the presets, and the custom picker)
- 🎨 **Themes** — System, Light, Dark, Midnight, Forest, and Rosé
- 🌗 **System theme** follows your OS light/dark automatically
- 🔒 **Private** — no accounts, no tracking, no servers; everything stays on your
  device

Works in **Chrome, Edge, Brave, Opera, and Firefox**.

### Permissions & why
FocusTab asks for only what the reminder feature needs, and nothing more:

| Permission | Why |
|---|---|
| `tabs` | to list your open tabs so you can drag one in |
| `alarms` | to wake up at the reminder time |
| `notifications` | to show the reminder |
| `storage` | to remember your pending reminders |

> Built with plain HTML, CSS, and JavaScript — no frameworks, no build step.
> If you're learning, the code is small and heavily commented on purpose.

---

## 🚀 Try it

### As a live web page
Open `popup.html` in your browser, or visit the GitHub Pages demo *(enable Pages
in the repo settings, then link it here)*.

### Install in Chrome / Edge / Brave / Opera
1. Download or clone this repo.
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select the `focustab` folder.
5. Click the **FocusTab icon** in the toolbar (pin it from the puzzle-piece menu
   if you don't see it). 🎉

### Install in Firefox (desktop, **v140+**)
1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**
3. Select the `manifest.json` file inside the `focustab` folder.
4. Click the **FocusTab icon** in the toolbar. 🎉
   *(Temporary add-ons are removed when Firefox restarts — that's Firefox's rule
   for unsigned add-ons during development.)*

> **Cross-browser:** the same code runs on Chrome/Edge (service worker) and
> Firefox (event-page script). The JS uses a tiny `api = browser || chrome`
> shim so the promise-based APIs work on both. Validated with `web-ext lint`
> (0 errors).

---

## 🧭 How it works

```
focustab/
├── manifest.json     # extension config: the toolbar popup, permissions, background worker
├── popup.html        # the popup structure
├── css/styles.css    # the look, incl. automatic dark mode
└── js/
    ├── clock.js      # live clock + time-based greeting
    ├── todo.js       # focus list, saved in your browser (localStorage)
    ├── quotes.js     # daily quote, chosen offline from a built-in list
    ├── remind.js     # "remind me about a tab": drag-drop, time picker, scheduling
    ├── background.js # service worker: fires notifications at the reminder time
    └── app.js        # starts the widgets when the popup opens
```

Your name and tasks are stored **only in your browser** via `localStorage`. They
never leave your device.

---

## 🛠️ Ideas for later

- Quick-links / bookmark tiles
- Weather
- Per-reminder choice: auto-reopen the tab vs. just notify

Contributions and suggestions welcome!

## 👤 Author

Made by **[encryxed](https://github.com/encryxed)**.

## 📄 License

[MIT](LICENSE) © encryxed — free to use, change, and share.
