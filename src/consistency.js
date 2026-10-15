// consistency.js — extraction of representative colors for the Consistency method.
//
// A port of extractControlPointsFromPPM_ArcLength() in test_weight_consist.c: the 256-color map is
// resampled to 256 entries, the cumulative CIEDE2000 color difference (arc length) is computed, and
// the n representative colors are placed at equal steps of arc length — so, unlike the Uniformity
// method, they are NOT evenly spaced along the strip. Their positions (0-255) are returned too.
import { nlrgb2cielab, calculateCIEDE2000 } from './colormath.js';
import { toGamut } from './upload.js';

// Resample parsed colormap entries ('rgb' 0-255 or 'lab') to 256 L*a*b* colors, linearly
// interpolating between neighbouring entries (same as sampleColorFromPPM in the research code).
export function lab256FromEntries(entries, space) {
  const w = entries.length;
  const delta = (w - 1) / 255;
  const out = new Array(256);
  for (let i = 0; i < 256; i++) {
    const bi = delta * i;
    const i0 = Math.min(Math.max(Math.floor(bi), 0), w - 1);
    const i1 = Math.min(i0 + 1, w - 1);
    const f = bi - i0;
    const c = [0, 1, 2].map(k => (1.0 - f) * entries[i0][k] + f * entries[i1][k]);
    if (space === 'lab') {
      const g = toGamut({ L: c[0], a: c[1], b: c[2] });
      out[i] = [g.L, g.a, g.b];
    } else {
      out[i] = nlrgb2cielab(c[0], c[1], c[2]);
    }
  }
  return out;
}

// n colors at equal steps of cumulative CIEDE2000 along a 256-entry L*a*b* map.
// Returns { points: [{L, a, b}], positions: [number] }.
export function arcLengthExtract(lab256, n) {
  const W = 256;
  const cum = new Float64Array(W);
  for (let k = 1; k < W; k++) {
    cum[k] = cum[k - 1] + calculateCIEDE2000(
      lab256[k - 1][0], lab256[k - 1][1], lab256[k - 1][2],
      lab256[k][0], lab256[k][1], lab256[k][2]);
  }
  const total = cum[W - 1];
  const T = total > 1e-9 ? total / (n - 1) : 0.0;

  const positions = new Array(n);
  let searchStart = 0;
  for (let i = 0; i < n; i++) {
    const s = i * T;
    let k = searchStart;
    while (k < W - 2 && cum[k + 1] < s) k++;
    searchStart = k;
    const denom = cum[k + 1] - cum[k];
    let alpha = denom > 1e-9 ? (s - cum[k]) / denom : 0.0;
    if (alpha < 0.0) alpha = 0.0;
    if (alpha > 1.0) alpha = 1.0;
    let pos = k + alpha;
    // each representative color must be at least 1.0 beyond the previous one
    if (i > 0 && pos <= positions[i - 1] + 1.0 - 1e-9) pos = positions[i - 1] + 1.0;
    positions[i] = pos;
  }
  // the last one sits exactly at the end of the strip; push earlier ones back if needed
  positions[n - 1] = W - 1;
  for (let i = n - 2; i >= 0; i--) {
    if (positions[i] > positions[i + 1] - 1.0 + 1e-9) positions[i] = positions[i + 1] - 1.0;
    else break;
  }

  const points = positions.map(p0 => {
    const pos = Math.min(Math.max(p0, 0.0), W - 1);
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, W - 1);
    const f = pos - i0;
    const c = [0, 1, 2].map(k => (1.0 - f) * lab256[i0][k] + f * lab256[i1][k]);
    return { L: c[0], a: c[1], b: c[2] };
  });
  return { points, positions };
}

// Adjacent CIEDE2000 differences of a list of {L,a,b} colors (length n-1).
export function adjacentDeltaE(points) {
  const d = new Float64Array(points.length - 1);
  for (let i = 1; i < points.length; i++) {
    d[i - 1] = calculateCIEDE2000(points[i].L, points[i].a, points[i].b,
                                   points[i - 1].L, points[i - 1].a, points[i - 1].b);
  }
  return d;
}

// Indices used to evaluate a generated colormap: 0, 8, ..., 248 plus the last point 255.
export const EVAL_K_GAP = 8;
export function gapIndices() {
  const idx = [];
  for (let i = 0; i < 256; i += EVAL_K_GAP) idx.push(i);
  if (idx[idx.length - 1] !== 255) idx.push(255);
  return idx;
}
