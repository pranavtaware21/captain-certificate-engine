/* Access gate.
 *
 * IMPORTANT, so nobody is misled by it: this is a speed bump, not security.
 * The page is static and public, so the check runs in the visitor's own
 * browser and anyone willing to open DevTools can walk straight past it. What
 * it does do is stop a stranger who lands on the URL from using the tool, and
 * it keeps the number out of the source: only a PBKDF2 hash is stored here,
 * never the credentials themselves.
 *
 * For a gate that actually holds, see HOSTING.md (Cloudflare Access).
 */

const SALT_HEX = '5bde82606b9a0d1c137e16e125073525';
const HASH_HEX = 'ae59633d22a2a7b1078f51650ea3848c123e5d0cca8c753fb5402ded6f344841';
const ITERATIONS = 210000;
const STORE_KEY = 'cce.unlocked.v1';

const $ = (id) => document.getElementById(id);
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const bytes = (h) => new Uint8Array(h.match(/../g).map((b) => parseInt(b, 16)));

/** Last 10 digits, so a "+91 " prefix or a leading 0 makes no difference. */
const digits = (s) => String(s || '').replace(/\D/g, '').slice(-10);

async function derive(mobile, code) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(`${digits(mobile)}:${String(code).trim()}`),
    'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: bytes(SALT_HEX), iterations: ITERATIONS, hash: 'SHA-256' },
    key, 256,
  );
  return hex(bits);
}

function unlock() {
  try { localStorage.setItem(STORE_KEY, HASH_HEX); } catch { /* private window */ }
  document.body.classList.remove('locked');
  $('gate').remove();
  window.dispatchEvent(new Event('cce:unlocked'));
}

function alreadyUnlocked() {
  if (new URLSearchParams(location.search).has('lock')) {
    try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
    return false;
  }
  try { return localStorage.getItem(STORE_KEY) === HASH_HEX; } catch { return false; }
}

export function guard() {
  if (alreadyUnlocked()) {
    document.body.classList.remove('locked');
    $('gate')?.remove();
    return Promise.resolve();
  }

  document.body.classList.add('locked');
  const gate = $('gate');
  gate.hidden = false;

  const form = $('gateForm');
  const msg = $('gateMsg');
  const btn = $('gateBtn');
  let tries = 0;

  $('gateMobile').focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (btn.disabled) return;

    const mobile = $('gateMobile').value;
    const code = $('gateCode').value;
    if (digits(mobile).length !== 10 || !/^\d{4}$/.test(code.trim())) {
      msg.textContent = 'A 10-digit mobile number and the 4-digit code.';
      msg.className = 'gateMsg bad';
      return;
    }

    btn.disabled = true;
    msg.textContent = 'Checking…';
    msg.className = 'gateMsg';

    const got = await derive(mobile, code);
    if (got === HASH_HEX) {
      msg.textContent = 'Unlocked.';
      msg.className = 'gateMsg ok';
      setTimeout(unlock, 220);
      return;
    }

    tries += 1;
    const wait = tries >= 3 ? 4000 : 600;   // slow down repeated guessing
    msg.textContent = tries >= 3
      ? `Wrong number or code. Try again in ${wait / 1000}s.`
      : 'Wrong number or code.';
    msg.className = 'gateMsg bad';
    gate.querySelector('.gateCard').classList.add('shake');
    setTimeout(() => gate.querySelector('.gateCard')?.classList.remove('shake'), 400);
    setTimeout(() => { btn.disabled = false; }, wait);
  });

  return new Promise((resolve) => window.addEventListener('cce:unlocked', () => resolve(), { once: true }));
}
