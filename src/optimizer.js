// optimizer.js — Faithful port of SA optimization and e_score from
// test_colormaker_original_divergence_6_fast.c

import {
  calculateCIEDE2000,
  judgeInout,
  judgeInoutEps,
  simPBrettel,
  simDBrettel,
  simTBrettel,
} from './colormath.js';

// ===== Xorshift32 RNG =====
export function xorshift32(state) {
  let x = state[0];
  x ^= (x << 13) & 0xFFFFFFFF;
  x ^= (x >>> 17);
  x ^= (x << 5) & 0xFFFFFFFF;
  x = x >>> 0; // ensure unsigned 32-bit
  state[0] = x;
  return x;
}

export function randRange(min, max, seed) {
  return min + (max - min) * (xorshift32(seed) / 4294967295.0);
}

// ===== Normalize a 3-vector =====
function normalize(vec) {
  const len = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]);
  if (len > 1e-9) {
    const inv = 1.0 / len;
    vec[0] *= inv;
    vec[1] *= inv;
    vec[2] *= inv;
  }
}

// ===== phi function (C code L91-104) =====
function phi(x, y, chi) {
  const requiredY = (x < chi) ? 0.5 * x : 0.5 * chi;
  if (y < requiredY) {
    return (requiredY - y) / requiredY;
  }
  return 0.0;
}

