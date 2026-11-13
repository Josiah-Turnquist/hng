// A tab left open across an update goes on running the old game: nothing in
// the page changes until it is loaded again. So the page asks the server now
// and then which version it is serving (the commit it was built from,
// /api/config), and when that is no longer the one this page was loaded from
// it says so, with a button to load the new one.
//
// Asked every five minutes, and whenever the tab is looked at again after
// being in the background. Shown only while the mouse is free (menus, the
// pause menu, the deploy screen), never over the fighting.
import { serverConfig } from '../net/auth.js';

const EVERY = 5 * 60 * 1000;
const LATER = 30 * 60 * 1000;

// Is `now` a newer copy than the one the page was loaded from? (Unknown
// versions, and a copy run from a folder, never count.)
export function versionChanged(loaded, now) {
  const known = (v) => typeof v === 'string' && v !== '' && v !== 'local';
  return known(loaded) && known(now) && loaded !== now;
}

// Keeps asking; calls onChange(version) once when the server's version is no
// longer the page's. ask: () => Promise<version or null>. Returns { check, stop }.
export function watchVersion({ ask, onChange, every = EVERY, timer = setInterval, clear = clearInterval }) {
  let loaded = null;
  let told = false;
  let busy = false;
  const check = async () => {
    if (told || busy) return false;
    busy = true;
    let now = null;
    try {
      now = await ask();
    } catch {
      now = null;
    }
    busy = false;
    if (loaded === null) {
      // The first answer is the copy this page is.
      if (typeof now === 'string' && now) loaded = now;
      return false;
    }
    if (!versionChanged(loaded, now)) return false;
    told = true;
    onChange(now);
    return true;
  };
  const id = timer(check, every);
  check();
  return { check, stop: () => clear(id) };
}

// The notice itself: a small bar at the top of the page.
export function startUpdateNotice(root = document.body) {
  let bar = null;
  let hideUntil = 0;
  const show = () => {
    if (!bar) return;
    bar.hidden = !!document.pointerLockElement || Date.now() < hideUntil;
  };
  const watch = watchVersion({
    ask: async () => (await serverConfig())?.version ?? null,
    onChange: () => {
      bar = document.createElement('div');
      bar.className = 'upd';
      bar.innerHTML = '<span>A new version of the game is out.</span><button class="upd-go">Reload</button><button class="upd-later">Later</button>';
      bar.querySelector('.upd-go').addEventListener('click', () => location.reload());
      bar.querySelector('.upd-later').addEventListener('click', () => {
        hideUntil = Date.now() + LATER;
        show();
        setTimeout(show, LATER + 1000);
      });
      root.appendChild(bar);
      show();
    },
  });
  document.addEventListener('pointerlockchange', show);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') watch.check();
  });
  return watch;
}
