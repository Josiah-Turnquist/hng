// Entry point: sets up the page, shows the loading screen and starts the game.
import { App } from './ui/app.js';
import { reportError } from './net/telemetry.js';

const root = document.getElementById('app');

function showError(err) {
  reportError(err);
  const box = document.createElement('div');
  box.className = 'error-box';
  box.textContent = `Something went wrong:\n${err?.stack || err}`;
  document.body.appendChild(box);
}

window.addEventListener('error', (e) => showError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => showError(e.reason));

function boot(resume = {}) {
  const app = new App(root, resume);
  window.__app = app; // handy for debugging from the browser console
  app.start().catch(showError);
}

// When the page is shown in the claude.ai viewer and a new version of it is
// published, the viewer swaps it in place: hand the battle setup over so the
// player lands back in the same battle instead of the main menu.
const hot = window.claude?.hot;
hot?.snapshot?.(() => window.__app?.snapshot() ?? {});
if (hot?.ready) hot.ready(boot);
else boot(hot?.data ?? {});
