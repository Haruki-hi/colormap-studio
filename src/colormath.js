// colormath.js — Faithful port of cproc_brettel.c / cproc_brettel.h
// All constants and algorithms preserved exactly from the C source.

// ===== Constants =====
const X0 = 0.9505;
const Y0 = 1.0000;
const Z0 = 1.0890;
const PI = 3.14159265358979;
const EPSILON = 1e-10;

// LMS wavelength vectors (Brettel)
const LMS_475 = [0.052354, 0.146673, 0.956693];
const LMS_575 = [0.984794, 0.876158, 0.001653];
const LMS_485 = [0.093195, 0.212335, 0.565807];
const LMS_660 = [0.109163, 0.033768, 0.000000];
// Equal-energy white LMS
const LMS_E = [109.7458, 105.2238, 98.1506];

// ===== sRGB Gamma =====
export function gammaEncode(x) {
  if (x <= 0.0031308) {
    return 255.0 * (12.92 * x);
  } else {
    return 255.0 * (1.055 * Math.pow(x, 1.0 / 2.4) - 0.055);
  }
}

export function gammaDecode(x) {
  const v = x / 255.0;
  if (v <= 0.04045) {
    return v / 12.92;
  } else {
    return Math.pow((v + 0.055) / 1.055, 2.4);
  }
}

// ===== Lab helper functions =====
function labF(x) {
  return x > 0.008856 ? Math.pow(x, 1.0 / 3.0) : 7.78 * x + 16.0 / 116.0;
}

function labFInv(x) {
  return x > 0.2069 ? x * x * x : (1.0 / 7.78) * (x - 16.0 / 116.0);
}

// ===== Color Conversions =====

// RGB [0-255] → LMS (Smith–Pokorny via gamma decode)
export function rgb2lms(r, g, b) {
  const lr = gammaDecode(r);
  const lg = gammaDecode(g);
  const lb = gammaDecode(b);
  return [
    0.31394 * lr + 0.64664 * lg + 0.04652 * lb,
    0.15530 * lr + 0.76961 * lg + 0.08673 * lb,
    0.01772 * lr + 0.10945 * lg + 0.87277 * lb,
  ];
}

// LMS → XYZ
export function lms2xyz(l, m, s) {
  return [
    1.85994 * l - 1.12938 * m + 0.21990 * s,
    0.3612 * l + 0.6388 * m + 0.0000 * s,
    0.0000 * l + 0.0000 * m + 1.0891 * s,
  ];
}

// XYZ → Lab
export function xyz2lab(x, y, z) {
  const fy = labF(y / Y0);
  const fx = labF(x / X0);
  const fz = labF(z / Z0);
  return [
    116.0 * fy - 16.0,
    500.0 * (fx - fy),
    200.0 * (fy - fz),
  ];
}

// nlRGB [0-255] → Lab
export function nlrgb2cielab(r, g, b) {
  const lr = gammaDecode(r);
  const lg = gammaDecode(g);
  const lb = gammaDecode(b);
  const x = 0.4124 * lr + 0.3576 * lg + 0.1805 * lb;
  const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  const z = 0.0193 * lr + 0.1192 * lg + 0.9505 * lb;
  return [
    116.0 * labF(y / Y0) - 16.0,
    500.0 * (labF(x / X0) - labF(y / Y0)),
    200.0 * (labF(y / Y0) - labF(z / Z0)),
  ];
}

// Lab → nlRGB [0-255] (with gamut clamp + gamma encode)
export function cielab2nlrgb(ls, as, bs) {
  const fy = (ls + 16.0) / 116.0;
  const fx = as / 500.0 + fy;
  const fz = fy - bs / 200.0;
  const x = X0 * labFInv(fx);
  const y = Y0 * labFInv(fy);
  const z = Z0 * labFInv(fz);
  let lr = 3.2406 * x - 1.5372 * y - 0.4986 * z;
  let lg = -0.9689 * x + 1.8758 * y + 0.0415 * z;
  let lb = 0.0557 * x - 0.2040 * y + 1.0570 * z;
  // Clamp to [0, 1]
  if (lr < 0.0) lr = 0.0; if (lr > 1.0) lr = 1.0;
  if (lg < 0.0) lg = 0.0; if (lg > 1.0) lg = 1.0;
  if (lb < 0.0) lb = 0.0; if (lb > 1.0) lb = 1.0;
  return [gammaEncode(lr), gammaEncode(lg), gammaEncode(lb)];
}

// Lab → linear RGB (no clamp, no gamma)
export function cielab2rgb(ls, as, bs) {
  const fy = (ls + 16.0) / 116.0;
  const fx = as / 500.0 + fy;
  const fz = fy - bs / 200.0;
  const x = X0 * labFInv(fx);
  const y = Y0 * labFInv(fy);
  const z = Z0 * labFInv(fz);
  return [
    3.2406 * x - 1.5372 * y - 0.4986 * z,
    -0.9689 * x + 1.8758 * y + 0.0415 * z,
    0.0557 * x - 0.2040 * y + 1.0570 * z,
  ];
}