// ===== e_score — objective function (Updated to match test_colormaker_8_fast.c) =====
export function eScore(ls, as, bs, n, dInitial, params, returnDetails = false) {
  if (params.mode === 'consistency') {
    return eScoreConsistency(ls, as, bs, n, dInitial, params, returnDetails);
  }
  const { UP, UD, UT, S1_WEIGHT, u_WEIGHT, q_WEIGHT } = params;
  const u_W = u_WEIGHT ?? 0.1;
  const q_W = q_WEIGHT ?? 0.7;
  const s_W = 1.0 - u_W - q_W;

  if (n < 2) return returnDetails ? {} : 0.0;

  const dij = new Float64Array(n - 1);
  const dijD = new Float64Array(n - 1);
  const dijP = new Float64Array(n - 1);
  const dijT = new Float64Array(n - 1);

  let dijAve = 0, dijAveD = 0, dijAveP = 0, dijAveT = 0;

  for (let i = 1; i < n; i++) {
    dij[i - 1] = calculateCIEDE2000(ls[i], as[i], bs[i], ls[i - 1], as[i - 1], bs[i - 1]);
    dijAve += dij[i - 1];

    if (UD) {
      const iSim = [ls[i], as[i], bs[i]];
      const imSim = [ls[i - 1], as[i - 1], bs[i - 1]];
      simDBrettel(iSim);
      simDBrettel(imSim);
      dijD[i - 1] = calculateCIEDE2000(iSim[0], iSim[1], iSim[2], imSim[0], imSim[1], imSim[2]);
      dijAveD += dijD[i - 1];
    }
    if (UP) {
      const iSim = [ls[i], as[i], bs[i]];
      const imSim = [ls[i - 1], as[i - 1], bs[i - 1]];
      simPBrettel(iSim);
      simPBrettel(imSim);
      dijP[i - 1] = calculateCIEDE2000(iSim[0], iSim[1], iSim[2], imSim[0], imSim[1], imSim[2]);
      dijAveP += dijP[i - 1];
    }
    if (UT) {
      const iSim = [ls[i], as[i], bs[i]];
      const imSim = [ls[i - 1], as[i - 1], bs[i - 1]];
      simTBrettel(iSim);
      simTBrettel(imSim);
      dijT[i - 1] = calculateCIEDE2000(iSim[0], iSim[1], iSim[2], imSim[0], imSim[1], imSim[2]);
      dijAveT += dijT[i - 1];
    }
  }

  const invN1 = 1.0 / (n - 1);
  dijAve *= invN1;
  dijAveD *= invN1;
  dijAveP *= invN1;
  dijAveT *= invN1;

  let sig = 0, sigD = 0, sigP = 0, sigT = 0;
  for (let i = 0; i < n - 1; i++) {
    const d = dij[i] - dijAve;
    sig += d * d;
    if (UD) {
      const dd = dijD[i] - dijAveD;
      sigD += dd * dd;
    }
    if (UP) {
      const dp = dijP[i] - dijAveP;
      sigP += dp * dp;
    }
    if (UT) {
      const dt = dijT[i] - dijAveT;
      sigT += dt * dt;
    }
  }

  if (n > 2) {
    const invN2 = 1.0 / (n - 2);
    sig = Math.sqrt(sig * invN2);
    if (UD) sigD = Math.sqrt(sigD * invN2);
    if (UP) sigP = Math.sqrt(sigP * invN2);
    if (UT) sigT = Math.sqrt(sigT * invN2);
  } else {
    sig = 0;
  }

  const eu = (Math.abs(dijAve) > 1e-9) ? (sig / dijAve) : 0;
  const euD = (UD && dijAveD > 1e-9) ? (sigD / dijAveD) : 0.0;
  const euP = (UP && dijAveP > 1e-9) ? (sigP / dijAveP) : 0.0;
  const euT = (UT && dijAveT > 1e-9) ? (sigT / dijAveT) : 0.0;

  // Smoothness (es)
  let es = 0.0;
  if (n > 2) {
    let vAve = 0.0;
    for (let i = 2; i < n; i++) {
      const vmx = ls[i - 1] - ls[i - 2], vmy = as[i - 1] - as[i - 2], vmz = bs[i - 1] - bs[i - 2];
      const vpx = ls[i] - ls[i - 1], vpy = as[i] - as[i - 1], vpz = bs[i] - bs[i - 1];
      const lenVm = Math.sqrt(vmx * vmx + vmy * vmy + vmz * vmz);
      const lenVp = Math.sqrt(vpx * vpx + vpy * vpy + vpz * vpz);
      if (lenVm > 1e-9 && lenVp > 1e-9) {
        vAve += 1.0 - (vmx * vpx + vmy * vpy + vmz * vpz) / (lenVm * lenVp);
      }
    }
    es = (S1_WEIGHT * vAve) / (2.0 * (n - 2));
  }

  // All-pair CVD psi evaluation
  let ePPsi = 0.0, eDPsi = 0.0, eTPsi = 0.0;

  if ((UP || UD || UT) && q_W > 0) {
    let countP = 0.0, countD = 0.0, countT = 0.0;
    let W_total = 0.0;

    const cacheP = UP ? new Array(n) : null;
    const cacheD = UD ? new Array(n) : null;
    const cacheT = UT ? new Array(n) : null;

    for (let i = 0; i < n; i++) {
      if (UP) { cacheP[i] = [ls[i], as[i], bs[i]]; simPBrettel(cacheP[i]); }
      if (UD) { cacheD[i] = [ls[i], as[i], bs[i]]; simDBrettel(cacheD[i]); }
      if (UT) { cacheT[i] = [ls[i], as[i], bs[i]]; simTBrettel(cacheT[i]); }
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dENormal = calculateCIEDE2000(ls[i], as[i], bs[i], ls[j], as[j], bs[j]);
        const targetDE = 0.5 * Math.min(dENormal, 30.0);
        W_total += targetDE;

        if (targetDE > 1e-6) {
          if (UP) {
            const dEP = calculateCIEDE2000(cacheP[i][0], cacheP[i][1], cacheP[i][2], cacheP[j][0], cacheP[j][1], cacheP[j][2]);
            countP += targetDE * (1.0 - (Math.min(dEP, targetDE) / targetDE));
          }
          if (UD) {
            const dED = calculateCIEDE2000(cacheD[i][0], cacheD[i][1], cacheD[i][2], cacheD[j][0], cacheD[j][1], cacheD[j][2]);
            countD += targetDE * (1.0 - (Math.min(dED, targetDE) / targetDE));
          }
          if (UT) {
            const dET = calculateCIEDE2000(cacheT[i][0], cacheT[i][1], cacheT[i][2], cacheT[j][0], cacheT[j][1], cacheT[j][2]);
            countT += targetDE * (1.0 - (Math.min(dET, targetDE) / targetDE));
          }
        }
      }
    }

    if (W_total > 0.0) {
      if (UP) ePPsi = countP / W_total;
      if (UD) eDPsi = countD / W_total;
      if (UT) eTPsi = countT / W_total;
    } else {
      if (UP) ePPsi = 0.0;
      if (UD) eDPsi = 0.0;
      if (UT) eTPsi = 0.0;
    }
  }

  let countU = 1.0;
  if (UP) countU++;
  if (UD) countU++;
  if (UT) countU++;

  let countPsi = 0.0;
  if (UP) countPsi++;
  if (UD) countPsi++;
  if (UT) countPsi++;
  if (countPsi === 0) countPsi = 1.0;

  const UC = (1.0 / countU) * (eu + euP + euD + euT);
  const UQ = (1.0 / countPsi) * (ePPsi + eDPsi + eTPsi);
  const finalScore = u_W * UC + q_W * UQ + s_W * es;

  if (returnDetails) {
    return {
      finalScore,
      eu, euP, euD, euT,
      ePPsi, eDPsi, eTPsi,
      es,
      UC, UQ
    };
  }

  return finalScore;
}

