/* CSV in, ZIP of certificates out. Everything runs in the browser. */
import { renderCertificate, ensureFonts, PAGE } from './certificate.js';
import { LOGO_PNG } from './logo.js';
import { guard, lock } from './gate.js';

const $ = (id) => document.getElementById(id);

const DPI = { print: 300, standard: 200, light: 150 };
const GUESS = {
  name: ['name', 'captain_name', 'captain name', 'captain', 'full_name', 'full name', 'driver_name', 'driver name'],
  tag: ['tag', 'badge', 'tag_name', 'tag name', 'award', 'title'],
  achievement: ['achievement', 'achievement_line', 'achievement line', 'citation', 'reason', 'tag_reason', 'note'],
};
const FIELDS = [
  ['name', 'Name', true],
  ['tag', 'Tag', false],
  ['achievement', 'Achievement', false],
];

const state = {
  rows: [],
  headers: [],
  map: { name: '', tag: '', achievement: '' },
  cursor: 0,          // which row the stage is showing
  busy: false,
  zip: null,          // last ZIP blob, so it can be downloaded again
  zipName: '',
};

const previewCache = {};   // rasterised static artwork for the stage
const outputCache = {};    // ... and for the output run (different scale)

/* ---------- small helpers ---------- */

const guess = (headers, keys) => {
  const norm = headers.map((h) => ({ h, k: h.trim().toLowerCase() }));
  for (const key of keys) { const hit = norm.find((c) => c.k === key); if (hit) return hit.h; }
  for (const key of keys) { const hit = norm.find((c) => c.k.includes(key)); if (hit) return hit.h; }
  return '';
};

const safeFilename = (s) => (String(s || '')
  .replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim() || 'captain').slice(0, 80);

function today() {
  const d = new Date();
  const m = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()];
  return `${String(d.getDate()).padStart(2, '0')} ${m} ${d.getFullYear()}`;
}

const status = (msg, kind = '') => {
  const el = $('status');
  el.textContent = msg;
  el.className = `status ${kind}`;
};

const note = (msg) => { $('progressText').textContent = msg; };

const rowValue = (row, key) => (state.map[key] ? String(row?.[state.map[key]] ?? '').trim() : '');

const named = (row) => rowValue(row, 'name') || '(no name)';

const quality = () => document.querySelector('input[name=q]:checked')?.value || 'standard';

/* ---------- csv ---------- */

function loadFile(file) {
  if (!file) return;
  status(`Reading ${file.name}…`);
  Papa.parse(file, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
    complete: (res) => {
      const headers = (res.meta.fields || []).filter(Boolean);
      const rows = res.data.filter((r) => Object.values(r).some((v) => String(v ?? '').trim()));
      if (!headers.length || !rows.length) { status('That CSV has no readable rows.', 'bad'); return; }

      state.headers = headers;
      state.rows = rows;
      state.cursor = 0;
      state.map = {
        name: guess(headers, GUESS.name),
        tag: guess(headers, GUESS.tag),
        achievement: guess(headers, GUESS.achievement),
      };

      $('drop').hidden = true;
      $('fileChip').hidden = false;
      $('fileName').textContent = `${file.name} · ${rows.length} row${rows.length === 1 ? '' : 's'}`;
      $('step2').hidden = false;
      $('step3').hidden = false;
      $('summary').hidden = true;
      $('go').disabled = false;

      buildMapping();
      reportMapping();
      showRow(0);
      note(`${rows.length} ready — ⌘⏎ to generate.`);
    },
    error: (err) => status(`Could not read that file: ${err.message}`, 'bad'),
  });
}

function reportMapping() {
  const n = state.rows.length;
  if (!state.map.name) {
    status(`No name column found in: ${state.headers.join(', ')}. Pick one below.`, 'bad');
    $('go').disabled = true;
    return;
  }
  $('go').disabled = state.busy;
  const missing = FIELDS.filter(([k, , req]) => !req && !state.map[k]).map(([, label]) => label.toLowerCase());
  status(missing.length
    ? `${n} row${n === 1 ? '' : 's'} loaded. No ${missing.join(' or ')} column — that part is left off.`
    : `${n} row${n === 1 ? '' : 's'} loaded and mapped.`,
  missing.length ? 'warn' : 'ok');
}

