// The sign-in screen, first thing when the game is played from the game
// server (no guests: docs/MULTIPLAYER.md). Played from a file or a page with no
// server (the claude.ai copy), there is no sign-in and the game stays offline.
//
//   const account = await signInScreen(root)    // { user, token } or null (offline)
import { online, session, signIn, signUp } from '../net/auth.js';

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

export async function signInScreen(root) {
  if (!(await online())) return null;
  const already = await session();
  if (already) return already;
  return new Promise((resolve) => {
    const box = el('div', 'si');
    box.innerHTML = `<div class="si-panel">
        <div class="si-brand">HNG<span>Heroes &amp; Generals tribute</span></div>
        <div class="si-tabs"><button data-tab="in" class="on">Sign in</button><button data-tab="up">Create account</button></div>
        <form class="si-form" novalidate>
          <label class="si-name" hidden>Your name in battle<input name="name" autocomplete="nickname" maxlength="24"></label>
          <label>Email<input name="email" type="email" autocomplete="email" required></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" minlength="8" required></label>
          <div class="si-error" role="alert" hidden></div>
          <button class="ready-btn si-go" type="submit">Sign in</button>
        </form>
        <p class="si-note">Online battles need an account, so everyone you meet has a name.</p>
      </div>`;
    root.appendChild(box);
    const form = box.querySelector('form');
    const err = box.querySelector('.si-error');
    const go = box.querySelector('.si-go');
    const pw = form.elements.password;
    let mode = 'in';
    const setMode = (m) => {
      mode = m;
      box.querySelectorAll('.si-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === m));
      box.querySelector('.si-name').hidden = m !== 'up';
      go.textContent = m === 'up' ? 'Create account' : 'Sign in';
      pw.autocomplete = m === 'up' ? 'new-password' : 'current-password';
      err.hidden = true;
    };
    box.querySelectorAll('.si-tabs button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.tab)));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      const name = form.elements.name.value.trim();
      const email = form.elements.email.value.trim();
      const password = pw.value;
      const problem = !/^\S+@\S+\.\S+$/.test(email) ? 'Please enter your email address.' : password.length < 8 ? 'The password needs at least 8 characters.' : mode === 'up' && !name ? 'Please choose your name in battle.' : null;
      if (problem) {
        err.textContent = problem;
        err.hidden = false;
        return;
      }
      go.disabled = true;
      go.textContent = mode === 'up' ? 'Creating your account...' : 'Signing in...';
      try {
        const s = mode === 'up' ? await signUp(name, email, password) : await signIn(email, password);
        if (!s) throw new Error(mode === 'up' ? 'Your account was made, but signing in failed. Try signing in.' : 'Signing in failed. Try again.');
        box.remove();
        resolve(s);
      } catch (e2) {
        go.disabled = false;
        go.textContent = mode === 'up' ? 'Create account' : 'Sign in';
        err.textContent = e2.message;
        err.hidden = false;
      }
    });
    form.elements.email.focus();
  });
}
