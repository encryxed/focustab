/*
  app.js — the starter.

  Each widget file above defines an object (Clock, Todo, Quotes) with an init()
  function, but none of them run on their own. This file is the one place that
  starts them all, in one spot, so the flow of the app is easy to follow.

  We wait for the "DOMContentLoaded" event, which fires once the browser has
  finished building the page. Only then is it safe for our code to look for
  elements like #clock — before that, they may not exist yet.
*/

document.addEventListener("DOMContentLoaded", () => {
  Settings.init(); // load preferences first — other widgets read them
  Clock.init();
  Todo.init();
  Quotes.init();
  Remind.init();
  Onboarding.init(); // shows the first-run tour (or nothing if already seen)
});
