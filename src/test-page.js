// test-page.js — Test Page: apply colormaps to real data & images
import {
  cielab2nlrgb,
  simPBrettel,
  simDBrettel,
  simTBrettel,
  calculateCIEDE2000
} from './colormath.js';
import { interpolateColors } from './optimizer.js';
import { getSharedColormap, PRESETS } from './main.js';

const $ = (sel) => document.querySelector(sel);

// ===== State =====
let activeDatasetId = null; 
let activeData = null;       // { values: Float64Array[], rows, cols, min, max }
let isImageMode = false; // true when showing a PNG image
let activeImagePixels = null; // Uint8ClampedArray of grayscale pixels
let activeImageW = 0;
let activeImageH = 0;
let currentLUT = null;
let currentInterp = null;
let renderVersion = 0;
let tooltipInitialized = false;
let lastCTDatasetId = null; // track dataset changes to avoid resetting sliders mid-session

// ===== Datasets Registration =====
const TEST_DATASETS = [
  { id: 'proc_linear_x',    type: 'proc', label: 'Math: Linear Gradient X',    group: 'Procedural' },
  { id: 'proc_linear_y',    type: 'proc', label: 'Math: Linear Gradient Y',    group: 'Procedural' },
  { id: 'proc_radial',      type: 'proc', label: 'Math: Radial Distance',      group: 'Procedural' },
  { id: 'proc_peak',        type: 'proc', label: 'Math: Gaussian Peak',        group: 'Procedural' },
  { id: 'proc_ripple',      type: 'proc', label: 'Math: Ripple Pattern',       group: 'Procedural' },
  { id: 'proc_saddle',      type: 'proc', label: 'Math: Saddle Function',      group: 'Procedural' },
  { id: 'proc_checkerboard',type: 'proc', label: 'Math: Checkerboard',         group: 'Procedural' },
  { id: 'proc_spiral',      type: 'proc', label: 'Math: Archimedean Spiral',   group: 'Procedural' },
  { id: 'proc_sinc',        type: 'proc', label: 'Math: Sinc (2D)',            group: 'Procedural' },
  { id: 'proc_diagonal_wave',type:'proc', label: 'Math: Diagonal Wave',        group: 'Procedural' },

  // Planetary Computer Inspired
  { id: 'landcover_sample', type: 'csv', label: 'Land Cover (Categorical)', group: 'Geospatial (Planetary)' },
  { id: 'nasa_ndvi',        type: 'csv', label: 'NASA: NDVI (Vegetation)',  group: 'Geospatial (Planetary)' },
  { id: 'nasa_sst',         type: 'csv', label: 'NASA: Sea Surface Temp',   group: 'Geospatial (Planetary)' },

  { id: 'datasample1', type: 'csv', label: 'Sample: Diagonal Pattern', group: 'Samples' },
  { id: 'datasample2', type: 'csv', label: 'Sample: Fractal Pattern',  group: 'Samples' },
  { id: 'datasample3', type: 'csv', label: 'Sample: Fluid Flow',       group: 'Samples' },
  { id: 'datasample4', type: 'csv', label: 'Sample: Topography',       group: 'Samples' },
  { id: 'datasample5', type: 'csv', label: 'Sample: Interference',     group: 'Samples' },
  { id: 'datasample6', type: 'csv', label: 'Sample: Magnetic Field',   group: 'Samples' },
  { id: 'datasample7', type: 'csv', label: 'Sample: Stress Map',       group: 'Samples' },

  { id: 'LENNA',         type: 'image', label: 'Lenna (Grayscale)',       group: 'Images' },
  { id: 'ct_hemorrhage', type: 'image', label: 'CT Brain Hemorrhage',     group: 'Images' },
];

// Presets for 0-255 grayscale PNG images (not raw HU values)
const CT_WINDOW_PRESETS = {
  full:           { ww: 255, wl: 128, label: 'Full Range' },
  soft_tissue:    { ww: 150, wl: 110, label: 'Soft Tissue' },
  bone:           { ww: 220, wl: 170, label: 'Bone' },
  brain:          { ww: 80,  wl: 120, label: 'Brain' },
  blood:          { ww: 60,  wl: 130, label: 'Blood/Hemorrhage' },
  high_contrast:  { ww: 40,  wl: 120, label: 'High Contrast' },
};
const CT_IMAGE_NAMES = ['ct_hemorrhage'];
const CT_DATASET_IDS = ['ct_hemorrhage'];