function buildMapping() {
  const wrap = $('mapping');
  wrap.replaceChildren();

  for (const [key, labelText, required] of FIELDS) {
    const id = `map-${key}`;
    const field = document.createElement('div');
    field.className = 'field';

    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = required ? labelText : `${labelText} · optional`;

    const select = document.createElement('select');
    select.id = id;
    select.append(new Option('(none)', ''));
    for (const h of state.headers) select.append(new Option(h, h, false, h === state.map[key]));

    // the first row's value, so a wrong mapping is obvious immediately
    const sample = document.createElement('p');
    sample.className = 'sample';
    const arrow = document.createElement('b');
    arrow.textContent = '→';
    const val = document.createElement('i');
    sample.append(arrow, val);

    const paint = () => {
      const v = rowValue(state.rows[state.cursor], key);
      val.textContent = v || (state.map[key] ? '(blank in this row)' : 'not used');
      sample.style.opacity = v ? '1' : '.55';
    };
    select.addEventListener('change', (e) => {
      state.map[key] = e.target.value;
      paint();
      reportMapping();
      showRow(state.cursor);
    });
    paint();

    field.append(label, select, sample);
    wrap.append(field);
    field.dataset.key = key;
    field._paint = paint;
  }
}

const repaintSamples = () => {
  for (const f of $('mapping').children) f._paint?.();
};

/* ---------- stage ---------- */

let showToken = 0;
async function showRow(i) {
  const total = state.rows.length;
  if (!total) return;
  state.cursor = Math.max(0, Math.min(i, total - 1));
  const row = state.rows[state.cursor];
  const token = ++showToken;

  $('rowNav').hidden = total < 2;
  $('rowIdx').textContent = String(state.cursor + 1);
  $('rowTotal').textContent = String(total);
  $('prevRow').disabled = state.cursor === 0;
  $('nextRow').disabled = state.cursor === total - 1;
  $('stageName').textContent = named(row);
  repaintSamples();

  const canvas = await renderCertificate({
    name: rowValue(row, 'name'),
    tag: rowValue(row, 'tag'),
    achievement: rowValue(row, 'achievement'),
    date: $('dateText').value.trim(),
    placeholders: true,
  }, 1.7, previewCache);
  if (token !== showToken) return;              // a newer row won the race

  const img = $('preview');
  img.src = canvas.toDataURL('image/png');
  img.hidden = false;
  img.classList.remove('swap');
  void img.offsetWidth;                          // restart the fade
  img.classList.add('swap');
  $('stageEmpty').hidden = true;
  $('zoomBtn').hidden = false;
}

let stageTimer = null;
const refreshStage = () => {
  clearTimeout(stageTimer);
  stageTimer = setTimeout(() => showRow(state.cursor), 90);
};

/* ---------- generate ---------- */

async function generate() {
  if (state.busy || !state.rows.length) return;
  if (!state.map.name) { status('Pick which column holds the name first.', 'bad'); return; }

  const wantPdf = $('outPdf').checked;
  const wantPng = $('outPng').checked;
  if (!wantPdf && !wantPng) { status('Choose PDF, PNG, or both.', 'bad'); return; }

  const scale = DPI[quality()] / 72;
  const date = $('dateText').value.trim();
  const { jsPDF } = window.jspdf;
  const zip = new JSZip();
  const used = new Map();
  const skipped = [];
  const total = state.rows.length;
  const started = Date.now();

  state.busy = true;
  $('go').disabled = true;
  $('go').classList.add('busy');
  $('summary').hidden = true;
  $('progressWrap').hidden = false;

  for (let i = 0; i < total; i++) {
    const row = state.rows[i];
    const name = rowValue(row, 'name');
    if (!name) { skipped.push(i + 2); continue; }

    const canvas = await renderCertificate({
      name,
      tag: rowValue(row, 'tag'),
      achievement: rowValue(row, 'achievement'),
      date,
    }, scale, outputCache);

    let base = `Certificate - ${safeFilename(name)}`;
    const seen = (used.get(base.toLowerCase()) || 0) + 1;
    used.set(base.toLowerCase(), seen);
    if (seen > 1) base += ` (${seen})`;

    if (wantPng) {
      zip.file(`png/${base}.png`, await new Promise((r) => canvas.toBlob(r, 'image/png')));
    }
    if (wantPdf) {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [PAGE.w, PAGE.h], compress: true });
      doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, PAGE.w, PAGE.h, undefined, 'FAST');
      zip.file(`pdf/${base}.pdf`, doc.output('blob'));
    }

    const done = i + 1;
    const pct = (done / total) * 100;
    $('bar').style.width = `${pct}%`;
    $('bus').style.left = `${pct}%`;
    const left = Math.round(((Date.now() - started) / done) * (total - done) / 1000);
    note(`${done} of ${total} — ${name}${left > 4 ? ` · ~${left}s left` : ''}`);
    await new Promise((r) => setTimeout(r, 0));   // let the UI breathe
  }

  note('Packing the ZIP…');
  const blob = await zip.generateAsync({ type: 'blob' }, (m) => {
    note(`Packing the ZIP — ${Math.round(m.percent)}%`);
  });

  state.zip = blob;
  state.zipName = `captain-certificates-${new Date().toISOString().slice(0, 10)}.zip`;
  download();

  const made = total - skipped.length;
  const files = made * ((wantPdf ? 1 : 0) + (wantPng ? 1 : 0));
  $('sumCount').textContent = String(made);
  $('sumFiles').textContent = String(files);
  $('sumSize').textContent = (blob.size / 1048576).toFixed(1);
  $('sumSkipped').hidden = !skipped.length;
  if (skipped.length) {
    $('sumSkipped').textContent = `Skipped ${skipped.length} row${skipped.length === 1 ? '' : 's'} `
      + `with no name (line${skipped.length === 1 ? '' : 's'} ${skipped.slice(0, 6).join(', ')}`
      + `${skipped.length > 6 ? '…' : ''}).`;
  }
  $('summary').hidden = false;
  $('progressWrap').hidden = true;      // the run is over; the summary speaks for it

  status(`${made} certificate${made === 1 ? '' : 's'} generated.`, 'ok');
  note(`Saved as ${state.zipName}`);
  state.busy = false;
  $('go').disabled = false;
  $('go').classList.remove('busy');
}

