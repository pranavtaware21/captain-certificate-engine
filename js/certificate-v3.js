/* Cityflo "Certificate of Achievement" - Oct 2026 template renderer.
 *
 * Artwork, headings and the signatory block come straight from
 * "Certificate cityflo(Oct 2026).ai" (page 1, background-v3.js). Only the
 * per-captain text is typeset here, at the sizes and baselines measured off
 * that artboard. Units are PDF points on its 870.236 x 623.622 pt page.
 *
 * Exposes the same API as certificate.js so the app can switch between them.
 */
import { FONT_CSS_V3 } from './fonts-v3.js';
import { BG_SVG_V3, SIG_SVG_V3 } from './background-v3.js';
import { DEFAULT_SIGNATURE, SIGNATURE_ASPECT } from './signature.js';

export const PAGE = { w: 870.236, h: 623.622 };

const CX = PAGE.w / 2;                     // 435.118
const INK = '#00243e';                     // the .ai's navy, rgb(0, 36, 62)

/* Type: family / size(pt), as measured. TT Norms ships one weight per family. */
const T = {
  name:    { f: 'CFAlexBrush', size: 69.55 },
  lead:    { f: 'CFNormsNm', size: 16 },   // "is awarded - "
  tag:     { f: 'CFNormsMd', size: 16 },
  achv:    { f: 'CFNormsRg', size: 16 },
  closing: { f: 'CFNormsIt', size: 16 },
  date:    { f: 'CFNormsRg', size: 15 },
  ord:     { f: 'CFNormsRg', size: 8.77 },
};

const L = {
  nameBase: 332.195,
  nameMaxW: 500,           // between the two gold bars, with clear space
  nameMinSize: 36,
  tagBase: 368.45,
  achvBase: 390.43,
  achvLead: 21.98,
  achvMaxW: 680,           // the .ai's widest line runs 95.6 -> 774.6
  achvMinSize: 12,
  dateCx: 299.97,
  dateBase: 516.077,
  ordRise: 4.946,          // the "th" sits 4.9pt above the date baseline
  sigCx: 568.56,           // centred over "Jerin Venad"
  sign: { w: 132, bottom: 512 },
};

const LEAD_IN = 'is awarded - ';

/* ---------- text measurement ---------- */

let _ctx = null;
function advance(str, t) {
  if (!str) return 0;
  if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
  _ctx.font = `${t.size}px "${t.f}"`;
  return _ctx.measureText(str).width;
}

function wrap(str, t, maxW) {
  const words = String(str).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && advance(next, t) > maxW) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/* ---------- svg helpers ---------- */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const n = (v) => Math.round(v * 1000) / 1000;

const font = (t) => `font-family="${t.f}" font-size="${n(t.size)}"`;