// ===== Procedural Generators =====
function generateProceduralData(id) {
  const cols = 256, rows = 256;
  const values = [];
  let min = Infinity, max = -Infinity;
  for(let r=0; r<rows; r++) {
    const rowObj = [];
    for(let c=0; c<cols; c++) {
      let v = 0;
      const nx = c / (cols-1), ny = r / (rows-1);
      if(id === 'proc_linear_x') v = nx;
      else if(id === 'proc_linear_y') v = ny;
      else if(id === 'proc_radial') {
        const dx = nx - 0.5, dy = ny - 0.5;
        v = Math.max(0, 1.0 - Math.sqrt(dx*dx + dy*dy) * 2);
      }
      else if(id === 'proc_peak') {
        const dx = nx - 0.5, dy = ny - 0.5;
        v = Math.exp(- (dx*dx+dy*dy)*10);
      }
      else if(id === 'proc_ripple') {
        const dx = nx - 0.5, dy = ny - 0.5;
        const d = Math.sqrt(dx*dx + dy*dy);
        v = (Math.sin(d * 40) + 1) / 2 * Math.exp(-d*3);
      }
      else if(id === 'proc_saddle') {
        v = (nx - 0.5) * (nx - 0.5) - (ny - 0.5) * (ny - 0.5);
      }
      else if(id === 'proc_checkerboard') {
        const fx = Math.floor(nx * 8), fy = Math.floor(ny * 8);
        v = (fx + fy) % 2 === 0 ? 1 : 0;
      }
      else if(id === 'proc_spiral') {
        const dx = nx - 0.5, dy = ny - 0.5;
        const angle = Math.atan2(dy, dx) / (2 * Math.PI) + 0.5;
        const dist = Math.sqrt(dx*dx + dy*dy) * 2;
        v = (angle + dist) % 1;
      }
      else if(id === 'proc_sinc') {
        const dx = (nx - 0.5) * 10, dy = (ny - 0.5) * 10;
        const d = Math.sqrt(dx*dx + dy*dy);
        v = d < 0.0001 ? 1 : Math.sin(d) / d;
      }
      else if(id === 'proc_diagonal_wave') {
        v = (Math.sin((nx + ny) * Math.PI * 6) + 1) / 2;
      }
      if(v < min) min = v;
      if(v > max) max = v;
      rowObj.push(v);
    }
    values.push(rowObj);
  }
  return { values, rows, cols, min, max, procedural: true };
}

// ===== Colormap Build =====
function buildColormapLUT(colormapName) {
  let ls, as, bs, n;
  if (colormapName === 'current') {
    const shared = getSharedColormap();
    if (shared && shared.length >= 2) {
      n = shared.length;
      ls = shared.map(c => c.L);
      as = shared.map(c => c.a);
      bs = shared.map(c => c.b);
    } else {
      const data = PRESETS.turbo;
      n = data.length;
      ls = data.map(c => c[0]); as = data.map(c => c[1]); bs = data.map(c => c[2]);
    }
  } else {
    const data = PRESETS[colormapName];
    if (!data) return null;
    n = data.length;
    ls = data.map(c => c[0]); as = data.map(c => c[1]); bs = data.map(c => c[2]);
  }

  const interp = interpolateColors(256, n, ls, as, bs);
  const lut = new Array(256);
  for (let i = 0; i < 256; i++) {
    const rgb = cielab2nlrgb(interp.ls[i], interp.as[i], interp.bs[i]);
    lut[i] = [Math.round(Math.max(0, Math.min(255, rgb[0]))),
              Math.round(Math.max(0, Math.min(255, rgb[1]))),
              Math.round(Math.max(0, Math.min(255, rgb[2])))];
  }
  return { lut, interp };
}

function buildCvdLUT(interp, simFn) {
  const lut = new Array(256);
  for (let i = 0; i < 256; i++) {
    const lab = [interp.ls[i], interp.as[i], interp.bs[i]];
    simFn(lab);
    const rgb = cielab2nlrgb(lab[0], lab[1], lab[2]);
    lut[i] = [Math.round(Math.max(0, Math.min(255, rgb[0]))),
              Math.round(Math.max(0, Math.min(255, rgb[1]))),
              Math.round(Math.max(0, Math.min(255, rgb[2])))];
  }
  return lut;
}

// ===== Loaders =====
async function loadCSVData(name) {
  const resp = await fetch(`/figure-data/${name}.csv`);
  if (!resp.ok) throw new Error(`Failed to load ${name}.csv: ${resp.status}`);
  const text = await resp.text();
  const lines = text.trim().split('\n').filter(l => l.trim());
  const rows = lines.length;
  const values = [];
  let globalMin = Infinity, globalMax = -Infinity;
  for (const line of lines) {
    const nums = line.split(',').map(Number);
    for (const v of nums) {
      if (!isNaN(v)) {
        if (v < globalMin) globalMin = v;
        if (v > globalMax) globalMax = v;
      }
    }
    values.push(nums);
  }
  return { values, rows, cols: values[0].length, min: globalMin, max: globalMax };
}

async function loadPNGImage(name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height);
      const gray = new Uint8ClampedArray(img.width * img.height);
      for (let i = 0; i < gray.length; i++) {
        const r = imgData.data[i * 4];
        const g = imgData.data[i * 4 + 1];
        const b = imgData.data[i * 4 + 2];
        gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }
      resolve({ pixels: gray, width: img.width, height: img.height });
    };
    img.onerror = () => reject(new Error(`Failed to load: ${name}.png`));
    img.src = `/figure-data/${name}.png`;
  });
}

