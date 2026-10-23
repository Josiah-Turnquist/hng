// Entry point: sets up the page, shows the loading screen and starts the game.
import { App } from './ui/app.js';

const root = document.getElementById('app');

function showError(err) {
  const box = document.createElement('div');
  box.className = 'error-box';
  box.textContent = `Something went wrong:\n${err?.stack || err}`;
  document.body.appendChild(box);
}

window.addEventListener('error', (e) => showError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => showError(e.reason));

const app = new App(root);
window.__app = app; // handy for debugging from the browser console
app.start().catch(showError);
