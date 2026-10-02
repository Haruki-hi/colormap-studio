// upload.js — read a colormap from a horizontal image / PPM / CSV and extract N representative colors
import { nlrgb2cielab, judgeInout } from './colormath.js';

const MSG = {
  horizontal:
    '横長の画像（幅が高さより大きいカラーマップ）のみ対応しています。\n\nOnly horizontal colormap images (wider than tall) are supported.',
  image:
    '画像を読み込めませんでした。\n\nCould not read the image.',
  ppm:
    'PPM ファイルを読み込めませんでした。\n\nCould not read the PPM file.',
  csv:
    'CSV を読み取れませんでした（数値 3 列＝RGB または L*a*b* が 2 行以上必要です）。\n\nCould not read the CSV (need at least 2 rows with 3 numeric columns: RGB or L*a*b*).',
};

// ===== Strict extraction (same as the research code, extractControlPointsFromPPM) =====
// n colors at positions i*(w-1)/(n-1) of a w-entry colormap, linearly interpolating between
// neighbouring entries. 'rgb' entries are 0-255 non-linear RGB (interpolated in RGB, then
// converted to L*a*b*); 'lab' entries are interpolated in L*a*b* directly.
export function extractPoints(entries, n, space) {
  const w = entries.length;
  const delta = (w - 1) / (n - 1);
  const points = [];
  for (let i = 0; i < n; i++) {
    const bi = delta * i;
    const i0 = Math.min(Math.max(Math.floor(bi), 0), w - 1);
    const i1 = Math.min(i0 + 1, w - 1);
    const f = bi - i0;
    const c = [0, 1, 2].map(k => (1.0 - f) * entries[i0][k] + f * entries[i1][k]);
    if (space === 'lab') {
      points.push(toGamut({ L: c[0], a: c[1], b: c[2] }));
    } else {
      // RGB-derived colors are inside the sRGB gamut by construction. (Do not run them through
      // the gamut test: saturated colors such as 0,0,255 sit exactly on the boundary and would be
      // shrunk by rounding.)
      const lab = nlrgb2cielab(c[0], c[1], c[2]);
      points.push({ L: lab[0], a: lab[1], b: lab[2] });
    }
  }
  return points;
}

// L*a*b* values typed into a CSV may lie outside the sRGB gamut; pull them in the same way the
// app does elsewhere (shrink a*, b* until inside).
function toGamut(p) {
  let { L, a, b } = p;
  L = Math.min(100, Math.max(0, L));
  for (let k = 0; k < 5000 && judgeInout(L, a, b) === 1; k++) {
    if (L <= 0 || L >= 100) break;
    a *= 0.99; b *= 0.99;
  }
  return { L, a, b };
}