const dataCache = new Map();

async function fetchDataset(id) {
  if(dataCache.has(id)) return dataCache.get(id);
  const ds = TEST_DATASETS.find(d => d.id === id);
  if(!ds) return null;
  let res = null;
  if(ds.type === 'proc') res = generateProceduralData(id);
  else if(ds.type === 'csv') res = await loadCSVData(id);
  else if(ds.type === 'image') res = await loadPNGImage(id);
  
  if(res) dataCache.set(id, res);
  return res;
}

// ===== Rendering Logics =====
function getNormalizedValue(val, dataName, dsMin, dsMax) {
  const logScale = (dataName === 'astro_mock' || dataName === 'nasa_chlorophyll');
  const diverging = (dataName === 'nasa_ndvi');
  const categorical = (dataName === 'landcover_sample');

  if (logScale) {
    const safeMin = dsMin > 0 ? dsMin : 1e-5;
    const lMin = Math.log10(safeMin);
    const lRange = Math.log10(Math.max(dsMax, 1e-4)) - lMin || 1;
    return (Math.log10(Math.max(val, safeMin)) - lMin) / lRange;
  } else if (diverging) {
    const dMax = Math.max(Math.abs(dsMin), Math.abs(dsMax)) || 1;
    return (val + dMax) / (2 * dMax);
  } else if (categorical) {
    return (val / 9.0);
  } else {
    return (val - dsMin) / (dsMax - dsMin || 1);
  }
}

function getValueIndex(val, dataName, dsMin, dsMax, ww, wl) {
  if (ww !== undefined && wl !== undefined) {
    const minVal = wl - ww / 2;
    const normalized = (val - minVal) / ww;
    return Math.min(255, Math.max(0, Math.round(normalized * 255)));
  }
  const norm = getNormalizedValue(val, dataName, dsMin, dsMax);
  return Math.min(255, Math.max(0, Math.round(norm * 255)));
}

