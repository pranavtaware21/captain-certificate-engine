/* Cityflo Captain "Certificate of Excellence" - v2 template renderer.
 *
 * Geometry, type sizes and letter-spacing below were measured directly off
 * captain-certificate-v2.ai / .pdf (all text in that file is outlined, so the
 * artwork was re-typeset here with the original fonts). Units are PDF points
 * on an 841.92 x 594.96 pt page (A4 landscape), matching the source file.
 */
import { FONT_CSS } from './fonts.js';
import { BG_SVG } from './background.js';
import { LOGO_PNG } from './logo.js';

export const PAGE = { w: 841.92, h: 594.96 };
export const FONT_STYLE_CSS = FONT_CSS;

const CX = PAGE.w / 2;                     // 420.96

/* The artwork's near-black is replaced by the Cityflo brand navy (design system
 * P-300), with P-200 for the softer secondary text so the sheet reads as one
 * palette. Gold and rule stay exactly as the .ai has them. */
const C = {
  paper: '#f6ede2',
  ink: '#00253f',        // P-300, Primary Brand-Blue
  inkSoft: '#2b4a60',    // P-200
  gold: '#eda01e',
  goldDeep: '#a9741a',
  rule: '#d8c39a',
};

/* Type: family / weight / style / size(pt) / letter-spacing(pt), as measured. */
const T = {
  eyebrow: { f: 'CFArchivo', w: 600, s: 'normal', size: 7.376, ls: 2.797 },
  title:   { f: 'CFFraunces', w: 400, s: 'normal', size: 41.42, ls: 0 },
  lede:    { f: 'CFArchivo', w: 400, s: 'normal', size: 8.542, ls: 1.088 },
  name:    { f: 'CFFraunces', w: 500, s: 'italic', size: 28.73, ls: 0.098 },
  role:    { f: 'CFArchivo', w: 600, s: 'normal', size: 7.376, ls: 2.185 },
  awarded: { f: 'CFArchivo', w: 600, s: 'normal', size: 6.749, ls: 2.631 },
  achv:    { f: 'CFFraunces', w: 600, s: 'italic', size: 14.37, ls: 0.28 },
  tagLine: { f: 'CFFraunces', w: 600, s: 'normal', size: 17.2, ls: 0.1 },
  achvLine:{ f: 'CFArchivo', w: 400, s: 'normal', size: 9.6, ls: 0.05 },
  dateVal: { f: 'CFArchivo', w: 400, s: 'normal', size: 10.4, ls: 0.4 },
  sigWho:  { f: 'CFArchivo', w: 600, s: 'normal', size: 7.376, ls: 1.036 },
  sigSub:  { f: 'CFArchivo', w: 400, s: 'normal', size: 6.706, ls: 0 },
};

/* Baselines / rules / shapes, all measured off the v2 artwork.
 * The .ai's award block has one display line. The tag takes it, and the
 * achievement sits on a line underneath — the only structural difference from
 * the .ai. With no tag the achievement keeps the display line, exactly as the
 * source file has it. */
const L = {
  logo:       { x: 339.89, y: 62.25, w: 161.63, h: 52.11 },
  frame:      { x: 23.25, y: 23.26, w: 794.92, h: 548.19, sw: 1.5 },
  corner:     { s: 20.15, pts: [[22.835, 22.895], [819.255, 22.895], [22.835, 572.595], [819.255, 572.595]] },
  eyebrowBase: 139.42,
  eyebrowRule: { y: 137.37, t: 0.75, l: [227.23, 289.47], r: [551.95, 614.94] },
  eyebrowDot:  { s: 5.3, y: 137.37, x: [300.35, 541.08] },
  titleBase:   210.74,
  ledeBase:    236.49,
  nameRule:    { y: 266.15, t: 0.75, l: [200.98, 274.47], r: [566.95, 641.19] },
  nameDot:     { s: 6.37, y: 266.52, x: [287.22, 554.20] },
  nameBase:    277.35,
  namePad:     11,           // clear space between the name's ink and its diamond
  nameDotMinX: 233.73,       // how far out a diamond may travel (keeps 20pt of rule)
  nameRuleGap: 12.75,        // diamond -> rule gap, as the .ai has it
  nameMinSize: 16,           // only shrink once the diamonds have run out of room
  roleBase:    297.45,
  achvLead:    13.6,         // achievement line spacing when it wraps
  awardedBase: 323.98,
  tagBase:     348.88,       // the .ai's display line
  achvMaxW:    468,
  achvBase:    375.02,       // the achievement sits where the .ai's citation paragraph did
  achvLineMaxW: 470,
  sigRule:     { y: 448.0, t: 0.75, l: [188.23, 364.46], r: [477.70, 653.19] },
  sigWhoBase:  458.2,        // labels keep the .ai's 10.2pt drop below the rule
  sigSubBase:  466.63,
  dateBase:    441.0,        // the date prints in the signing space, above the rule
  sigCx:       [276.35, 565.45],
};