// ===== Consistency objective — port of compute_F_S / combine_score in test_weight_consist.c =====
// E = w_F * F + w_Q * Q + w_S * S  (w_S = 1 - w_F - w_Q), where
//   F = (1 - N_WEIGHT) / |types| * sum_types sigma(ratio_type) + N_WEIGHT * Fhat
//   ratio_type(i) = adjacent dE of the CVD-simulated colors / adjacent dE of the normal colors
//   sigma = standard deviation of that ratio over the n-1 adjacent pairs
//   Fhat  = mean |adjacent dE - dInitial| (dInitial: adjacent dE of the original colormap)
// params.u_WEIGHT is w_F here. Q and S are the same as in the uniformity objective.
const N_WEIGHT = 0.05;
const LAMBDA = 0.5;
const CHI = 30.0;

export function eScoreConsistency(ls, as, bs, n, dInitial, params, returnDetails = false) {
  const { UP, UD, UT, S1_WEIGHT, u_WEIGHT, q_WEIGHT } = params;
  const wF = u_WEIGHT ?? 0.1;
  const wQ = q_WEIGHT ?? 0.8;
  const wS = 1.0 - wF - wQ;
  const types = [];
  if (UP) types.push(simPBrettel);
  if (UD) types.push(simDBrettel);
  if (UT) types.push(simTBrettel);
  const ct = types.length || 1; // the UI requires at least one type; avoids 0-division
  if (n < 2) return returnDetails ? {} : 0.0;

  // F: adjacent color differences
  let fHat = 0.0;
  const sum = [0, 0, 0], sumSq = [0, 0, 0];
  const nPairs = n - 1;
  for (let i = 1; i < n; i++) {
    const dNow = calculateCIEDE2000(ls[i], as[i], bs[i], ls[i - 1], as[i - 1], bs[i - 1]);
    fHat += Math.abs(dNow - dInitial[i - 1]);
    for (let t = 0; t < types.length; t++) {
      const a1 = [ls[i], as[i], bs[i]], a0 = [ls[i - 1], as[i - 1], bs[i - 1]];
      types[t](a1); types[t](a0);
      const dSim = calculateCIEDE2000(a1[0], a1[1], a1[2], a0[0], a0[1], a0[2]);
      if (dNow > 1e-9) {
        const ratio = dSim / dNow;
        sum[t] += ratio; sumSq[t] += ratio * ratio;
      }
    }
  }
  fHat /= nPairs;
  const sigma = [0, 0, 0];
  for (let t = 0; t < types.length; t++) {
    const mean = sum[t] / nPairs;
    const v = sumSq[t] / nPairs - mean * mean;
    sigma[t] = v > 0 ? Math.sqrt(v) : 0.0;
  }
  let sigmaSum = 0;
  for (let t = 0; t < types.length; t++) sigmaSum += sigma[t];
  const F = (1.0 - N_WEIGHT) / ct * sigmaSum + N_WEIGHT * fHat;

  // Q: contrast over all pairs (same definition as the uniformity method)
  const cache = types.map(sim => {
    const arr = new Array(n);
    for (let i = 0; i < n; i++) { arr[i] = [ls[i], as[i], bs[i]]; sim(arr[i]); }
    return arr;
  });
  let W_total = 0.0;
  const cnt = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dN = calculateCIEDE2000(ls[i], as[i], bs[i], ls[j], as[j], bs[j]);
      const target = LAMBDA * Math.min(dN, CHI);
      W_total += target;
      if (target > 1e-6) {
        for (let t = 0; t < types.length; t++) {
          const c = cache[t];
          const dS = calculateCIEDE2000(c[i][0], c[i][1], c[i][2], c[j][0], c[j][1], c[j][2]);
          cnt[t] += target * (1.0 - Math.min(dS, target) / target);
        }
      }
    }
  }
  const psi = [0, 0, 0];
  if (W_total > 0.0) for (let t = 0; t < types.length; t++) psi[t] = cnt[t] / W_total;
  let psiSum = 0;
  for (let t = 0; t < types.length; t++) psiSum += psi[t];
  const Q = psiSum / ct;

  // S: smoothness of the path in L*a*b*
  let es = 0.0;
  if (n > 2) {
    let vAve = 0.0;
    for (let i = 2; i < n; i++) {
      const vmx = ls[i - 1] - ls[i - 2], vmy = as[i - 1] - as[i - 2], vmz = bs[i - 1] - bs[i - 2];
      const vpx = ls[i] - ls[i - 1], vpy = as[i] - as[i - 1], vpz = bs[i] - bs[i - 1];
      const lenVm = Math.sqrt(vmx * vmx + vmy * vmy + vmz * vmz);
      const lenVp = Math.sqrt(vpx * vpx + vpy * vpy + vpz * vpz);
      if (lenVm > 1e-9 && lenVp > 1e-9) {
        vAve += 1.0 - (vmx * vpx + vmy * vpy + vmz * vpz) / (lenVm * lenVp);
      }
    }
    es = (S1_WEIGHT * vAve) / (2.0 * (n - 2));
  }

  const finalScore = wF * F + wQ * Q + wS * es;
  if (!returnDetails) return finalScore;

  // Map the per-type values back to P / D / T
  const byType = { P: 0, D: 0, T: 0 }, psiByType = { P: 0, D: 0, T: 0 };
  let k = 0;
  if (UP) { byType.P = sigma[k]; psiByType.P = psi[k]; k++; }
  if (UD) { byType.D = sigma[k]; psiByType.D = psi[k]; k++; }
  if (UT) { byType.T = sigma[k]; psiByType.T = psi[k]; k++; }
  return {
    finalScore, F, fHat,
    fP: byType.P, fD: byType.D, fT: byType.T,
    ePPsi: psiByType.P, eDPsi: psiByType.D, eTPsi: psiByType.T,
    es, Q,
  };
}