// ===== CSV =====
// Accepts RGB (0-255 or 0-1) or L*a*b*. A header naming the columns (R,G,B / L*,a*,b*) decides;
// without a header, any negative value means L*a*b*, otherwise RGB.
export function parseCsvText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const split = l => l.replace(/["']/g, '').split(/[\s,;]+/).filter(t => t !== '');
  if (lines.length === 0) throw new Error(MSG.csv);

  let header = null;
  const first = split(lines[0]);
  if (first.some(t => !Number.isFinite(Number(t)))) { header = first; lines.shift(); }

  let cols = [0, 1, 2];
  let space = null;
  if (header) {
    const find = re => header.findIndex(t => re.test(t));
    const [r, g, b] = [find(/^r(ed)?$/i), find(/^g(reen)?$/i), find(/^b(lue)?$/i)];
    const [L, a, bb] = [find(/^l\*?$/i), find(/^a\*?$/i), find(/^b\*?$/i)];
    if (L >= 0 && a >= 0 && bb >= 0) { cols = [L, a, bb]; space = 'lab'; }
    else if (r >= 0 && g >= 0 && b >= 0) { cols = [r, g, b]; space = 'rgb'; }
  }

  const rows = [];
  for (const line of lines) {
    const t = split(line);
    const v = cols.map(c => Number(t[c]));
    if (v.some(x => !Number.isFinite(x))) throw new Error(MSG.csv);
    rows.push(v);
  }
  if (rows.length < 2) throw new Error(MSG.csv);

  const all = rows.flat();
  const min = Math.min(...all), max = Math.max(...all);
  if (!space) space = min < 0 ? 'lab' : 'rgb';
  let format;
  if (space === 'lab') {
    format = 'L*a*b*';
  } else {
    if (min < 0 || max > 255) throw new Error(MSG.csv);
    if (max <= 1) { for (const r of rows) for (let k = 0; k < 3; k++) r[k] *= 255; format = 'RGB 0–1'; }
    else format = 'RGB 0–255';
  }
  return { entries: rows, space, format };
}

// ===== PPM (P6 binary / P3 ascii) — the research code's native colormap format =====
// Returns the middle row as 0-255 RGB entries.
export function parsePpm(bytes) {
  let p = 0;
  const isSpace = c => c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09;
  const token = () => {
    for (;;) {
      while (p < bytes.length && isSpace(bytes[p])) p++;
      if (bytes[p] === 0x23) { while (p < bytes.length && bytes[p] !== 0x0a) p++; continue; }
      break;
    }
    let s = '';
    while (p < bytes.length && !isSpace(bytes[p])) s += String.fromCharCode(bytes[p++]);
    return s;
  };
  const magic = token();
  const w = Number(token()), h = Number(token()), maxval = Number(token());
  if ((magic !== 'P6' && magic !== 'P3') || !(w > 0) || !(h > 0) || !(maxval > 0) || maxval > 65535) throw new Error(MSG.ppm);
  const scale = 255 / maxval;
  const y = Math.floor(h / 2);
  const entries = [];
  if (magic === 'P6') {
    p++; // single whitespace after maxval
    const bps = maxval > 255 ? 2 : 1;
    if (bytes.length - p < w * h * 3 * bps) throw new Error(MSG.ppm);
    const at = i => bps === 1 ? bytes[p + i] : (bytes[p + 2 * i] << 8) | bytes[p + 2 * i + 1];
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      entries.push([at(o) * scale, at(o + 1) * scale, at(o + 2) * scale]);
    }
  } else {
    const vals = [];
    for (let i = 0; i < w * h * 3; i++) {
      const t = token();
      if (t === '') throw new Error(MSG.ppm);
      vals.push(Number(t) * scale);
    }
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 3; entries.push([vals[o], vals[o + 1], vals[o + 2]]); }
  }
  return { entries, w, h };
}

// ===== Image (PNG / JPEG / BMP / ...) — horizontal only, middle row =====
async function readImageRow(file) {
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { throw new Error(MSG.image); }
  const w = bmp.width, h = bmp.height;
  if (!(w > h)) { bmp.close?.(); throw new Error(MSG.horizontal); }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const y = Math.floor(h / 2);
  ctx.drawImage(bmp, 0, y, w, 1, 0, 0, w, 1);   // crop the middle row, no scaling
  bmp.close?.();
  const d = ctx.getImageData(0, 0, w, 1).data;
  const entries = [];
  for (let x = 0; x < w; x++) entries.push([d[4 * x], d[4 * x + 1], d[4 * x + 2]]);
  return { entries, w, h };
}

// ===== Entry point =====
// Returns { points: [{L,a,b} x n], note } for an image, PPM or CSV file.
export async function loadColormapFile(file, n) {
  const name = file.name || 'file';
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt') || file.type === 'text/csv') {
    const { entries, space, format } = parseCsvText(await file.text());
    return { points: extractPoints(entries, n, space), note: `Loaded ${name}: ${entries.length} rows, ${format} → ${n} colors` };
  }
  if (lower.endsWith('.ppm')) {
    const { entries, w, h } = parsePpm(new Uint8Array(await file.arrayBuffer()));
    if (!(w > h)) throw new Error(MSG.horizontal);
    return { points: extractPoints(entries, n, 'rgb'), note: `Loaded ${name}: ${w}×${h} PPM (middle row) → ${n} colors` };
  }
  const { entries, w, h } = await readImageRow(file);
  return { points: extractPoints(entries, n, 'rgb'), note: `Loaded ${name}: ${w}×${h} image (middle row) → ${n} colors` };
}