function download() {
  if (!state.zip) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(state.zip);
  a.download = state.zipName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

function reset() {
  state.rows = [];
  state.headers = [];
  state.cursor = 0;
  state.zip = null;
  $('csv').value = '';
  $('drop').hidden = false;
  $('fileChip').hidden = true;
  $('step2').hidden = true;
  $('step3').hidden = true;
  $('summary').hidden = true;
  $('progressWrap').hidden = true;
  $('bar').style.width = '0';
  $('bus').style.left = '0';
  $('go').disabled = true;
  $('preview').hidden = true;
  $('stageEmpty').hidden = false;
  $('rowNav').hidden = true;
  $('zoomBtn').hidden = true;
  $('stageName').textContent = 'Preview';
  status('Ready. Drop a CSV to start.');
  note('Drop a CSV to begin — ⌘⏎ to generate.');
}

/* ---------- zoom ---------- */

function openZoom() {
  const src = $('preview').src;
  if (!src) return;
  $('zoomImg').src = src;
  $('zoom').hidden = false;
}
const closeZoom = () => { $('zoom').hidden = true; $('zoomImg').src = ''; };

/* ---------- wiring ---------- */

function wire() {
  const drop = $('drop');
  const input = $('csv');

  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  input.addEventListener('change', (e) => loadFile(e.target.files[0]));
  $('fileSwap').addEventListener('click', () => input.click());

  // a file dropped anywhere on the window counts
  ['dragenter', 'dragover'].forEach((ev) => window.addEventListener(ev, (e) => {
    e.preventDefault();
    if (!state.rows.length) drop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach((ev) => window.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.remove('over');
  }));
  window.addEventListener('drop', (e) => loadFile(e.dataTransfer?.files?.[0]));

  $('dateText').value = today();
  $('dateText').addEventListener('input', refreshStage);
  $('go').addEventListener('click', generate);
  $('againBtn').addEventListener('click', download);
  $('resetBtn').addEventListener('click', reset);
  $('lockBtn').addEventListener('click', lock);

  $('prevRow').addEventListener('click', () => showRow(state.cursor - 1));
  $('nextRow').addEventListener('click', () => showRow(state.cursor + 1));
  $('zoomBtn').addEventListener('click', openZoom);
  $('preview').addEventListener('click', openZoom);
  $('zoom').addEventListener('click', closeZoom);

  window.addEventListener('keydown', (e) => {
    if ($('zoom').hidden === false && e.key === 'Escape') { closeZoom(); return; }
    if (e.target instanceof Element && e.target.matches('input, select, textarea')) return;
    if (e.key === 'ArrowLeft') showRow(state.cursor - 1);
    else if (e.key === 'ArrowRight') showRow(state.cursor + 1);
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generate(); }
  });
}

(async function init() {
  const gateLogo = $('gateLogo');
  if (gateLogo) gateLogo.src = LOGO_PNG;
  await guard();                       // the page stays behind the gate until unlocked

  wire();
  const logo = $('brandLogo');
  if (logo) { logo.src = LOGO_PNG; logo.classList.add('in'); }
  status('Setting the type…');
  await ensureFonts();
  status('Ready. Drop a CSV to start.');
})();