// ===== Gamut Check =====
// Returns 1 if OUT of gamut, 0 if in gamut (same as C convention)
export function judgeInout(ls, as, bs) {
  if (ls <= 0.0 || ls >= 100.0) return 1;
  const fy = (ls + 16.0) / 116.0;
  const fx = as / 500.0 + fy;
  const fz = fy - bs / 200.0;
  const x = X0 * labFInv(fx);
  const y = Y0 * labFInv(fy);
  const z = Z0 * labFInv(fz);
  const lr = 3.2406 * x - 1.5372 * y - 0.4986 * z;
  const lg = -0.9689 * x + 1.8758 * y + 0.0415 * z;
  const lb = 0.0557 * x - 0.2040 * y + 1.0570 * z;
  if (lr >= 0.0 && lr <= 1.0 && lg >= 0.0 && lg <= 1.0 && lb >= 0.0 && lb <= 1.0) {
    return 0;
  }
  return 1;
}

// ===== CIEDE2000 =====
function myAtan(y, x) {
  let value = Math.atan2(y, x) * 180.0 / PI;
  return value < 0.0 ? value + 360.0 : value;
}

function mySin(x) {
  return Math.sin(x * PI / 180.0);
}

function myCos(x) {
  return Math.cos(x * PI / 180.0);
}

function getHPrime(aPrime, b) {
  const bothZero = (Math.abs(aPrime) < EPSILON) && (Math.abs(b) < EPSILON);
  return bothZero ? 0.0 : myAtan(b, aPrime);
}

function getDeltaHPrime(C1Prime, C2Prime, h1Prime, h2Prime) {
  if (C1Prime * C2Prime < EPSILON) return 0.0;
  const diff = h2Prime - h1Prime;
  if (Math.abs(diff) <= 180.0) return diff;
  if (diff > 180.0) return diff - 360.0;
  return diff + 360.0;
}

function getHPrimeBar(C1Prime, C2Prime, h1Prime, h2Prime) {
  if (C1Prime * C2Prime < EPSILON) return h1Prime + h2Prime;
  const dist = Math.abs(h1Prime - h2Prime);
  const sum = h1Prime + h2Prime;
  if (dist <= 180.0) return 0.5 * sum;
  if (sum < 360.0) return 0.5 * (sum + 360.0);
  return 0.5 * (sum - 360.0);
}

export function calculateCIEDE2000(L1, a1, b1, L2, a2, b2) {
  // Step 1
  const C1ab = Math.sqrt(a1 * a1 + b1 * b1);
  const C2ab = Math.sqrt(a2 * a2 + b2 * b2);
  const CabBar = 0.5 * (C1ab + C2ab);
  const G = 0.5 * (1.0 - Math.sqrt(Math.pow(CabBar, 7.0) / (Math.pow(CabBar, 7.0) + Math.pow(25.0, 7.0))));
  const a1Prime = (1.0 + G) * a1;
  const a2Prime = (1.0 + G) * a2;
  const C1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
  const C2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);
  const h1Prime = getHPrime(a1Prime, b1);
  const h2Prime = getHPrime(a2Prime, b2);

  // Step 2
  const deltaLPrime = L2 - L1;
  const deltaCPrime = C2Prime - C1Prime;
  const deltaHPrimeVal = getDeltaHPrime(C1Prime, C2Prime, h1Prime, h2Prime);
  const deltaHPrime = 2.0 * Math.sqrt(C1Prime * C2Prime) * mySin(0.5 * deltaHPrimeVal);

  // Step 3
  const LPrimeBar = 0.5 * (L1 + L2);
  const CPrimeBar = 0.5 * (C1Prime + C2Prime);
  const hPrimeBar = getHPrimeBar(C1Prime, C2Prime, h1Prime, h2Prime);

  const T = 1.0 - 0.17 * myCos(hPrimeBar - 30.0) + 0.24 * myCos(2.0 * hPrimeBar) +
            0.32 * myCos(3.0 * hPrimeBar + 6.0) - 0.20 * myCos(4.0 * hPrimeBar - 63.0);

  const deltaTheta = 30.0 * Math.exp(-((hPrimeBar - 275.0) / 25.0) * ((hPrimeBar - 275.0) / 25.0));

  const RC = 2.0 * Math.sqrt(Math.pow(CPrimeBar, 7.0) / (Math.pow(CPrimeBar, 7.0) + Math.pow(25.0, 7.0)));
  const SL = 1.0 + (0.015 * (LPrimeBar - 50.0) * (LPrimeBar - 50.0)) /
             Math.sqrt(20.0 + (LPrimeBar - 50.0) * (LPrimeBar - 50.0));
  const SC = 1.0 + 0.045 * CPrimeBar;
  const SH = 1.0 + 0.015 * CPrimeBar * T;
  const RT = -mySin(2.0 * deltaTheta) * RC;

  const kL = 1.0, kC = 1.0, kH = 1.0;
  const dL = deltaLPrime / (kL * SL);
  const dC = deltaCPrime / (kC * SC);
  const dH = deltaHPrime / (kH * SH);

  return Math.sqrt(dL * dL + dC * dC + dH * dH + RT * dC * dH);
}