// ===== Incremental evaluation for the Consistency SA (port of QState in test_weight_consist.c) =====
// SA moves one representative color at a time. Q needs all pairs, but only the pairs that involve the
// moved color change, so the pair table is updated in O(n) instead of recomputed in O(n^2). F and S
// are recomputed (cheap), using the cached CVD simulations of the other colors.
function consistencyTypes(params) {
  const types = [];
  if (params.UP) types.push(simPBrettel);
  if (params.UD) types.push(simDBrettel);
  if (params.UT) types.push(simTBrettel);
  return types;
}

export function psiInit(ls, as, bs, n, types) {
  const T = types.length;
  const cache = types.map(sim => {
    const arr = new Array(n);
    for (let i = 0; i < n; i++) { arr[i] = [ls[i], as[i], bs[i]]; sim(arr[i]); }
    return arr;
  });
  const w = new Float64Array(n * n);
  const c = types.map(() => new Float64Array(n * n));
  let Wt = 0;
  const ct = new Float64Array(T);
  for (let i = 0; i < n; i++) {
    for (let k = i + 1; k < n; k++) {
      const dN = calculateCIEDE2000(ls[i], as[i], bs[i], ls[k], as[k], bs[k]);
      const target = LAMBDA * Math.min(dN, CHI);
      w[i * n + k] = w[k * n + i] = target;
      Wt += 2.0 * target;
      if (target > 1e-6) {
        for (let t = 0; t < T; t++) {
          const a = cache[t][i], b = cache[t][k];
          const dS = calculateCIEDE2000(a[0], a[1], a[2], b[0], b[1], b[2]);
          const v = target * (1.0 - Math.min(dS, target) / target);
          c[t][i * n + k] = c[t][k * n + i] = v;
          ct[t] += 2.0 * v;
        }
      }
    }
  }
  return { n, T, types, cache, w, c, Wt, ct };
}