const FIXED = {
  eyebrow: 'CAPTAIN RECOGNITION PROGRAMME',
  title: 'Certificate of Excellence',
  lede: 'THIS HONOUR IS PROUDLY PRESENTED TO',
  role: 'CITYFLO CAPTAIN',
  awarded: 'AWARDED FOR',   // a period is appended when one is given
  sig: [
    { who: 'AUTHORISED SIGNATORY', sub: 'CITYFLO OPERATIONS' },
    { who: 'DATE', sub: '[DD MMM YYYY]' },
  ],
};

/* ---------- text measurement (canvas, same fonts as the SVG) ---------- */

let _ctx = null;
let _lsSupported = null;
function mctx() {
  if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
  if (_lsSupported === null) _lsSupported = 'letterSpacing' in _ctx;
  return _ctx;
}

/** Advance width of `text` in pt (px units are treated as pt: the scale is linear). */
export function advance(text, t) {
  if (!text) return 0;
  const cx = mctx();
  cx.letterSpacing = _lsSupported ? `${t.ls}px` : '0px';
  cx.font = `${t.s} ${t.w} ${t.size}px "${t.f}"`;
  let w = cx.measureText(text).width;
  if (!_lsSupported) w += t.ls * text.length;   // Chrome adds spacing after every glyph
  return w;
}

function fitSize(text, t, maxW, minSize) {
  let size = t.size;
  while (size > minSize && advance(text, { ...t, size }) > maxW) size -= 0.25;
  return size;
}