// ===== Brettel CVD Simulation =====

// Protan simulation
export function simPBrettel(lab) {
  const rgb = cielab2nlrgb(lab[0], lab[1], lab[2]);
  const [l, m, s] = rgb2lms(rgb[0], rgb[1], rgb[2]);
  let lDash, mDash, sDash;

  if (s / m < LMS_E[2] / LMS_E[1]) {
    const a = LMS_E[1] * LMS_575[2] - LMS_E[2] * LMS_575[1];
    const b = LMS_E[2] * LMS_575[0] - LMS_E[0] * LMS_575[2];
    const c = LMS_E[0] * LMS_575[1] - LMS_E[1] * LMS_575[0];
    lDash = -(b * m + c * s) / a;
    mDash = m;
    sDash = s;
  } else {
    const a = LMS_E[1] * LMS_475[2] - LMS_E[2] * LMS_475[1];
    const b = LMS_E[2] * LMS_475[0] - LMS_E[0] * LMS_475[2];
    const c = LMS_E[0] * LMS_475[1] - LMS_E[1] * LMS_475[0];
    lDash = -(b * m + c * s) / a;
    mDash = m;
    sDash = s;
  }

  const [x, y, z] = lms2xyz(lDash, mDash, sDash);
  const result = xyz2lab(x, y, z);
  lab[0] = result[0];
  lab[1] = result[1];
  lab[2] = result[2];
}

// Deutan simulation
export function simDBrettel(lab) {
  const rgb = cielab2nlrgb(lab[0], lab[1], lab[2]);
  const [l, m, s] = rgb2lms(rgb[0], rgb[1], rgb[2]);
  let lDash, mDash, sDash;

  if (s / l < LMS_E[2] / LMS_E[0]) {
    const a = LMS_E[1] * LMS_575[2] - LMS_E[2] * LMS_575[1];
    const b = LMS_E[2] * LMS_575[0] - LMS_E[0] * LMS_575[2];
    const c = LMS_E[0] * LMS_575[1] - LMS_E[1] * LMS_575[0];
    lDash = l;
    mDash = -(a * l + c * s) / b;
    sDash = s;
  } else {
    const a = LMS_E[1] * LMS_475[2] - LMS_E[2] * LMS_475[1];
    const b = LMS_E[2] * LMS_475[0] - LMS_E[0] * LMS_475[2];
    const c = LMS_E[0] * LMS_475[1] - LMS_E[1] * LMS_475[0];
    lDash = l;
    mDash = -(a * l + c * s) / b;
    sDash = s;
  }

  const [x, y, z] = lms2xyz(lDash, mDash, sDash);
  const result = xyz2lab(x, y, z);
  lab[0] = result[0];
  lab[1] = result[1];
  lab[2] = result[2];
}

// Tritan simulation
export function simTBrettel(lab) {
  const rgb = cielab2nlrgb(lab[0], lab[1], lab[2]);
  const [l, m, s] = rgb2lms(rgb[0], rgb[1], rgb[2]);
  let lDash, mDash, sDash;

  if (m / l < LMS_E[1] / LMS_E[0]) {
    const a = LMS_E[1] * LMS_660[2] - LMS_E[2] * LMS_660[1];
    const b = LMS_E[2] * LMS_660[0] - LMS_E[0] * LMS_660[2];
    const c = LMS_E[0] * LMS_660[1] - LMS_E[1] * LMS_660[0];
    lDash = l;
    mDash = m;
    sDash = -(a * l + b * m) / c;
  } else {
    const a = LMS_E[1] * LMS_485[2] - LMS_E[2] * LMS_485[1];
    const b = LMS_E[2] * LMS_485[0] - LMS_E[0] * LMS_485[2];
    const c = LMS_E[0] * LMS_485[1] - LMS_E[1] * LMS_485[0];
    lDash = l;
    mDash = m;
    sDash = -(a * l + b * m) / c;
  }

  const [x, y, z] = lms2xyz(lDash, mDash, sDash);
  const result = xyz2lab(x, y, z);
  lab[0] = result[0];
  lab[1] = result[1];
  lab[2] = result[2];
}

// ===== HSL ↔ RGB (for UI color picker) =====
export function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

export function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s, l];
}

// ===== Lab → CSS RGB string =====
export function lab2cssRgb(L, a, b) {
  const rgb = cielab2nlrgb(L, a, b);
  return `rgb(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])})`;
}