// Evaluate moving color j to (l, a, b); ls/as/bs are the current colors (the others are unchanged).
export function psiEvalMove(qs, j, l, a, b, ls, as, bs) {
  const { n, T, types, cache, w, c } = qs;
  const newSim = types.map(sim => { const v = [l, a, b]; sim(v); return v; });
  const rowW = new Float64Array(n);
  const rowC = types.map(() => new Float64Array(n));
  let dW = 0.0;
  const dC = new Float64Array(T);
  for (let k = 0; k < n; k++) {
    if (k === j) continue;
    const dN = calculateCIEDE2000(l, a, b, ls[k], as[k], bs[k]);
    const target = LAMBDA * Math.min(dN, CHI);
    rowW[k] = target;
    dW += target - w[j * n + k];
    for (let t = 0; t < T; t++) {
      let v = 0.0;
      if (target > 1e-6) {
        const o = cache[t][k];
        const dS = calculateCIEDE2000(newSim[t][0], newSim[t][1], newSim[t][2], o[0], o[1], o[2]);
        v = target * (1.0 - Math.min(dS, target) / target);
      }
      rowC[t][k] = v;
      dC[t] += v - c[t][j * n + k];
    }
  }
  const Wn = qs.Wt + 2.0 * dW;
  const psi = new Float64Array(T);
  for (let t = 0; t < T; t++) psi[t] = Wn > 0.0 ? (qs.ct[t] + 2.0 * dC[t]) / Wn : 0.0;
  return { j, rowW, rowC, newSim, dW, dC, psi };
}

export function psiCommit(qs, ev) {
  const { n, T, w, c, cache } = qs;
  const j = ev.j;
  for (let k = 0; k < n; k++) {
    if (k === j) continue;
    w[j * n + k] = w[k * n + j] = ev.rowW[k];
    for (let t = 0; t < T; t++) c[t][j * n + k] = c[t][k * n + j] = ev.rowC[t][k];
  }
  qs.Wt += 2.0 * ev.dW;
  for (let t = 0; t < T; t++) { qs.ct[t] += 2.0 * ev.dC[t]; cache[t][j] = ev.newSim[t]; }
}

