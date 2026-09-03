/* CSV in, ZIP of certificates out. Everything runs in the browser. */
import { renderCertificate, ensureFonts, PAGE } from './certificate.js';

const $ = (id) => document.getElementById(id);

const DPI = { print: 300, standard: 200, light: 150 };
const GUESS = {
  name: ['name', 'captain_name', 'captain name', 'captain', 'full_name', 'full name', 'driver_name', 'driver name'],
  tag: ['tag', 'badge', 'tag_name', 'tag name', 'award', 'title'],
  achievement: ['achievement', 'achievement_line', 'achievement line', 'citation', 'reason', 'tag_reason', 'note'],
};

const state = { rows: [], headers: [], map: { name: '', tag: '', achievement: '' }, busy: false };
const layerCache = {};   // rasterised static artwork, reused across rows

/* ---------- helpers ---------- */

const guess = (headers, keys) => {
  const norm = headers.map((h) => ({ h, k: h.trim().toLowerCase() }));
  for (const key of keys) { const hit = norm.find((c) => c.k === key); if (hit) return hit.h; }
  for (const key of keys) { const hit = norm.find((c) => c.k.includes(key)); if (hit) return hit.h; }
  return '';
};

function safeFilename(s) {
  const clean = String(s || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
  return (clean || 'captain').slice(0, 80);
}

function today() {
  const d = new Date();
  const m = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()];
  return `${String(d.getDate()).padStart(2, '0')} ${m} ${d.getFullYear()}`;
}

const status = (msg, kind = '') => { const el = $('status'); el.textContent = msg; el.className = `status ${kind}`; };

const rowValue = (row, key) => (state.map[key] ? String(row[state.map[key]] ?? '').trim() : '');

/* ---------- csv ---------- */

function loadFile(file) {
  if (!file) return;
  status(`Reading ${file.name}...`);
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
      state.map = {
        name: guess(headers, GUESS.name),
        tag: guess(headers, GUESS.tag),
        achievement: guess(headers, GUESS.achievement),
      };
      $('fileName').textContent = `${file.name} / ${rows.length} row${rows.length > 1 ? 's' : ''}`;
      buildMapping();
      $('setup').hidden = false;
      if (!state.map.name) {
        status(`No name column found in ${headers.join(', ')}. Expected headers are name, tag, achievement `
          + '(see the format above) — or pick the right column below.', 'warn');
      } else {
        const missing = ['tag', 'achievement'].filter((k) => !state.map[k]);
        status(`${rows.length} row${rows.length === 1 ? '' : 's'} loaded.`
          + (missing.length ? ` No ${missing.join(' or ')} column found — those bits will be left off.` : '')
          + ' Check the mapping, then generate.', missing.length ? 'warn' : 'ok');
      }
      refreshPreview();
    },
    error: (err) => status(`Could not read that file: ${err.message}`, 'bad'),
  });
}

function buildMapping() {
  const wrap = $('mapping');
  wrap.replaceChildren();
  const fields = [['name', 'Name', true], ['tag', 'Tag', false], ['achievement', 'Achievement line', false]];
  for (const [key, labelText, required] of fields) {
    const id = `map-${key}`;
    const field = document.createElement('div');
    field.className = 'field';

    const label = document.createElement('label');
    label.htmlFor = id;
    label.append(labelText);
    if (!required) {
      const opt = document.createElement('span');
      opt.className = 'opt';
      opt.textContent = 'optional';
      label.append(' ', opt);
    }

    const select = document.createElement('select');
    select.id = id;
    select.append(new Option('(none)', ''));
    for (const h of state.headers) select.append(new Option(h, h, false, h === state.map[key]));
    select.addEventListener('change', (e) => {
      state.map[key] = e.target.value;
      refreshPreview();
    });

    field.append(label, select);
    wrap.append(field);
  }
}

/* ---------- preview ---------- */

let previewTimer = null;
const previewCache = {};
function refreshPreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    const row = state.rows[0];
    if (!row) return;
    const canvas = await renderCertificate({
      name: rowValue(row, 'name'),
      tag: rowValue(row, 'tag'),
      achievement: rowValue(row, 'achievement'),
      date: $('dateText').value.trim(),
      placeholders: true,
    }, 1.6, previewCache);
    const img = $('preview');
    img.src = canvas.toDataURL('image/png');
    img.hidden = false;
    $('previewNote').textContent = `Preview of row 1 of ${state.rows.length}: ${rowValue(row, 'name') || '(no name)'}`;
  }, 80);
}

/* ---------- generate ---------- */

async function generate() {
  if (state.busy) return;
  if (!state.map.name) { status('Pick which column holds the name first.', 'bad'); return; }

  const wantPdf = $('outPdf').checked;
  const wantPng = $('outPng').checked;
  if (!wantPdf && !wantPng) { status('Choose at least one output format.', 'bad'); return; }

  const scale = DPI[$('quality').value] / 72;
  const date = $('dateText').value.trim();
  const { jsPDF } = window.jspdf;
  const zip = new JSZip();
  const used = new Map();
  const skipped = [];

  state.busy = true;
  $('go').disabled = true;
  $('progressWrap').hidden = false;
  const total = state.rows.length;

  for (let i = 0; i < total; i++) {
    const row = state.rows[i];
    const name = rowValue(row, 'name');
    if (!name) { skipped.push(`row ${i + 2}: no name`); continue; }

    const canvas = await renderCertificate({
      name,
      tag: rowValue(row, 'tag'),
      achievement: rowValue(row, 'achievement'),
      date,
    }, scale, layerCache);

    let base = `Certificate - ${safeFilename(name)}`;
    const seen = (used.get(base.toLowerCase()) || 0) + 1;
    used.set(base.toLowerCase(), seen);
    if (seen > 1) base += ` (${seen})`;

    if (wantPng) {
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      zip.file(`png/${base}.png`, blob);
    }
    if (wantPdf) {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [PAGE.w, PAGE.h], compress: true });
      doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, PAGE.w, PAGE.h, undefined, 'FAST');
      zip.file(`pdf/${base}.pdf`, doc.output('blob'));
    }

    const done = i + 1;
    $('bar').style.width = `${(done / total) * 100}%`;
    $('progressText').textContent = `${done} of ${total}: ${name}`;
    await new Promise((r) => setTimeout(r, 0));   // let the UI breathe
  }

  status('Packing the ZIP...');
  const blob = await zip.generateAsync({ type: 'blob' }, (m) => {
    $('progressText').textContent = `Zipping ${Math.round(m.percent)}%`;
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `captain-certificates-${stamp}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);

  const made = total - skipped.length;
  status(`Done. ${made} certificate${made === 1 ? '' : 's'} in captain-certificates-${stamp}.zip`
    + (skipped.length ? ` (skipped ${skipped.length}: ${skipped.slice(0, 3).join('; ')}${skipped.length > 3 ? '...' : ''})` : ''), 'ok');
  $('progressText').textContent = 'Download started.';
  state.busy = false;
  $('go').disabled = false;
}

/* ---------- wiring ---------- */

function wire() {
  const drop = $('drop');
  const input = $('csv');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  input.addEventListener('change', (e) => loadFile(e.target.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => loadFile(e.dataTransfer.files[0]));
  $('dateText').value = today();
  $('dateText').addEventListener('input', refreshPreview);
  $('go').addEventListener('click', generate);
}

(async function init() {
  wire();
  status('Loading fonts...');
  await ensureFonts();
  status('Ready. Drop a CSV to start.');
})();