function wrap(text, t, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
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

function text(x, y, str, t, fill, extra = '') {
  return `<text x="${n(x)}" y="${n(y)}" fill="${fill}" text-anchor="middle" `
    + `font-family="${t.f}" font-weight="${t.w}" font-style="${t.s}" `
    + `font-size="${n(t.size)}" letter-spacing="${n(t.ls)}"${extra ? ' ' + extra : ''}>${esc(str)}</text>`;
}

function diamond(cx, cy, s, attrs) {
  const h = s / 2;
  return `<path d="M${n(cx)} ${n(cy - h)}L${n(cx + h)} ${n(cy)}L${n(cx)} ${n(cy + h)}L${n(cx - h)} ${n(cy)}Z" ${attrs}/>`;
}

function hrule(x0, x1, y, thickness, fill) {
  return `<rect x="${n(x0)}" y="${n(y - thickness / 2)}" width="${n(x1 - x0)}" height="${n(thickness)}" fill="${fill}"/>`;
}

/* With the pillar row gone the sheet had a wide empty band at the foot, so the
 * whole content group is scaled up and re-centred inside the frame. Everything
 * else still works in the .ai's own coordinates — measurement, wrapping and name
 * fitting are all pre-transform — and only these numbers move it. */
const CONTENT_SCALE = 1.12;
const CONTENT_MID_OLD = 264.5;          // mid-height of the content as laid out
const CONTENT_MID_NEW = 297.5;          // mid-height of the frame's inside
const CONTENT_OPEN = '<g transform="translate('
  + `${n(CX * (1 - CONTENT_SCALE))} ${n(CONTENT_MID_NEW - CONTENT_SCALE * CONTENT_MID_OLD)})`
  + ` scale(${CONTENT_SCALE})">`;
const CONTENT_CLOSE = '</g>';

/* ---------- the certificate ----------
 *
 * The page is built as two layers. Everything fixed (artwork, frame, headings,
 * signature block) sits in the static layer, which is rasterised once
 * per run and reused; only the four variable bits are re-rendered per row.
 * buildCertificateSVG() stitches both layers into one standalone SVG.
 */

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
  + `width="${PAGE.w}pt" height="${PAGE.h}pt" viewBox="0 0 ${PAGE.w} ${PAGE.h}">`;

const HEAD = `<style>${FONT_CSS}text{white-space:pre}</style>`
  + '<defs>'
  + `<linearGradient id="cf-fadeR" x1="0" x2="1" y1="0" y2="0">`
    + `<stop offset="0" stop-color="${C.rule}" stop-opacity="0"/><stop offset="1" stop-color="${C.rule}"/></linearGradient>`
  + `<linearGradient id="cf-fadeL" x1="0" x2="1" y1="0" y2="0">`
    + `<stop offset="0" stop-color="${C.rule}"/><stop offset="1" stop-color="${C.rule}" stop-opacity="0"/></linearGradient>`
  + '</defs>';

/** Everything on the certificate that never changes between rows. */
function staticParts() {
  const p = [];

  // paper + Mumbai street-map panels + inner hairline frame, straight from the .ai
  p.push(`<g>${BG_SVG}</g>`);

  // outer gold frame + corner diamonds: page furniture, so they keep their size
  p.push(`<rect x="${L.frame.x}" y="${L.frame.y}" width="${L.frame.w}" height="${L.frame.h}" `
    + `fill="none" stroke="${C.gold}" stroke-width="${L.frame.sw}"/>`);
  for (const [cx, cy] of L.corner.pts) {
    p.push(diamond(cx, cy, L.corner.s + 3, `fill="${C.goldDeep}"`));
    p.push(diamond(cx, cy, L.corner.s + 1.5, `fill="${C.paper}"`));
    p.push(diamond(cx, cy, L.corner.s, `fill="${C.gold}"`));
  }

  p.push(CONTENT_OPEN);
  p.push(`<image x="${L.logo.x}" y="${L.logo.y}" width="${L.logo.w}" height="${L.logo.h}" `
    + `preserveAspectRatio="xMidYMid meet" href="${LOGO_PNG}"/>`);

  // eyebrow
  p.push(
    `<rect x="${L.eyebrowRule.l[0]}" y="${n(L.eyebrowRule.y - L.eyebrowRule.t / 2)}" `
      + `width="${n(L.eyebrowRule.l[1] - L.eyebrowRule.l[0])}" height="${L.eyebrowRule.t}" fill="url(#cf-fadeR)"/>`,
    `<rect x="${L.eyebrowRule.r[0]}" y="${n(L.eyebrowRule.y - L.eyebrowRule.t / 2)}" `
      + `width="${n(L.eyebrowRule.r[1] - L.eyebrowRule.r[0])}" height="${L.eyebrowRule.t}" fill="url(#cf-fadeL)"/>`,
    diamond(L.eyebrowDot.x[0], L.eyebrowDot.y, L.eyebrowDot.s, `fill="${C.gold}"`),
    diamond(L.eyebrowDot.x[1], L.eyebrowDot.y, L.eyebrowDot.s, `fill="${C.gold}"`),
    text(CX, L.eyebrowBase, FIXED.eyebrow, T.eyebrow, C.goldDeep)
  );

  // title: one upright run, all in ink
  p.push(text(CX, L.titleBase, FIXED.title, T.title, C.ink));

  // lede + role (the name's flanking rules are per-row: a very long name drops them)
  p.push(
    text(CX, L.ledeBase, FIXED.lede, T.lede, C.inkSoft),
    text(CX, L.roleBase, FIXED.role, T.role, C.inkSoft)
  );

  // signature block (the date line itself is per-row, so it lives in the dynamic layer)
  p.push(
    hrule(L.sigRule.l[0], L.sigRule.l[1], L.sigRule.y, L.sigRule.t, C.ink),
    hrule(L.sigRule.r[0], L.sigRule.r[1], L.sigRule.y, L.sigRule.t, C.ink),
    text(L.sigCx[0], L.sigWhoBase, FIXED.sig[0].who, T.sigWho, C.inkSoft),
    text(L.sigCx[0], L.sigSubBase, FIXED.sig[0].sub, T.sigSub, C.rule),
    text(L.sigCx[1], L.sigWhoBase, FIXED.sig[1].who, T.sigWho, C.inkSoft)
  );
  p.push(CONTENT_CLOSE);

  return p;
}

/** The four per-captain bits: name, tag pill, achievement block, date. */
function dynamicParts({ name = '', tag = '', achievement = '', date = '', period = '', placeholders = false } = {}) {
  const p = [CONTENT_OPEN];

  /* Name, flanked by the .ai's rules and gold diamonds. A longer name pushes
     the diamonds outward (the rules shorten to make room) and only shrinks the
     type once the diamonds have travelled as far as they can. The marks never
     drop away. */
  const nameText = String(name || '').trim() || (placeholders ? 'Captain Name' : 'Captain');
  const maxHalf = CX - L.nameDotMinX - L.namePad;          // widest half-name the marks allow
  let nameSize = T.name.size;
  while (nameSize > L.nameMinSize
         && advance(nameText, { ...T.name, size: nameSize }) / 2 > maxHalf) {
    nameSize -= 0.25;
  }
  const nameT = { ...T.name, size: nameSize };
  const half = Math.min(
    Math.max(advance(nameText, nameT) / 2 + L.namePad, CX - L.nameDot.x[0]),
    CX - L.nameDotMinX
  );
  const dotL = CX - half;
  const dotR = CX + half;
  const ruleLW = Math.max(0, dotL - L.nameRuleGap - L.nameRule.l[0]);
  const ruleRW = Math.max(0, L.nameRule.r[1] - (dotR + L.nameRuleGap));
  p.push(
    `<rect x="${L.nameRule.l[0]}" y="${n(L.nameRule.y - L.nameRule.t / 2)}" `
      + `width="${n(ruleLW)}" height="${L.nameRule.t}" fill="url(#cf-fadeR)"/>`,
    `<rect x="${n(dotR + L.nameRuleGap)}" y="${n(L.nameRule.y - L.nameRule.t / 2)}" `
      + `width="${n(ruleRW)}" height="${L.nameRule.t}" fill="url(#cf-fadeL)"/>`,
    diamond(dotL, L.nameDot.y, L.nameDot.s, `fill="${C.gold}"`),
    diamond(dotR, L.nameDot.y, L.nameDot.s, `fill="${C.gold}"`),
    text(CX, L.nameBase, nameText, nameT, C.goldDeep)
  );

  /* The award block. The .ai's display line carries the tag, set upright in
     ink; the achievement prints where the .ai's citation paragraph sat. With no
     tag the achievement takes the display line in the .ai's own italic. */
  const tagText = String(tag || '').trim();
  const achvText = String(achievement || '').trim()
    || (placeholders ? 'the achievement — e.g. exceptional service & a flawless safety record' : '');

  if (tagText || achvText) {
    const periodText = String(period || '').trim().toUpperCase();
    const label = periodText ? `${FIXED.awarded} ${periodText}` : FIXED.awarded;
    p.push(text(CX, L.awardedBase, label, { ...T.awarded, size: fitSize(label, T.awarded, L.achvMaxW, 5.5) },
      C.goldDeep));
  }

  if (tagText) {
    const tagT = { ...T.tagLine, size: fitSize(tagText, T.tagLine, L.achvMaxW, 11) };
    wrap(tagText, tagT, L.achvMaxW).forEach((line, i) =>
      p.push(text(CX, L.tagBase + i * tagT.size * 1.24, line, tagT, C.ink)));
  }

  if (achvText) {
    // on the display line when it stands alone, otherwise in the citation's slot
    const solo = !tagText;
    let achvT = solo ? { ...T.achv } : { ...T.achvLine };
    const maxW = solo ? L.achvMaxW : L.achvLineMaxW;
    let lines = wrap(achvText, achvT, maxW);
    while (lines.length > 2 && achvT.size > (solo ? 10.5 : 7.8)) {
      achvT = { ...achvT, size: achvT.size - (solo ? 0.4 : 0.3) };
      lines = wrap(achvText, achvT, maxW);
    }
    const base = solo ? L.tagBase : L.achvBase;
    const lead = solo ? achvT.size * 1.32 : L.achvLead;
    lines.forEach((line, i) => p.push(text(CX, base + i * lead, line, achvT,
      solo ? C.ink : C.inkSoft)));
  }

  const dateText = date ? String(date).trim().toUpperCase() : (placeholders ? FIXED.sig[1].sub : '');
  if (dateText) p.push(text(L.sigCx[1], L.dateBase, dateText, T.dateVal, C.inkSoft));

  p.push(CONTENT_CLOSE);
  return p;
}

/** The static layer on its own (opaque; safe to rasterise once and reuse). */
export function buildStaticSVG() {
  return SVG_OPEN + HEAD + staticParts().join('') + '</svg>';
}

/** The per-captain layer on its own (transparent, drawn over the static one). */
export function buildDynamicSVG(fields) {
  return SVG_OPEN + HEAD + dynamicParts(fields).join('') + '</svg>';
}

/** One complete, standalone certificate SVG. */
export function buildCertificateSVG(fields = {}) {
  return SVG_OPEN + HEAD + staticParts().join('') + dynamicParts(fields).join('') + '</svg>';
}

/* ---------- rasterising ---------- */

/** Make sure the embedded fonts are ready before any measuring / rasterising. */
export async function ensureFonts() {
  if (!document.getElementById('cf-font-style')) {
    const st = document.createElement('style');
    st.id = 'cf-font-style';
    st.textContent = FONT_CSS;
    document.head.appendChild(st);
  }
  const specs = [
    '400 40px CFFraunces', 'italic 500 40px CFFraunces', 'italic 600 40px CFFraunces',
    '400 12px CFArchivo', '600 12px CFArchivo',
  ];
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

/** Rasterise any certificate SVG to a canvas at `scale` x (1 = 72dpi). */
export async function rasterise(svg, scale) {
  const img = await svgToImage(svg);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE.w * scale);
  canvas.height = Math.round(PAGE.h * scale);
  const cx = canvas.getContext('2d');
  cx.fillStyle = C.paper;
  cx.fillRect(0, 0, canvas.width, canvas.height);
  cx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Render one certificate, reusing a rasterised static layer.
 * Pass the same `cache` object across a run: the expensive artwork (masked
 * street-map panels) is then rasterised once instead of once per row.
 */
export async function renderCertificate(fields, scale, cache = {}) {
  if (!cache.canvas || cache.scale !== scale) {
    cache.canvas = await rasterise(buildStaticSVG(), scale);
    cache.scale = scale;
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