// F and S for the candidate colors (color j already moved), using cached simulations.
// Returns the Consistency objective E = wF*F + wQ*Q + wS*S given the candidate's Q terms (ev.psi).
export function consistencyScoreFast(qs, ev, ls, as, bs, dInitial, params) {
  const { n, T } = qs;
  const { S1_WEIGHT, u_WEIGHT, q_WEIGHT } = params;
  const wF = u_WEIGHT ?? 0.1, wQ = q_WEIGHT ?? 0.8, wS = 1.0 - wF - wQ;
  const j = ev.j;
  let fHat = 0.0;
  const sum = new Float64Array(T), sumSq = new Float64Array(T);
  const nPairs = n - 1;
  for (let i = 1; i < n; i++) {
    const dNow = calculateCIEDE2000(ls[i], as[i], bs[i], ls[i - 1], as[i - 1], bs[i - 1]);
    fHat += Math.abs(dNow - dInitial[i - 1]);
    if (dNow > 1e-9) {
      for (let t = 0; t < T; t++) {
        const a1 = i === j ? ev.newSim[t] : qs.cache[t][i];
        const a0 = (i - 1) === j ? ev.newSim[t] : qs.cache[t][i - 1];
        const dSim = calculateCIEDE2000(a1[0], a1[1], a1[2], a0[0], a0[1], a0[2]);
        const ratio = dSim / dNow;
        sum[t] += ratio; sumSq[t] += ratio * ratio;
      }
    }
  }
  fHat /= nPairs;
  let sigmaSum = 0.0, psiSum = 0.0;
  for (let t = 0; t < T; t++) {
    const mean = sum[t] / nPairs;
    const v = sumSq[t] / nPairs - mean * mean;
    sigmaSum += v > 0 ? Math.sqrt(v) : 0.0;
    psiSum += ev.psi[t];
  }
  const ct = T || 1;
  const F = (1.0 - N_WEIGHT) / ct * sigmaSum + N_WEIGHT * fHat;
  const Q = psiSum / ct;

  let es = 0.0;
  if (n > 2) {
    let vAve = 0.0;
    for (let i = 2; i < n; i++) {
      const vmx = ls[i - 1] - ls[i - 2], vmy = as[i - 1] - as[i - 2], vmz = bs[i - 1] - bs[i - 2];
      const vpx = ls[i] - ls[i - 1], vpy = as[i] - as[i - 1], vpz = bs[i] - bs[i - 1];
      const lenVm = Math.sqrt(vmx * vmx + vmy * vmy + vmz * vmz);
      const lenVp = Math.sqrt(vpx * vpx + vpy * vpy + vpz * vpz);
      if (lenVm > 1e-9 && lenVp > 1e-9) vAve += 1.0 - (vmx * vpx + vmy * vpy + vmz * vpz) / (lenVm * lenVp);
    }
    es = (S1_WEIGHT * vAve) / (2.0 * (n - 2));
  }
  return wF * F + wQ * Q + wS * es;
}

// ===== Interpolate colors by position (C code interpolateColorsByIndex) =====
// pos[i] is the position (0-255) of representative color i on the 256-color strip; the colors are
// interpolated linearly between neighbouring positions. Used by the Consistency method, whose
// representative colors are not evenly spaced.
export function interpolateColorsByIndex(colors, n, pos, ls, as, bs) {
  const lsOut = new Float64Array(colors);
  const asOut = new Float64Array(colors);
  const bsOut = new Float64Array(colors);
  let seg = 0;
  for (let k = 0; k < colors; k++) {
    const t = k;
    while (seg < n - 2 && pos[seg + 1] < t) seg++;
    const denom = pos[seg + 1] - pos[seg];
    let alpha = denom > 1e-9 ? (t - pos[seg]) / denom : 0.0;
    if (alpha < 0.0) alpha = 0.0;
    if (alpha > 1.0) alpha = 1.0;
    lsOut[k] = ls[seg] + alpha * (ls[seg + 1] - ls[seg]);
    asOut[k] = as[seg] + alpha * (as[seg + 1] - as[seg]);
    bsOut[k] = bs[seg] + alpha * (bs[seg + 1] - bs[seg]);
    if (lsOut[k] > 100.0) lsOut[k] = 100.0;
    if (lsOut[k] < 0.0) lsOut[k] = 0.0;
    let guard = 0;
    while (judgeInoutEps(lsOut[k], asOut[k], bsOut[k]) === 1) {
      asOut[k] *= 0.99;
      bsOut[k] *= 0.99;
      if (++guard > 10000) { asOut[k] = 0.0; bsOut[k] = 0.0; break; }
    }
  }
  return { ls: lsOut, as: asOut, bs: bsOut };
}

