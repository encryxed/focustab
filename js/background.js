/*
  background.js — the part that runs even when the popup is closed.

  On Chrome this loads as a service worker; on Firefox it loads as an event-page
  script (see the "background" key in manifest.json, which lists both). Either
  way it just reacts to events: an alarm firing, or a notification click.

  Cross-browser note: Firefox exposes the extension APIs as a promise-based
  `browser` object, while Chrome uses `chrome` (also promise-based in MV3). The
  `api` shim below picks whichever exists, so the rest of the file is identical
  on both browsers.

  Flow:
    - When an alarm fires, we look up the matching reminder in storage, show a
      notification, open the popup window, and remove the reminder.
    - We stash the reminder's URL under a "fired" map so a notification click can
      reopen the page even if the worker slept and woke in between.
*/

const api = (typeof browser !== "undefined" && browser) || chrome;

const REMINDERS_KEY = "focustab.reminders"; // scheduled, not yet fired
const FIRED_KEY = "focustab.fired";         // id -> url, waiting to be clicked

// Small helpers around storage.local (promise-based on both browsers).
async function getKey(key) {
  const obj = await api.storage.local.get(key);
  return obj[key];
}
async function setKey(key, value) {
  return api.storage.local.set({ [key]: value });
}

// When a scheduled alarm goes off:
api.alarms.onAlarm.addListener(async (alarm) => {
  const reminders = (await getKey(REMINDERS_KEY)) || [];
  const reminder = reminders.find((r) => r.id === alarm.name);
  if (!reminder) return; // it was cancelled — nothing to do

  // Show the OS notification. We keep the options to the fields BOTH Chrome and
  // Firefox support (Firefox rejects extras like priority/contextMessage).
  api.notifications.create(reminder.id, {
    type: "basic",
    iconUrl: api.runtime.getURL("icons/icon-128.png"),
    title: "FocusTab reminder",
    message: reminder.title || reminder.url,
  });

  // Also open a small popup WINDOW. It shows the reminder, plays a soft chime,
  // and offers an "Open the page" button. (A background script can't play sound
  // itself, so the sound lives in that page.)
  const query = new URLSearchParams({
    id: reminder.id,
    url: reminder.url || "",
    title: reminder.title || reminder.url || "",
  });
  api.windows.create({
    url: api.runtime.getURL("reminder.html") + "?" + query.toString(),
    type: "popup",
    width: 380,
    height: 300,
    focused: true,
  });

  // Remove it from the pending list...
  await setKey(REMINDERS_KEY, reminders.filter((r) => r.id !== reminder.id));

  // ...and remember its URL so a click can reopen it later.
  const fired = (await getKey(FIRED_KEY)) || {};
  fired[reminder.id] = reminder.url;
  await setKey(FIRED_KEY, fired);
});

// If the page is already open in a tab, switch to it; otherwise open it fresh.
async function openOrFocus(targetUrl) {
  if (!targetUrl) return;
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
    if (match.windowId != null) {
      await api.windows.update(match.windowId, { focused: true });
    }
  } else {
    await api.tabs.create({ url: targetUrl });
  }
}

// Clicking the notification opens (or switches to) the page and clears the record.
api.notifications.onClicked.addListener(async (id) => {
  const fired = (await getKey(FIRED_KEY)) || {};
  const url = fired[id];
  if (url) {
    await openOrFocus(url);
    delete fired[id];
    await setKey(FIRED_KEY, fired);
  }
  api.notifications.clear(id);
});