function text(x, y, str, t) {
  return `<text x="${n(x)}" y="${n(y)}" fill="${INK}" text-anchor="middle" ${font(t)}>${esc(str)}</text>`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function ordinal(d) {
  if (d % 100 >= 11 && d % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][d % 10] || 'th';
}

/** "07 SEPTEMBER, 2026" -> { day: "7", ord: "th", rest: "September 2026" }. */
export function parseDate(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?,?\s+(\d{4})$/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = MONTHS.find((x) => x.toLowerCase().startsWith(m[2].toLowerCase().slice(0, 3)));
  if (!month || day < 1 || day > 31) return null;
  return { day: String(day), ord: ordinal(day), rest: `${month} ${m[3]}` };
}

/* ---------- the certificate ---------- */

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
  + `width="${PAGE.w}pt" height="${PAGE.h}pt" viewBox="0 0 ${PAGE.w} ${PAGE.h}">`;

const HEAD = `<style>${FONT_CSS_V3}text{white-space:pre}</style>`;

const isCustom = (sig) => sig && sig !== DEFAULT_SIGNATURE;

/** Artwork + signature: identical on every row. */
function staticParts(signature) {
  const p = [BG_SVG_V3];
  if (isCustom(signature)) {
    const h = L.sign.w / SIGNATURE_ASPECT;
    p.push(`<image x="${n(L.sigCx - L.sign.w / 2)}" y="${n(L.sign.bottom - h)}" `
      + `width="${n(L.sign.w)}" height="${n(h)}" preserveAspectRatio="xMidYMax meet" href="${signature}"/>`);
  } else {
    p.push(SIG_SVG_V3);    // the .ai's own signature, vector
  }
  return p;
}

/** Name, award line, citation, closing line, date. */
function dynamicParts({ name = '', tag = '', achievement = '', closing = '', date = '', placeholders = false } = {}) {
  const p = [];

  // name: Alex Brush, shrinks only when it would run into the gold bars
  const nameText = String(name || '').trim() || (placeholders ? 'Full Name' : '');
  let nameT = { ...T.name };
  while (nameT.size > L.nameMinSize && advance(nameText, nameT) > L.nameMaxW) {
    nameT = { ...nameT, size: nameT.size - 0.5 };
  }
  p.push(text(CX, L.nameBase, nameText, nameT));

  // "is awarded - TAG": one centred run, the tag in Medium caps
  const tagText = String(tag || '').trim().toUpperCase();
  if (tagText) {
    p.push(`<text x="${n(CX)}" y="${L.tagBase}" fill="${INK}" text-anchor="middle">`
      + `<tspan ${font(T.lead)}>${esc(LEAD_IN)}</tspan>`
      + `<tspan ${font(T.tag)}>${esc(tagText)}</tspan></text>`);
  }

  // citation, then the italic closing line straight after it
  const achvText = String(achievement || '').trim()
    || (placeholders ? 'In recognition of your consistent performance, dedication, and commitment to excellence.' : '');
  const closingText = String(closing || '').trim();
  const maxLines = closingText ? 2 : 3;
  let y = L.achvBase;
  if (achvText) {
    let achvT = { ...T.achv };
    let lines = wrap(achvText, achvT, L.achvMaxW);
    while (lines.length > maxLines && achvT.size > L.achvMinSize) {
      achvT = { ...achvT, size: achvT.size - 0.25 };
      lines = wrap(achvText, achvT, L.achvMaxW);
    }
    for (const line of lines) { p.push(text(CX, y, line, achvT)); y += L.achvLead; }
  }
  if (closingText) {
    let cT = { ...T.closing };
    while (cT.size > L.achvMinSize && advance(closingText, cT) > L.achvMaxW) cT = { ...cT, size: cT.size - 0.25 };
    p.push(text(CX, y, closingText, cT));
  }

  // date: "9th October 2026", the ordinal raised and small, as the .ai sets it
  const rawDate = String(date || '').trim() || (placeholders ? '09 OCTOBER, 2026' : '');
  if (rawDate) {
    const d = parseDate(rawDate);
    if (d) {
      p.push(`<text x="${n(L.dateCx)}" y="${n(L.dateBase)}" fill="${INK}" text-anchor="middle" ${font(T.date)}>`
        + `${esc(d.day)}<tspan ${font(T.ord)} dy="${-L.ordRise}">${d.ord}</tspan>`
        + `<tspan dy="${L.ordRise}" ${font(T.date)}> ${esc(d.rest)}</tspan></text>`);
    } else {
      p.push(text(L.dateCx, L.dateBase, rawDate, T.date));
    }
  }

  return p;
}

export function buildStaticSVG(signature = DEFAULT_SIGNATURE) {
  return SVG_OPEN + HEAD + staticParts(signature).join('') + '</svg>';
}

export function buildDynamicSVG(fields) {
  return SVG_OPEN + HEAD + dynamicParts(fields).join('') + '</svg>';
}

export function buildCertificateSVG(fields = {}) {
  return SVG_OPEN + HEAD + staticParts(fields.signature).join('') + dynamicParts(fields).join('') + '</svg>';
}

/* ---------- rasterising ---------- */

export async function ensureFonts() {
  if (!document.getElementById('cf-font-style-v3')) {
    const st = document.createElement('style');
    st.id = 'cf-font-style-v3';
    st.textContent = FONT_CSS_V3;
    document.head.appendChild(st);
  }
  const specs = ['40px CFAlexBrush', '12px CFNormsRg', '12px CFNormsNm', '12px CFNormsMd', '12px CFNormsIt'];
  await Promise.all(specs.map((s) => document.fonts.load(s)));
  await document.fonts.ready;
}

async function svgToImage(svg) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function rasterise(svg, scale) {
  const img = await svgToImage(svg);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE.w * scale);
  canvas.height = Math.round(PAGE.h * scale);
  const cx = canvas.getContext('2d');
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, canvas.width, canvas.height);
  cx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Same contract as certificate.js: pass one `cache` per run to reuse the artwork. */
export async function renderCertificate(fields, scale, cache = {}) {
  const signature = fields.signature ?? DEFAULT_SIGNATURE;
  if (!cache.canvas || cache.scale !== scale || cache.signature !== signature) {
    cache.canvas = await rasterise(buildStaticSVG(signature), scale);
    cache.scale = scale;
    cache.signature = signature;
  }
  const canvas = document.createElement('canvas');
  canvas.width = cache.canvas.width;
  canvas.height = cache.canvas.height;
  const cx = canvas.getContext('2d');
  cx.drawImage(cache.canvas, 0, 0);
  const fg = await svgToImage(buildDynamicSVG(fields));
  cx.drawImage(fg, 0, 0, canvas.width, canvas.height);
  return canvas;
}