// ===== Interpolate colors (C code L806-824) =====
export function interpolateColors(colors, n, ls, as, bs) {
  const lsOut = new Float64Array(colors);
  const asOut = new Float64Array(colors);
  const bsOut = new Float64Array(colors);

  for (let k = 0; k < colors; k++) {
    const t = k * (n - 1) / (colors - 1);
    let i0 = Math.floor(t);
    let i1 = i0 + 1;
    if (i1 >= n) i1 = n - 1;
    const alpha = t - i0;

    lsOut[k] = ls[i0] + alpha * (ls[i1] - ls[i0]);
    asOut[k] = as[i0] + alpha * (as[i1] - as[i0]);
    bsOut[k] = bs[i0] + alpha * (bs[i1] - bs[i0]);

    // Gamut correction: shrink a*, b* by 0.99 until in gamut
    while (judgeInout(lsOut[k], asOut[k], bsOut[k]) === 1) {
      if (lsOut[k] <= 0.0 || lsOut[k] >= 100.0) break;
      asOut[k] *= 0.99;
      bsOut[k] *= 0.99;
    }
  }

  return { ls: lsOut, as: asOut, bs: bsOut };
}

// ===== SA Optimization (C code L289-475) =====
export function runSA(initialLs, initialAs, initialBs, prefIndices, params, onProgress) {
  const {
    n, tInit, tEnd, alpha, iterCount,
    UP, UD, UT,
    S1_WEIGHT, u_WEIGHT, q_WEIGHT,
    R, R_dash,
  } = params;
  const consistency = params.mode === 'consistency';
  // Consistency uses the research code's gamut test (tolerance, L* = 0 / 100 allowed)
  const inGamut = consistency
    ? (l, a, b) => judgeInoutEps(l, a, b) === 0
    : (l, a, b) => judgeInout(l, a, b) === 0;

  // Copy initial arrays
  const ls = new Float64Array(initialLs);
  const as = new Float64Array(initialAs);
  const bs = new Float64Array(initialBs);
  const lsCur = new Float64Array(ls);
  const asCur = new Float64Array(as);
  const bsCur = new Float64Array(bs);
  const lsBest = new Float64Array(ls);
  const asBest = new Float64Array(as);
  const bsBest = new Float64Array(bs);

  // Build preference set
  const prefSet = new Set(prefIndices);

  // Initial adjacent ΔE
  // Consistency: the reference is the adjacent dE of the ORIGINAL colormap (given by the caller)
  const dInitial = (consistency && params.dInitial)
    ? Float64Array.from(params.dInitial)
    : new Float64Array(n - 1);
  if (!(consistency && params.dInitial)) {
    for (let i = 1; i < n; i++) {
      dInitial[i - 1] = calculateCIEDE2000(ls[i], as[i], bs[i], ls[i - 1], as[i - 1], bs[i - 1]);
    }
  }

  const scoreParams = { UP, UD, UT, S1_WEIGHT, u_WEIGHT, q_WEIGHT, mode: params.mode };
  let eCur = eScore(lsCur, asCur, bsCur, n, dInitial, scoreParams);
  let eBestVal = eCur;
  // Consistency: incremental pair table for Q (same as the research code); everything else unchanged
  const qs = consistency ? psiInit(lsCur, asCur, bsCur, n, consistencyTypes(params)) : null;

  // RNG seed
  const seed = [Date.now() & 0xFFFFFFFF];
  if (seed[0] === 0) seed[0] = 1;

  let t = tInit;
  let totalSteps = 0;
  const totalExpected = Math.ceil(Math.log(tEnd / tInit) / Math.log(alpha)) * iterCount;

  // SA loop
  do {
    for (let iter = 0; iter < iterCount; iter++) {
      const j = xorshift32(seed) % n;
      const isPref = prefSet.has(j);

      // Bias radius depends on preference status
      const biasR = isPref ? R : R_dash;

      // Original position
      const origL = ls[j];
      const origA = as[j];
      const origB = bs[j];

      // Direction toward initial position
      const u = [0, 0, 0];
      u[0] = origL - lsCur[j];
      u[1] = origA - asCur[j];
      u[2] = origB - bsCur[j];
      const lenU = Math.sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2]);
      if (lenU > 1e-9) {
        normalize(u);
      } else {
        u[0] = 0; u[1] = 0; u[2] = 0;
      }

      const MAX_TRIES = 30;
      let tries = 0;
      let succeeded = false;
      const lSaved = lsCur[j], aSaved = asCur[j], bSaved = bsCur[j];

      while (tries < MAX_TRIES) {
        const r = [randRange(-1.0, 1.0, seed), randRange(-1.0, 1.0, seed), randRange(-1.0, 1.0, seed)];
        normalize(r);

        const currentDE = calculateCIEDE2000(lsCur[j], asCur[j], bsCur[j], origL, origA, origB);
        let bias = 0.5 * (currentDE / biasR);
        if (bias > 1.0) bias = 1.0;

        const o = [
          (1.0 - bias) * r[0] + bias * u[0],
          (1.0 - bias) * r[1] + bias * u[1],
          (1.0 - bias) * r[2] + bias * u[2],
        ];
        normalize(o);

        lsCur[j] += 1.0 * o[0];
        asCur[j] += 1.0 * o[1];
        bsCur[j] += 1.0 * o[2];
        if (consistency) { // the research code clamps L* to [0, 100]
          if (lsCur[j] > 100.0) lsCur[j] = 100.0;
          if (lsCur[j] < 0.0) lsCur[j] = 0.0;
        }

        // Lightness order check
        let orderViolation = false;
        if (j > 0) {
          const diffInit = ls[j] - ls[j - 1];
          const diffCurr = lsCur[j] - lsCur[j - 1];
          if (diffInit * diffCurr < 0) orderViolation = true;
        }
        if (!orderViolation && j < n - 1) {
          const diffInit = ls[j + 1] - ls[j];
          const diffCurr = lsCur[j + 1] - lsCur[j];
          if (diffInit * diffCurr < 0) orderViolation = true;
        }

        if (!orderViolation && inGamut(lsCur[j], asCur[j], bsCur[j])) {
          succeeded = true;
          break;
        }

        lsCur[j] = lSaved;
        asCur[j] = aSaved;
        bsCur[j] = bSaved;
        tries++;
      }

      if (!succeeded) {
        iter--;
        continue;
      }

      let ev = null;
      let eNew;
      if (qs) {
        ev = psiEvalMove(qs, j, lsCur[j], asCur[j], bsCur[j], lsCur, asCur, bsCur);
        eNew = consistencyScoreFast(qs, ev, lsCur, asCur, bsCur, dInitial, scoreParams);
      } else {
        eNew = eScore(lsCur, asCur, bsCur, n, dInitial, scoreParams);
      }
      const delta = eNew - eBestVal;

      if (delta <= 0) {
        if (qs) psiCommit(qs, ev);
        eBestVal = eNew;
        lsBest.set(lsCur);
        asBest.set(asCur);
        bsBest.set(bsCur);
      } else {
        const prob = 1.0 / (1.0 + Math.exp(delta / t));
        if (randRange(0.0, 1.0, seed) < prob) {
          if (qs) psiCommit(qs, ev);
          eBestVal = eNew;
          lsBest.set(lsCur);
          asBest.set(asCur);
          bsBest.set(bsCur);
        } else {
          lsCur[j] = lsBest[j];
          asCur[j] = asBest[j];
          bsCur[j] = bsBest[j];
        }
      }

      totalSteps++;
    }

    t *= alpha;

    // Progress callback
    if (onProgress) {
      const progress = Math.min(1.0, totalSteps / Math.abs(totalExpected));
      onProgress(progress, eBestVal, lsBest, asBest, bsBest);
    }
  } while (t >= tEnd);

  // Copy best back
  ls.set(lsBest);
  as.set(asBest);
  bs.set(bsBest);

  return {
    ls: Array.from(lsBest),
    as: Array.from(asBest),
    bs: Array.from(bsBest),
    eScore: eBestVal,
    details: eScore(lsBest, asBest, bsBest, n, dInitial, scoreParams, true),
  };
}