function drawLegend(canvas, lut, minLabel, maxLabel, unit = '') {
  if (!canvas || !lut) return;
  const ctx = canvas.getContext('2d');
  const cw = canvas.width;
  const ch = canvas.height;
  const padding = Math.floor(cw * 0.06);
  const barW = cw - padding * 2;
  const barH = Math.max(10, Math.floor(ch * 0.032));
  const barY = ch - barH - Math.floor(ch * 0.045);

  // Colormap gradient bar
  for (let x = 0; x < barW; x++) {
    const i = Math.min(Math.floor(x / barW * 256), 255);
    ctx.fillStyle = `rgb(${lut[i][0]},${lut[i][1]},${lut[i][2]})`;
    ctx.fillRect(padding + x, barY, 1, barH);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(padding, barY, barW, barH);

  // Background for labels
  const lblH = Math.floor(ch * 0.038);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(padding, barY + barH + 1, barW, lblH);

  // Label text
  const fs = Math.max(9, Math.min(13, Math.floor(cw * 0.032)));
  ctx.font = `600 ${fs}px Inter, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const midLabel = ((parseFloat(minLabel) + parseFloat(maxLabel)) / 2).toFixed(
    Number.isInteger(parseFloat(minLabel)) ? 0 : 2
  );
  const textY = barY + barH + lblH * 0.78;
  ctx.textAlign = 'left';
  ctx.fillText(minLabel + unit, padding + 2, textY);
  ctx.textAlign = 'center';
  ctx.fillText(midLabel + unit, padding + barW / 2, textY);
  ctx.textAlign = 'right';
  ctx.fillText(maxLabel + unit, padding + barW - 2, textY);
  ctx.textAlign = 'left';
}

function applyWindowing(gray, ww, wl) {
  if(ww === undefined || wl === undefined) return gray;
  const minVal = wl - ww / 2;
  const normalized = (gray - minVal) / ww;
  return Math.min(255, Math.max(0, Math.round(normalized * 255)));
}

function drawHeatmap(canvas, data, lut, dataName, ww, wl, showLegend = true) {
  if (!canvas || !data || !lut) return;
  const ctx = canvas.getContext('2d');
  canvas.width = data.cols; canvas.height = data.rows;
  const imgData = ctx.createImageData(data.cols, data.rows);
  let p = 0;
  for (let r = 0; r < data.rows; r++) {
    for (let c = 0; c < data.cols; c++) {
      const v = data.values[r]?.[c];
      if (v === undefined || isNaN(v)) {
        imgData.data[p+3] = 0; p += 4; continue;
      }
      const idx = getValueIndex(v, dataName, data.min, data.max, ww, wl);
      imgData.data[p++] = lut[idx][0];
      imgData.data[p++] = lut[idx][1];
      imgData.data[p++] = lut[idx][2];
      imgData.data[p++] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const ds = TEST_DATASETS.find(d => d.id === dataName);
  if(ds?.hasOverlay) drawScientificOverlay(canvas, dataName);

  if (showLegend) {
    if (ww !== undefined && wl !== undefined) {
      drawLegend(canvas, lut, (wl - ww/2).toFixed(0), (wl + ww/2).toFixed(0), ds?.isCT ? ' HU' : '');
    } else {
      drawLegend(canvas, lut, data.min.toFixed(2), data.max.toFixed(2));
    }
  }
}

function drawScientificOverlay(canvas, dataName) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  
  if (dataName === 'scientific_magnetic_coils') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    const coils = [{ z: -0.5, r: 0.8 }, { z: 0.5, r: 0.8 }];
    coils.forEach(coil => {
      const mapX = (x) => (x + 2) / 4 * w;
      const mapZ = (z) => (z + 2) / 4 * h;
      ctx.beginPath();
      for(let a=0; a<=Math.PI*2; a+=0.1) {
        const sx = coil.r * Math.cos(a);
        const sy = coil.r * Math.sin(a);
        const sz = coil.z;
        const px = sx;
        const pz = sz + sy * 0.2;
        const cx = mapX(px);
        const cz = mapZ(pz);
        if(a===0) ctx.moveTo(cx, cz); else ctx.lineTo(cx, cz);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(mapX(coil.r), mapZ(coil.z), 5, 0, Math.PI*2);
      ctx.arc(mapX(-coil.r), mapZ(coil.z), 5, 0, Math.PI*2);
      ctx.fill();
    });

    // Draw magnetic field lines approximation
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    const mapX = (x) => (x + 2) / 4 * w;
    const mapZ = (z) => (z + 2) / 4 * h;
    
    const drawFieldLine = (x1, z1, cx1, cz1, cx2, cz2, x2, z2) => {
      ctx.beginPath();
      ctx.moveTo(mapX(x1), mapZ(z1));
      ctx.bezierCurveTo(mapX(cx1), mapZ(cz1), mapX(cx2), mapZ(cz2), mapX(x2), mapZ(z2));
      ctx.stroke();
    };

    // Central straight line
    ctx.beginPath(); ctx.moveTo(mapX(0), mapZ(-2)); ctx.lineTo(mapX(0), mapZ(2)); ctx.stroke();
    
    // Curved lines
    for(let rLines = 0.2; rLines <= 0.6; rLines += 0.2) {
      drawFieldLine(-rLines, -2, -rLines*3, -1, -rLines*3, 1, -rLines, 2);
      drawFieldLine(rLines, -2, rLines*3, -1, rLines*3, 1, rLines, 2);
    }
    // Outer loop lines
    const outerR = 1.2;
    drawFieldLine(-outerR, 0, -outerR*1.5, -1, -0.8, -1.8, -0.5, -2);
    drawFieldLine(outerR, 0, outerR*1.5, -1, 0.8, -1.8, 0.5, -2);
    drawFieldLine(-outerR, 0, -outerR*1.5, 1, -0.8, 1.8, -0.5, 2);
    drawFieldLine(outerR, 0, outerR*1.5, 1, 0.8, 1.8, 0.5, 2);

    ctx.setLineDash([]);
  }
}

function drawImageMap(canvas, pixels, w, h, lut, ww, wl, showLegend = true) {
  if (!canvas || !pixels || !lut) return;
  const ctx = canvas.getContext('2d');
  canvas.width = w; canvas.height = h;
  const imgData = ctx.createImageData(w, h);
  let p = 0;
  for (let i = 0; i < w * h; i++) {
    const idx = applyWindowing(pixels[i], ww, wl);
    imgData.data[p++] = lut[idx][0];
    imgData.data[p++] = lut[idx][1];
    imgData.data[p++] = lut[idx][2];
    imgData.data[p++] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  if (showLegend) {
    if (ww !== undefined && wl !== undefined) {
      drawLegend(canvas, lut, (wl - ww/2).toFixed(0), (wl + ww/2).toFixed(0));
    } else {
      drawLegend(canvas, lut, '0', '255');
    }
  }
}

function drawTestColormapBar(colormapResult) {
  const canvas = $('#testColormapBar');
  if (!canvas || !colormapResult) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.clientWidth || 280;
  const h = canvas.clientHeight || 36;
  canvas.width = w * window.devicePixelRatio; canvas.height = h * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  for (let x = 0; x < w; x++) {
    const i = Math.min(Math.floor(x / w * 256), 255);
    ctx.fillStyle = `rgb(${colormapResult.lut[i][0]},${colormapResult.lut[i][1]},${colormapResult.lut[i][2]})`;
    ctx.fillRect(x, 0, 1, h);
  }
}

function updateColormapLabels(minVal, maxVal) {
  const lbls = document.querySelectorAll('#testDetailView .colormap-labels span');
  if(lbls.length >= 3) {
    lbls[0].textContent = typeof minVal === 'number' ? (minVal % 1 === 0 ? minVal : minVal.toFixed(2)) : '0.0';
    const midVal = (minVal + maxVal) / 2;
    lbls[1].textContent = typeof minVal === 'number' ? (midVal % 1 === 0 ? midVal : midVal.toFixed(2)) : '0.5';
    lbls[2].textContent = typeof maxVal === 'number' ? (maxVal % 1 === 0 ? maxVal : maxVal.toFixed(2)) : '1.0';
  }
}

async function renderAnalyticMode(dataName) {
  if(!currentInterp) return;
  const targetCVD = $('#analyticTargetCvd').value || 'P';
  const simFn = targetCVD === 'P' ? simPBrettel : (targetCVD === 'D' ? simDBrettel : simTBrettel);
  const labNormal = new Array(256), labCVD = new Array(256);
  for(let i=0; i<256; i++) {
     const l = currentInterp.ls[i], a = currentInterp.as[i], b = currentInterp.bs[i];
     labNormal[i] = [l, a, b];
     const cLab = [l, a, b]; simFn(cLab); labCVD[i] = cLab;
  }
  let w, h, getIdx;
  const ww = parseInt($('#ctWW')?.value) || undefined;
  const wl = parseInt($('#ctWL')?.value) || undefined;
  if(isImageMode) {
      w = activeImageW; h = activeImageH;
      getIdx = (x, y) => applyWindowing(activeImagePixels[y*w + x], ww, wl);
  } else {
      w = activeData.cols; h = activeData.rows;
      getIdx = (x, y) => {
          const v = activeData.values[y]?.[x];
          if(v === undefined || isNaN(v)) return -1;
          return getValueIndex(v, dataName, activeData.min, activeData.max, ww, wl);
      };
  }
  const cNorm = $('#canvasAnalyticNormal'), cCVD = $('#canvasAnalyticCVD'), cDiff = $('#canvasAnalyticDiff');
  [cNorm, cCVD, cDiff].forEach(c => { c.width = w; c.height = h; });
  const ctxNorm = cNorm.getContext('2d'), imgNorm = ctxNorm.createImageData(w, h);
  const ctxCVD = cCVD.getContext('2d'), imgCVD = ctxCVD.createImageData(w, h);
  const ctxDiff = cDiff.getContext('2d'), imgDiff = ctxDiff.createImageData(w, h);
  let maxDiff = -Infinity, minDiff = Infinity, sumDiff = 0, sumSq = 0, pCount = 0;
  for(let y=0; y<h-1; y++) {
      for(let x=0; x<w-1; x++) {
          const iBase = getIdx(x, y), iRight = getIdx(x+1, y), iDown = getIdx(x, y+1);
          if(iBase < 0 || iRight < 0 || iDown < 0) continue;
          const dENX = calculateCIEDE2000(labNormal[iBase][0], labNormal[iBase][1], labNormal[iBase][2], labNormal[iRight][0], labNormal[iRight][1], labNormal[iRight][2]);
          const dENY = calculateCIEDE2000(labNormal[iBase][0], labNormal[iBase][1], labNormal[iBase][2], labNormal[iDown][0], labNormal[iDown][1], labNormal[iDown][2]);
          const dEN = Math.max(dENX, dENY);
          const dECX = calculateCIEDE2000(labCVD[iBase][0], labCVD[iBase][1], labCVD[iBase][2], labCVD[iRight][0], labCVD[iRight][1], labCVD[iRight][2]);
          const dECY = calculateCIEDE2000(labCVD[iBase][0], labCVD[iBase][1], labCVD[iBase][2], labCVD[iDown][0], labCVD[iDown][1], labCVD[iDown][2]);
          const dEC = Math.max(dECX, dECY);
          const diff = dEN - dEC; 
          if(diff > maxDiff) maxDiff = diff; if(diff < minDiff) minDiff = diff;
          sumDiff += diff; sumSq += diff * diff; pCount++;
          const p = (y*w + x)*4;
          const gn = Math.min(255, dEN * 10);
          imgNorm.data[p] = imgNorm.data[p+1] = imgNorm.data[p+2] = gn; imgNorm.data[p+3] = 255;
          const gc = Math.min(255, dEC * 10);
          imgCVD.data[p] = imgCVD.data[p+1] = imgCVD.data[p+2] = gc; imgCVD.data[p+3] = 255;
          let rr=255, gg=255, bb=255;
          if(diff > 0) { const scale = Math.min(1.0, diff / 5.0); gg = 255 - scale * 255; bb = 255 - scale * 255; }
          else { const scale = Math.min(1.0, (-diff) / 5.0); rr = 255 - scale * 255; gg = 255 - scale * 255; }
          imgDiff.data[p] = rr; imgDiff.data[p+1] = gg; imgDiff.data[p+2] = bb; imgDiff.data[p+3] = 255;
      }
  }
  ctxNorm.putImageData(imgNorm, 0, 0); ctxCVD.putImageData(imgCVD, 0, 0); ctxDiff.putImageData(imgDiff, 0, 0);
  if(pCount > 0) {
      const avg = sumDiff / pCount; const vari = (sumSq / pCount) - (avg * avg);
      $('#statMax').textContent = maxDiff.toFixed(2); $('#statMin').textContent = minDiff.toFixed(2);
      $('#statAvg').textContent = avg.toFixed(2); $('#statVar').textContent = vari.toFixed(2);
  }
}

function showGallery() {
  $('#testGalleryView').style.display = ''; $('#testDetailView').style.display = 'none';
  renderGallery();
}

function showDetail(id) {
  activeDatasetId = id;
  lastCTDatasetId = null; // force CT slider reset when opening a new dataset
  const ds = TEST_DATASETS.find(d => d.id === id);
  if(ds) $('#detailTitle').textContent = ds.label;
  $('#testGalleryView').style.display = 'none'; $('#testDetailView').style.display = '';
  if($('#testViewMode').value !== 'standard') $('#testViewMode').value = 'standard';
  renderDetail();
}

async function renderGallery() {
  const colormapName = $('#galleryColormapSelect')?.value || 'turbo';
  const cm = buildColormapLUT(colormapName);
  if(!cm) return;
  const lut = cm.lut;
  const grid = $('#galleryGrid');
  grid.innerHTML = ''; 
  const groups = {};
  TEST_DATASETS.forEach(ds => { if(!groups[ds.group]) groups[ds.group] = []; groups[ds.group].push(ds); });
  for(const g in groups) {
      const gTitle = document.createElement('h3'); gTitle.className = 'gallery-group-title'; gTitle.textContent = g; grid.appendChild(gTitle);
      const gContainer = document.createElement('div'); gContainer.className = 'gallery-group-container'; grid.appendChild(gContainer);
      for(const ds of groups[g]) {
        const card = document.createElement('div'); card.className = 'gallery-card';
        const canvasContainer = document.createElement('div'); canvasContainer.className = 'gallery-canvas-wrapper';
        const cvs = document.createElement('canvas'); cvs.className = 'gallery-thumbnail';
        const title = document.createElement('div'); title.className = 'gallery-card-title'; title.textContent = ds.label;
        canvasContainer.appendChild(cvs); card.appendChild(canvasContainer); card.appendChild(title); gContainer.appendChild(card);
        card.addEventListener('click', () => showDetail(ds.id));
        fetchDataset(ds.id).then(data => {
           if(!data) return;
           if(ds.type === 'image') {
              let ww, wl;
              if(CT_IMAGE_NAMES.includes(ds.id)) { ww = CT_WINDOW_PRESETS.full.ww; wl = CT_WINDOW_PRESETS.full.wl; }
              drawImageMap(cvs, data.pixels, data.width, data.height, lut, ww, wl, false);
           } else {
              let ww, wl;
              if(ds.isCT) { ww = 80; wl = 40; } // Standard brain window (HU)
              drawHeatmap(cvs, data, lut, ds.id, ww, wl, false);
           }
        }).catch(err => { console.warn('Failed to load for gallery:', ds.id, err); title.textContent += ' (Error)'; });
      }
  }
}

export async function renderDetail() {
  if(!activeDatasetId) return;
  const thisVer = ++renderVersion;
  const mode = $('#testViewMode').value;
  $('#cvdSimulationControls').style.display = mode === 'standard' ? '' : 'none';
  $('#testVisGrid').style.display = mode === 'standard' ? '' : 'none';
  $('#cvdAnalyticControls').style.display = mode === 'analytic' ? '' : 'none';
  $('#testAnalyticGrid').style.display = mode === 'analytic' ? '' : 'none';
  $('#analyticsInfo').style.display = mode === 'analytic' ? '' : 'none';
  const cmName = $('#testColormapSelect')?.value || 'current';
  const cm = buildColormapLUT(cmName);
  if(!cm) return;
  currentLUT = cm.lut; currentInterp = cm.interp;
  drawTestColormapBar(cm);
  $('#testDataSize').textContent = 'Loading...';
  let data;
  try { data = await fetchDataset(activeDatasetId); } catch(e) { $('#testDataSize').textContent = 'Error'; return; }
  if(thisVer !== renderVersion) return;
  const datasetConfig = TEST_DATASETS.find(d => d.id === activeDatasetId);
  isImageMode = (datasetConfig?.type === 'image');
  updateAttribution(activeDatasetId); updateCTControls(activeDatasetId);
  
  const isTargetCT = CT_DATASET_IDS.includes(activeDatasetId) || datasetConfig?.isCT;
  const ww = isTargetCT ? (parseInt($('#ctWW')?.value) || undefined) : undefined;
  const wl = isTargetCT ? (parseInt($('#ctWL')?.value) || undefined) : undefined;
  
  if(isImageMode) {
     activeImagePixels = data.pixels; activeImageW = data.width; activeImageH = data.height; activeData = null;
     $('#testDataSize').textContent = `${data.width} × ${data.height}`;
     $('#testDataRange').textContent = (ww !== undefined) ? `WW: ${ww}, WL: ${wl}` : `0 - 255 (Grayscale)`;
     if (ww !== undefined && wl !== undefined) updateColormapLabels(wl - ww/2, wl + ww/2); else updateColormapLabels(0, 255);
     if(mode === 'standard') {
         drawImageMap($('#testCanvasNormal'), activeImagePixels, activeImageW, activeImageH, currentLUT, ww, wl);
         if($('#testCvdP').checked) drawImageMap($('#testCanvasP'), activeImagePixels, activeImageW, activeImageH, buildCvdLUT(currentInterp, simPBrettel), ww, wl);
         if($('#testCvdD').checked) drawImageMap($('#testCanvasD'), activeImagePixels, activeImageW, activeImageH, buildCvdLUT(currentInterp, simDBrettel), ww, wl);
         if($('#testCvdT').checked) drawImageMap($('#testCanvasT'), activeImagePixels, activeImageW, activeImageH, buildCvdLUT(currentInterp, simTBrettel), ww, wl);
     } else renderAnalyticMode(activeDatasetId);
  } else {
     activeImagePixels = null; activeData = data;
     $('#testDataSize').textContent = `${data.cols} × ${data.rows}`;
     $('#testDataRange').textContent = (ww !== undefined && datasetConfig.isCT) ? `WW: ${ww}, WL: ${wl}` : `${data.min.toFixed(3)} - ${data.max.toFixed(3)}`;
     if (ww !== undefined && datasetConfig.isCT) updateColormapLabels(wl - ww/2, wl + ww/2); else updateColormapLabels(activeData.min, activeData.max);
     if(mode === 'standard') {
         drawHeatmap($('#testCanvasNormal'), activeData, currentLUT, activeDatasetId, ww, wl);
         if($('#testCvdP').checked) drawHeatmap($('#testCanvasP'), activeData, buildCvdLUT(currentInterp, simPBrettel), activeDatasetId, ww, wl);
         if($('#testCvdD').checked) drawHeatmap($('#testCanvasD'), activeData, buildCvdLUT(currentInterp, simDBrettel), activeDatasetId, ww, wl);
         if($('#testCvdT').checked) drawHeatmap($('#testCanvasT'), activeData, buildCvdLUT(currentInterp, simTBrettel), activeDatasetId, ww, wl);
     } else renderAnalyticMode(activeDatasetId);
  }
  if(mode === 'standard') {
      if($('#testCvdP').checked) $('#testCardP').style.display=''; else $('#testCardP').style.display='none';
      if($('#testCvdD').checked) $('#testCardD').style.display=''; else $('#testCardD').style.display='none';
      if($('#testCvdT').checked) $('#testCardT').style.display=''; else $('#testCardT').style.display='none';
  }
  initTooltip();
}

function updateCTControls(id) {
  const ds = TEST_DATASETS.find(d => d.id === id);
  const show = CT_DATASET_IDS.includes(id) || ds?.isCT;
  const group = $('#ctWindowingGroup'); if(group) group.style.display = show ? '' : 'none';
  if (!show) return;

  // Only reset slider values when switching to a different CT dataset.
  // If the same dataset is re-rendered (e.g. slider moved), preserve current values.
  if (id === lastCTDatasetId) return;
  lastCTDatasetId = id;

  const ctWW = $('#ctWW'), ctWL = $('#ctWL'), ctWWVal = $('#ctWWValue'), ctWLVal = $('#ctWLValue');
  const ctPreset = $('#ctWindowPreset');
  const preset = CT_WINDOW_PRESETS.full;
  if (ctWW) { ctWW.min = 1; ctWW.max = 255; ctWW.value = preset.ww; if(ctWWVal) ctWWVal.textContent = preset.ww; }
  if (ctWL) { ctWL.min = 0; ctWL.max = 255; ctWL.value = preset.wl; if(ctWLVal) ctWLVal.textContent = preset.wl; }
  if (ctPreset) ctPreset.value = 'full';
}

function updateAttribution(dataName) {
  const attribution = $('#dataAttribution'); if(!attribution) return;
  const attrSources = {
    'ct_hemorrhage': `<strong>CT Brain Hemorrhage</strong> (PNG grayscale, 0–255 range)`,
    'scientific_orbital': `<strong>Atomic Orbital (3d)</strong> (PyVista Inspired)`,
    'scientific_magnetic_coils': `<strong>Magnetic Field (Coils)</strong> (PyVista Inspired)`,
    'scientific_ct_phantom': `<strong>Shepp-Logan CT Phantom</strong> — HU values. WW/WL sliders control Hounsfield windowing.`,
    'medical_brain_ct': `<strong>Synthetic Brain CT</strong> — Realistic HU values (air: −1000, brain: ~35, hemorrhage: ~75, bone: ~1500). Use brain/blood presets.`,
    'landcover_sample': `<strong>Land Cover Classification</strong> (Planetary Computer Inspired)`,
    'nasa_ndvi': `<strong>Vegetation Index (NDVI)</strong> (NASA NEO)`,
    'nasa_sst': `<strong>Sea Surface Temperature</strong> (NASA NEO)`,
  };
  if (attrSources[dataName]) {
    attribution.style.display = ''; attribution.querySelector('.attribution-body').innerHTML = attrSources[dataName];
  } else attribution.style.display = 'none';
}

function initTooltip() {
  if (tooltipInitialized) return;
  tooltipInitialized = true;
  const canvas = $('#testCanvasNormal'); if (!canvas) return;
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const tooltip = $('#testTooltip'); if (!tooltip || !currentLUT) return;
    const ww = parseInt($('#ctWW')?.value) || undefined, wl = parseInt($('#ctWL')?.value) || undefined;
    if (isImageMode && activeImagePixels) {
      const px = Math.floor(x / rect.width * activeImageW), py = Math.floor(y / rect.height * activeImageH);
      if (px >= 0 && px < activeImageW && py >= 0 && py < activeImageH) {
        const gray = activeImagePixels[py * activeImageW + px], idx = applyWindowing(gray, ww, wl);
        tooltip.style.display = 'flex'; $('#tooltipSwatch').style.backgroundColor = `rgb(${currentLUT[idx][0]},${currentLUT[idx][1]},${currentLUT[idx][2]})`;
        $('#tooltipText').textContent = (ww!==undefined) ? `Gray: ${gray}, Win: ${idx}` : `Gray: ${gray}`;
      }
    } else if (activeData) {
      const col = Math.floor(x / rect.width * activeData.cols), row = Math.floor(y / rect.height * activeData.rows);
      if (row >= 0 && row < activeData.rows && col >= 0 && col < activeData.cols) {
        const val = activeData.values[row]?.[col]; if (val === undefined || isNaN(val)) return;
        const idx = getValueIndex(val, activeDatasetId, activeData.min, activeData.max, ww, wl);
        tooltip.style.display = 'flex'; $('#tooltipSwatch').style.backgroundColor = `rgb(${currentLUT[idx][0]},${currentLUT[idx][1]},${currentLUT[idx][2]})`;
        $('#tooltipText').textContent = (ww !== undefined && TEST_DATASETS.find(d=>d.id===activeDatasetId)?.isCT) ? `HU: ${val.toFixed(1)}, Win: ${idx}` : `Val: ${val.toFixed(4)}`;
      }
    }
  });
  canvas.addEventListener('mouseleave', () => { const tooltip = $('#testTooltip'); if (tooltip) tooltip.style.display = 'none'; });
}

export function initTestPage() {
  $('#btnBackToGallery')?.addEventListener('click', showGallery);
  $('#galleryColormapSelect')?.addEventListener('change', renderGallery);
  $('#testColormapSelect')?.addEventListener('change', renderDetail);
  $('#testViewMode')?.addEventListener('change', renderDetail);
  $('#testCvdP')?.addEventListener('change', renderDetail);
  $('#testCvdD')?.addEventListener('change', renderDetail);
  $('#testCvdT')?.addEventListener('change', renderDetail);
  $('#analyticTargetCvd')?.addEventListener('change', renderDetail);
  const ctWW = $('#ctWW'), ctWL = $('#ctWL'), ctPreset = $('#ctWindowPreset');
  if (ctWW) ctWW.addEventListener('input', () => { $('#ctWWValue').textContent = ctWW.value; if (ctPreset) ctPreset.value = 'custom'; renderDetail(); });
  if (ctWL) ctWL.addEventListener('input', () => { $('#ctWLValue').textContent = ctWL.value; if (ctPreset) ctPreset.value = 'custom'; renderDetail(); });
  if (ctPreset) {
    ctPreset.addEventListener('change', () => {
      const ds = TEST_DATASETS.find(d => d.id === activeDatasetId);
      const isHU = ds?.isCT && ds?.type === 'csv';
      const HU_PRESETS = {
        full:          { ww: 4000, wl: 250 },
        soft_tissue:   { ww: 400,  wl: 40  },
        bone:          { ww: 1500, wl: 300 },
        brain:         { ww: 80,   wl: 40  },
        blood:         { ww: 80,   wl: 60  },
        high_contrast: { ww: 40,   wl: 40  },
      };
      const preset = isHU ? HU_PRESETS[ctPreset.value] : CT_WINDOW_PRESETS[ctPreset.value];
      if (preset) {
        if (ctWW) { ctWW.value = preset.ww; $('#ctWWValue').textContent = preset.ww; }
        if (ctWL) { ctWL.value = preset.wl; $('#ctWLValue').textContent = preset.wl; }
        renderDetail();
      }
    });
  }
  showGallery();
}

export const renderTestPage = renderDetail;
