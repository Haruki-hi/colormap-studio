// main.js — Colormap Studio UI (v3: multi-page with routing)
import {
  cielab2nlrgb,
  nlrgb2cielab,
  lab2cssRgb,
  cielab2rgb,
  simPBrettel,
  simDBrettel,
  simTBrettel,
  judgeInout,
} from './colormath.js';
import { interpolateColors, eScore } from './optimizer.js';
import { initTestPage, renderTestPage } from './test-page.js';
import { initTutorialPage, renderTutorialPage } from './tutorial-page.js';
import { loadColormapFile } from './upload.js';

// ===== Constants =====
const N_SLOTS = 15;
const GAMUT_RANGE = 128; // a*, b* range: [-128, 128]

// ===== State =====
const state = {
  // 15 slots: each is null (empty) or { L, a, b }
  slots: new Array(N_SLOTS).fill(null),
  prefIndices: new Set(),
  selectedSlot: -1,
  isOptimizing: false,
  optimizedSlots: null,
  worker: null,
  currentPage: 'generator',
};

// ===== DOM =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== Exported Preset Colormaps (from CSV files) =====
export const PRESETS = {
  turbo: [
    [11.802072, 23.186639, -20.096918],
    [34.884716, 30.105999, -55.586986],
    [52.415900, 23.363969, -65.299466],
    [65.250490, -1.005214, -52.006343],
    [75.759737, -38.379965, -14.644431],
    [83.524547, -61.896808, 21.334241],
    [88.582971, -68.421880, 56.600581],
    [90.634093, -54.323615, 77.013386],
    [87.850770, -29.043554, 77.730947],
    [81.729891, 2.668687, 71.320993],
    [72.600878, 29.623636, 68.045122],
    [60.243999, 51.925176, 64.900747],
    [49.264412, 60.480672, 59.565294],
    [38.090224, 57.347842, 51.332851],
    [24.413835, 45.654469, 35.694715],
  ],
  plasma: [
    [15.229841, 46.678503, -64.726589],
    [20.421672, 54.070114, -67.232624],
    [25.255561, 59.594334, -65.843286],
    [30.030985, 63.775840, -60.856843],
    [34.685585, 65.482789, -50.749297],
    [39.536401, 64.338103, -35.956142],
    [44.701581, 60.762809, -17.775026],
    [49.993860, 56.252631, 0.901035],
    [55.516817, 51.160430, 18.725219],
    [61.356175, 44.171920, 35.366513],
    [67.242442, 36.244271, 51.036394],
    [73.592152, 25.306850, 64.465002],
    [80.087542, 11.925796, 75.134706],
    [86.909400, -4.834080, 82.185674],
    [94.139056, -24.419163, 88.237580],
  ],
  viridis: [
    [14.903119, 40.640068, -32.331579],
    [20.932873, 37.439359, -38.744113],
    [26.837938, 28.900355, -40.700745],
    [32.705035, 15.806065, -37.267608],
    [38.084507, 2.790021, -31.206501],
    [43.484680, -9.229961, -23.991053],
    [48.727437, -20.032374, -15.952721],
    [54.022665, -30.267191, -6.831171],
    [59.366716, -39.737420, 3.855665],
    [64.530728, -47.463127, 16.741399],
    [69.987627, -51.896620, 32.721826],
    [75.122104, -50.098856, 50.544040],
    [80.293799, -41.381915, 68.048202],
    [85.515688, -26.827034, 81.123049],
    [90.853708, -10.336353, 85.506829],
  ],
  afmhot: [
    [0.000000, 0.000000, 0.000000],
    [3.454929, 15.499723, 5.460207],
    [11.919308, 32.303802, 18.742042],
    [21.091889, 42.916860, 32.124615],
    [30.660134, 49.813560, 43.961316],
    [42.175998, 49.825652, 54.057596],
    [54.451781, 46.996564, 63.908474],
    [66.781960, 43.126561, 73.833818],
    [74.654788, 25.198509, 72.705100],
    [83.425764, 7.447323, 68.276177],
    [92.806458, -8.829300, 62.619607],
    [97.972044, -14.955579, 52.023765],
    [98.480720, -11.064051, 35.405052],
    [99.171238, -5.936168, 17.447331],
    [100.000000, 0.000000, 0.000000],
  ],
  jet: [
    [12.811984, 47.238170, -64.333616],
    [25.701516, 68.370971, -93.114355],
    [33.228922, 76.320041, -106.303894],
    [45.121953, 42.389216, -86.575532],
    [64.617281, -2.493289, -55.037897],
    [85.262502, -43.980815, -15.439540],
    [89.848522, -62.850346, 21.881106],
    [90.378763, -61.937424, 51.669194],
    [92.493693, -48.635334, 77.966580],
    [95.336429, -26.049930, 92.310870],
    [79.453802, 13.796659, 81.969211],
    [64.935528, 48.179331, 72.798523],
    [55.600771, 73.320319, 68.116800],
    [43.771460, 69.158068, 58.036062],
    [25.296684, 47.781983, 37.762393],
  ],
  RdYlGn: [
    [34.271271, 58.620118, 29.318535],
    [43.639185, 62.604331, 41.447600],
    [53.406325, 58.041455, 46.306378],
    [64.000986, 45.588334, 48.162031],
    [74.847224, 25.289132, 50.095093],
    [84.251477, 8.530477, 47.443948],
    [92.248987, -3.313777, 40.956645],
    [98.284470, -9.945125, 31.194883],
    [93.000673, -18.943462, 41.517593],
    [86.582306, -27.469576, 47.301872],
    [79.419186, -36.218765, 47.243253],
    [71.056868, -43.267779, 39.014716],
    [61.131290, -48.577411, 32.367134],
    [50.233423, -46.060127, 26.404755],
    [38.157295, -38.417799, 20.439327],
  ],
  Spectral: [
    [33.316251, 58.196392, 9.599110],
    [44.425605, 60.170911, 20.196906],
    [54.635227, 55.321447, 35.009336],
    [64.000986, 45.588334, 48.162031],
    [74.847224, 25.289132, 50.095093],
    [84.251477, 8.530477, 47.443948],
    [92.248987, -3.313777, 40.956645],
    [98.293135, -9.880161, 30.955254],
    [94.826128, -16.472676, 39.563002],
    [89.005489, -22.593845, 34.320429],
    [81.710313, -28.353992, 20.354629],
    [73.742033, -33.969594, 8.802524],
    [61.524912, -20.897542, -17.425899],
    [49.078787, 1.107614, -38.231937],
    [38.864372, 27.153468, -43.039596],
  ],
  RdGn: [
    [34.843558, 55.931709, 40.226666],
    [43.406291, 48.298892, 36.689507],
    [51.933082, 40.160946, 33.348657],
    [60.563113, 32.055985, 30.138578],
    [69.092849, 24.508213, 26.606914],
    [77.709850, 16.390467, 23.171322],
    [86.291393, 8.392006, 20.020392],
    [94.642287, 0.681507, 16.482499],
    [86.282600, -4.521058, 18.647711],
    [77.668761, -9.673774, 20.844502],
    [69.002019, -14.603862, 23.217280],
    [60.546397, -19.839598, 25.396381],
    [52.019715, -24.937096, 27.492716],
    [43.391520, -30.071497, 29.865073],
    [34.713580, -34.752903, 31.825880],
  ],
};

// ===== Shared Colormap (for Test page) =====
export function getSharedColormap() {
  const pts = state.optimizedSlots || state.slots;
  const colors = [];
  for (let i = 0; i < N_SLOTS; i++) {
    if (pts[i]) colors.push({ ...pts[i] });
  }
  return colors.length >= 2 ? colors : null;
}

// ===== Uploaded colormap (image / PPM / CSV) =====
// Fill every slot with the N_SLOTS colors extracted from the uploaded file (all slots are
// specified colors, like a preset), ready for "Optimize".
function loadPoints(points) {
  state.optimizedSlots = null;
  state.selectedSlot = -1;
  state.prefIndices.clear();
  for (let i = 0; i < N_SLOTS; i++) {
    state.slots[i] = { L: points[i].L, a: points[i].a, b: points[i].b };
    state.prefIndices.add(i);
  }
  hidePicker();
  renderAll();
}

function loadPreset(name) {
  state.optimizedSlots = null;
  state.selectedSlot = -1;
  state.prefIndices.clear();
  if (name === 'custom') {
    for (let i = 0; i < N_SLOTS; i++) state.slots[i] = null;
    // sRGB red (255,0,0) and blue (0,0,255) in CIE L*a*b*
    state.slots[0]           = { L: 53.23, a: 80.11, b:  67.22 };
    state.slots[N_SLOTS - 1] = { L: 32.30, a: 79.19, b: -107.86 };
    state.prefIndices.add(0);
    state.prefIndices.add(N_SLOTS - 1);
  } else {
    const data = PRESETS[name];
    if (!data) return;
    for (let i = 0; i < N_SLOTS; i++) {
      state.slots[i] = { L: data[i][0], a: data[i][1], b: data[i][2] };
      state.prefIndices.add(i);
    }
  }
  hidePicker();
  renderAll();
}

function initDefaults() {
  loadPreset('turbo');
}

// ===== Get active points (for optimizer) =====
function getActivePoints() {
  const pts = state.optimizedSlots || state.slots;
  const indices = [];
  const colors = [];
  for (let i = 0; i < N_SLOTS; i++) {
    if (pts[i]) {
      indices.push(i);
      colors.push({ ...pts[i] });
    }
  }
  return { indices, colors };
}

// ===== Render Color Strip =====
function renderColorStrip() {
  const strip = $('#colorStrip');
  strip.innerHTML = '';
  const pts = state.optimizedSlots || state.slots;

  for (let i = 0; i < N_SLOTS; i++) {
    const slot = document.createElement('div');
    slot.className = 'color-slot';
    if (i === state.selectedSlot) slot.classList.add('selected');
    if (state.prefIndices.has(i) && pts[i]) slot.classList.add('preference');

    const swatch = document.createElement('div');
    swatch.className = 'color-slot-swatch';

    if (pts[i]) {
      swatch.style.backgroundColor = lab2cssRgb(pts[i].L, pts[i].a, pts[i].b);
    } else {
      swatch.classList.add('empty');
    }

    // Clear button for assigned slots
    if (pts[i]) {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'color-slot-clear visible';
      clearBtn.textContent = '✕';
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearSlot(i);
      });
      slot.appendChild(clearBtn);
    }

    const label = document.createElement('div');
    label.className = 'color-slot-label';
    label.textContent = i;

    slot.appendChild(swatch);
    slot.appendChild(label);

    // Click to select & open picker
    slot.addEventListener('click', () => selectSlot(i));
    // Right-click to toggle preference
    slot.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (pts[i]) togglePreference(i);
    });

    strip.appendChild(slot);
  }
}

function selectSlot(idx) {
  state.selectedSlot = idx;
  renderColorStrip();
  showPicker(idx);
}

function clearSlot(idx) {
  const pts = state.optimizedSlots || state.slots;
  pts[idx] = null;
  state.prefIndices.delete(idx);
  if (state.selectedSlot === idx) {
    state.selectedSlot = -1;
    hidePicker();
  }
  renderAll();
}

function togglePreference(idx) {
  if (state.prefIndices.has(idx)) {
    state.prefIndices.delete(idx);
  } else {
    state.prefIndices.add(idx);
  }
  renderColorStrip();
}

// ===== Picker =====
let gamutImageData = null;

function showPicker(idx) {
  const panel = $('#colorPickerPanel');
  panel.style.display = 'block';
  $('#pickerBackdrop').classList.add('active');
  $('#pickerIndex').textContent = idx;

  const pts = state.optimizedSlots || state.slots;
  const p = pts[idx];
  if (p) {
    $('#pickerL').value = p.L.toFixed(2);
    $('#pickerA').value = p.a.toFixed(2);
    $('#pickerB').value = p.b.toFixed(2);
    const rgb = cielab2nlrgb(p.L, p.a, p.b);
    $('#pickerR').value = Math.round(rgb[0]);
    $('#pickerG').value = Math.round(rgb[1]);
    $('#pickerBl').value = Math.round(rgb[2]);
    $('#lightnessSlider').value = p.L;
    $('#gamutLLabel').textContent = p.L.toFixed(0);
  } else {
    $('#pickerL').value = '50';
    $('#pickerA').value = '0';
    $('#pickerB').value = '0';
    $('#pickerR').value = '119';
    $('#pickerG').value = '119';
    $('#pickerBl').value = '119';
    $('#lightnessSlider').value = 50;
    $('#gamutLLabel').textContent = '50';
  }

  drawGamutCanvas();
  drawLightnessBar();
}

function hidePicker() {
  $('#colorPickerPanel').style.display = 'none';
  $('#pickerBackdrop').classList.remove('active');
  state.selectedSlot = -1;
  renderColorStrip();
}

// ===== Gamut Canvas (a*-b* plane at current L*) =====
function drawGamutCanvas() {
  const canvas = $('#gamutCanvas');
  const L = parseFloat($('#lightnessSlider').value) || 50;
  const size = 260;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  // Map pixel (x, y) → (a*, b*) where a* = -128..128, b* = 128..-128
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const a = -GAMUT_RANGE + (2 * GAMUT_RANGE * px) / (size - 1);
      const b = GAMUT_RANGE - (2 * GAMUT_RANGE * py) / (size - 1);
      const idx = (py * size + px) * 4;

      if (judgeInout(L, a, b) === 0) {
        const rgb = cielab2nlrgb(L, a, b);
        data[idx]     = Math.round(rgb[0]);
        data[idx + 1] = Math.round(rgb[1]);
        data[idx + 2] = Math.round(rgb[2]);
        data[idx + 3] = 255;
      } else {
        // Out of gamut — dark
        data[idx]     = 20;
        data[idx + 1] = 20;
        data[idx + 2] = 30;
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  gamutImageData = imgData;

  // Draw axis lines
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();

  // Draw axis labels
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '10px Inter, sans-serif';
  ctx.fillText('+a*', size - 22, size / 2 - 4);
  ctx.fillText('−a*', 3, size / 2 - 4);
  ctx.fillText('+b*', size / 2 + 4, 12);
  ctx.fillText('−b*', size / 2 + 4, size - 4);

  // Draw current selection crosshair
  drawSelectionCrosshair();
}

function drawSelectionCrosshair() {
  const canvas = $('#gamutCanvas');
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const pts = state.optimizedSlots || state.slots;
  const idx = state.selectedSlot;
  if (idx < 0) return;
  const p = pts[idx];
  if (!p) return;

  const L = parseFloat($('#lightnessSlider').value) || 50;
  const px = ((p.a + GAMUT_RANGE) / (2 * GAMUT_RANGE)) * (size - 1);
  const py = ((GAMUT_RANGE - p.b) / (2 * GAMUT_RANGE)) * (size - 1);

  // Crosshair
  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(px, py, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawLightnessBar() {
  const canvas = $('#lightnessBar');
  const h = 260;
  canvas.width = 24;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Get current a*, b* to show lightness gradient at that chromaticity
  const a = parseFloat($('#pickerA').value) || 0;
  const b = parseFloat($('#pickerB').value) || 0;

  for (let py = 0; py < h; py++) {
    const L = 100 - (100 * py / (h - 1));
    if (judgeInout(L, a, b) === 0) {
      const rgb = cielab2nlrgb(L, a, b);
      ctx.fillStyle = `rgb(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])})`;
    } else {
      // Show neutral gray for out-of-gamut lightness
      const gray = Math.round(L * 2.55);
      ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
    }
    ctx.fillRect(0, py, 24, 1);
  }
}

// ===== Gamut canvas click handler =====
function onGamutCanvasClick(e) {
  const canvas = $('#gamutCanvas');
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const size = canvas.width;
  const scaleX = size / rect.width;
  const scaleY = size / rect.height;
  const px = x * scaleX;
  const py = y * scaleY;

  const a = -GAMUT_RANGE + (2 * GAMUT_RANGE * px) / (size - 1);
  const b = GAMUT_RANGE - (2 * GAMUT_RANGE * py) / (size - 1);
  const L = parseFloat($('#lightnessSlider').value) || 50;

  if (judgeInout(L, a, b) === 0) {
    updatePickerFromLab(L, a, b);
  }
}

function updatePickerFromLab(L, a, b) {
  $('#pickerL').value = L.toFixed(2);
  $('#pickerA').value = a.toFixed(2);
  $('#pickerB').value = b.toFixed(2);
  const rgb = cielab2nlrgb(L, a, b);
  $('#pickerR').value = Math.round(rgb[0]);
  $('#pickerG').value = Math.round(rgb[1]);
  $('#pickerBl').value = Math.round(rgb[2]);

  applyCurrentPicker();
  drawGamutCanvas();
  drawLightnessBar();
}

function applyCurrentPicker() {
  const idx = state.selectedSlot;
  if (idx < 0) return;
  const pts = state.optimizedSlots || state.slots;
  const L = parseFloat($('#pickerL').value) || 0;
  const a = parseFloat($('#pickerA').value) || 0;
  const b = parseFloat($('#pickerB').value) || 0;

  pts[idx] = { L, a, b };
  if (!state.prefIndices.has(idx)) {
    state.prefIndices.add(idx);
  }
  renderAll();
}

function applyCurrentPickerAndClose() {
  applyCurrentPicker();
  hidePicker();
}

function applyPickerRGB() {
  const idx = state.selectedSlot;
  if (idx < 0) return;
  const r = parseInt($('#pickerR').value) || 0;
  const g = parseInt($('#pickerG').value) || 0;
  const b = parseInt($('#pickerBl').value) || 0;
  const lab = nlrgb2cielab(r, g, b);
  updatePickerFromLab(lab[0], lab[1], lab[2]);
}

// ===== Colormap Preview =====
function renderColormapPreview() {
  const { indices, colors } = getActivePoints();
  if (colors.length < 2) {
    // Need at least 2 points for preview
    clearCanvas($('#colormapCanvas'));
    return;
  }

  const ls = colors.map(c => c.L);
  const as = colors.map(c => c.a);
  const bs = colors.map(c => c.b);
  const interp = interpolateColors(256, colors.length, ls, as, bs);

  drawColormapBar($('#colormapCanvas'), interp);

  // CVD previews
  const cvdP = $('#cvdP').checked;
  const cvdD = $('#cvdD').checked;
  const cvdT = $('#cvdT').checked;

  $('#cvdPreviewP').style.display = cvdP ? 'flex' : 'none';
  $('#cvdPreviewD').style.display = cvdD ? 'flex' : 'none';
  $('#cvdPreviewT').style.display = cvdT ? 'flex' : 'none';

  if (cvdP) {
    const sim = simulateCVD(interp, simPBrettel);
    drawColormapBar($('#cvdPreviewP canvas'), sim);
  }
  if (cvdD) {
    const sim = simulateCVD(interp, simDBrettel);
    drawColormapBar($('#cvdPreviewD canvas'), sim);
  }
  if (cvdT) {
    const sim = simulateCVD(interp, simTBrettel);
    drawColormapBar($('#cvdPreviewT canvas'), sim);
  }
}

function clearCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  // Box size (CSS width/height, e.g. via .colormap-bar) is owned by the
  // stylesheet, not by this function. Reading clientWidth/clientHeight and
  // writing them back to canvas.style would shrink the box by the border
  // width on every redraw (clientHeight excludes the border, but style.height
  // sets the border-box total) — so only the raster buffer is resized here.
  const w = canvas.clientWidth || 280;
  const h = canvas.clientHeight || parseInt(canvas.getAttribute('height')) || 40;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#1c1c30';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Assign at least 2 colors', w / 2, h / 2 + 4);
}

function drawColormapBar(canvas, interp) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  // Box size (CSS width/height, e.g. via .colormap-bar) is owned by the
  // stylesheet, not by this function. Reading clientWidth/clientHeight and
  // writing them back to canvas.style would shrink the box by the border
  // width on every redraw (clientHeight excludes the border, but style.height
  // sets the border-box total) — so only the raster buffer is resized here.
  const w = canvas.clientWidth || 280;
  const h = canvas.clientHeight || parseInt(canvas.getAttribute('height')) || 40;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.scale(dpr, dpr);

  for (let x = 0; x < w; x++) {
    const i = Math.min(Math.floor(x / w * 256), 255);
    const rgb = cielab2nlrgb(interp.ls[i], interp.as[i], interp.bs[i]);
    ctx.fillStyle = `rgb(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])})`;
    ctx.fillRect(x, 0, 1, h);
  }
}

function simulateCVD(interp, simFn) {
  const ls = new Float64Array(256);
  const as = new Float64Array(256);
  const bs = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    const lab = [interp.ls[i], interp.as[i], interp.bs[i]];
    simFn(lab);
    ls[i] = lab[0]; as[i] = lab[1]; bs[i] = lab[2];
  }
  return { ls, as, bs };
}

function getFullSlots() {
  const pts = state.optimizedSlots || state.slots;
  const assignedIndices = [];
  for (let i = 0; i < N_SLOTS; i++) {
    if (pts[i]) assignedIndices.push(i);
  }

  if (assignedIndices.length < 2) return null;

  const fullLs = new Float64Array(N_SLOTS);
  const fullAs = new Float64Array(N_SLOTS);
  const fullBs = new Float64Array(N_SLOTS);

  for (const idx of assignedIndices) {
    fullLs[idx] = pts[idx].L;
    fullAs[idx] = pts[idx].a;
    fullBs[idx] = pts[idx].b;
  }

  for (let k = 0; k < assignedIndices.length - 1; k++) {
    const i0 = assignedIndices[k];
    const i1 = assignedIndices[k + 1];
    const l0 = fullLs[i0], a0 = fullAs[i0], b0 = fullBs[i0];
    const l1 = fullLs[i1], a1 = fullAs[i1], b1 = fullBs[i1];
    for (let i = i0 + 1; i < i1; i++) {
      const t = (i - i0) / (i1 - i0);
      fullLs[i] = l0 + t * (l1 - l0);
      fullAs[i] = a0 + t * (a1 - a0);
      fullBs[i] = b0 + t * (b1 - b0);
      while (judgeInout(fullLs[i], fullAs[i], fullBs[i]) === 1) {
        fullAs[i] *= 0.999; fullBs[i] *= 0.999;
      }
    }
  }

  const first = assignedIndices[0];
  const second = assignedIndices[1];
  if (first > 0) {
    const l0 = fullLs[first], a0 = fullAs[first], b0 = fullBs[first];
    const l1 = fullLs[second], a1 = fullAs[second], b1 = fullBs[second];
    for (let i = 0; i < first; i++) {
      const t = (i - first) / (second - first);
      fullLs[i] = Math.max(0, Math.min(100, l0 + t * (l1 - l0)));
      fullAs[i] = a0 + t * (a1 - a0);
      fullBs[i] = b0 + t * (b1 - b0);
      while (judgeInout(fullLs[i], fullAs[i], fullBs[i]) === 1) {
        fullAs[i] *= 0.999; fullBs[i] *= 0.999;
      }
    }
  }

  const last = assignedIndices[assignedIndices.length - 1];
  const prevLast = assignedIndices[assignedIndices.length - 2];
  if (last < N_SLOTS - 1) {
    const lN = fullLs[last], aN = fullAs[last], bN = fullBs[last];
    const lP = fullLs[prevLast], aP = fullAs[prevLast], bP = fullBs[prevLast];
    for (let i = last + 1; i < N_SLOTS; i++) {
      const t = (i - last) / (last - prevLast);
      fullLs[i] = Math.max(0, Math.min(100, lN + t * (lN - lP)));
      fullAs[i] = aN + t * (aN - aP);
      fullBs[i] = bN + t * (bN - bP);
      while (judgeInout(fullLs[i], fullAs[i], fullBs[i]) === 1) {
        fullAs[i] *= 0.999; fullBs[i] *= 0.999;
      }
    }
  }

  return { fullLs, fullAs, fullBs, assignedIndices };
}

// ===== Evaluation of the generated colormap =====
// The score shown to the user (before and after generation) is computed on the generated
// 256-color colormap, sub-sampled every EVAL_K_GAP points (idx 0, 8, ..., 248) plus the last
// point (idx 255) -- not on the N_SLOTS representative colors that SA works on. The formula is
// the same eScore as the SA objective; only the evaluated points differ.
const EVAL_K_GAP = 8;

function evalScoreGap(fullLs, fullAs, fullBs, params, returnDetails = false) {
  const interp = interpolateColors(256, N_SLOTS, fullLs, fullAs, fullBs);
  const idx = [];
  for (let i = 0; i < 256; i += EVAL_K_GAP) idx.push(i);
  if (idx[idx.length - 1] !== 255) idx.push(255);
  const m = idx.length;
  const ls = new Float64Array(m);
  const as = new Float64Array(m);
  const bs = new Float64Array(m);
  for (let j = 0; j < m; j++) {
    ls[j] = interp.ls[idx[j]];
    as[j] = interp.as[idx[j]];
    bs[j] = interp.bs[idx[j]];
  }
  return eScore(ls, as, bs, m, new Float64Array(m - 1), params, returnDetails);
}

function renderStats() {
  if (state.isOptimizing) return;
  const full = getFullSlots();
  if (!full) {
    $('#scoreDisplay').style.display = 'none';
    $('#scoreDetails').style.display = 'none';
    return;
  }
  
  const params = {
    UP: $('#cvdP').checked ? 1 : 0,
    UD: $('#cvdD').checked ? 1 : 0,
    UT: $('#cvdT').checked ? 1 : 0,
    S1_WEIGHT: parseFloat($('#paramS1').value) || 1.0,
    u_WEIGHT: parseFloat($('#paramU').value) || 0.1,
    q_WEIGHT: parseFloat($('#paramQ').value) || 0.7,
  };

  const scoreData = evalScoreGap(full.fullLs, full.fullAs, full.fullBs, params, true);
  
  $('#scoreDisplay').style.display = 'flex';
  $('#scoreValue').textContent = scoreData.finalScore.toFixed(5);

  const d = scoreData;
  const detailsEl = $('#scoreDetails');
  detailsEl.style.display = 'grid';
  
  let html = '';
  html += `<div class="score-detail-item"><span class="score-detail-label">UN′ (Uniformity N):</span> <span class="score-detail-value">${(d.eu * 100).toFixed(1)}</span></div>`;
  if (params.UP) {
    html += `<div class="score-detail-item"><span class="score-detail-label">UP′ (Uniformity P):</span> <span class="score-detail-value">${(d.euP * 100).toFixed(1)}</span></div>`;
    html += `<div class="score-detail-item"><span class="score-detail-label">QP′ (Contrast P):</span> <span class="score-detail-value">${(d.ePPsi * 1000).toFixed(1)}</span></div>`;
  }
  if (params.UD) {
    html += `<div class="score-detail-item"><span class="score-detail-label">UD′ (Uniformity D):</span> <span class="score-detail-value">${(d.euD * 100).toFixed(1)}</span></div>`;
    html += `<div class="score-detail-item"><span class="score-detail-label">QD′ (Contrast D):</span> <span class="score-detail-value">${(d.eDPsi * 1000).toFixed(1)}</span></div>`;
  }
  if (params.UT) {
    html += `<div class="score-detail-item"><span class="score-detail-label">UT′ (Uniformity T):</span> <span class="score-detail-value">${(d.euT * 100).toFixed(1)}</span></div>`;
    html += `<div class="score-detail-item"><span class="score-detail-label">QT′ (Contrast T):</span> <span class="score-detail-value">${(d.eTPsi * 1000).toFixed(1)}</span></div>`;
  }
  html += `<div class="score-detail-item"><span class="score-detail-label">S′ (Smoothness):</span> <span class="score-detail-value">${(d.es * 1000).toFixed(1)}</span></div>`;
  
  detailsEl.innerHTML = html;
}

// ===== Render All =====
function renderAll() {
  renderColorStrip();
  renderColormapPreview();
  renderStats();
}

// ===== Lab Trajectory State =====
let labTrajectoryHistory = []; // Array of { ls, as, bs } snapshots
let labInitialPoints = null;   // { ls, as, bs } at start
let labPointColors = [];       // RGB colors for each control point

// ===== Draw Lab Trajectory: a*-b* Plane =====
function drawLabTrajectoryAB() {
  const canvas = $('#labTrajAB');
  if (!canvas || !labInitialPoints) return;

  const size = 240;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0f0f17';
  ctx.fillRect(0, 0, size, size);

  // a*-b* range: typically -128 to 128, but we zoom to ±100 for better visibility
  const range = 100;
  const toX = (a) => (a + range) / (2 * range) * size;
  const toY = (b) => (range - b) / (2 * range) * size;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.5;
  for (let v = -range; v <= range; v += 25) {
    ctx.beginPath();
    ctx.moveTo(toX(v), 0); ctx.lineTo(toX(v), size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, toY(v)); ctx.lineTo(size, toY(v));
    ctx.stroke();
  }

  // Axis lines
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), size);
  ctx.moveTo(0, toY(0)); ctx.lineTo(size, toY(0));
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '9px Inter, sans-serif';
  ctx.fillText('+a*', size - 22, toY(0) - 4);
  ctx.fillText('−a*', 3, toY(0) - 4);
  ctx.fillText('+b*', toX(0) + 4, 11);
  ctx.fillText('−b*', toX(0) + 4, size - 4);

  const n = labInitialPoints.ls.length;

  // Draw trajectory lines for each control point
  for (let i = 0; i < n; i++) {
    if (labTrajectoryHistory.length < 2) continue;
    const color = labPointColors[i] || [150, 150, 150];
    ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},0.3)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(toX(labTrajectoryHistory[0].as[i]), toY(labTrajectoryHistory[0].bs[i]));
    for (let h = 1; h < labTrajectoryHistory.length; h++) {
      ctx.lineTo(toX(labTrajectoryHistory[h].as[i]), toY(labTrajectoryHistory[h].bs[i]));
    }
    ctx.stroke();
  }

  // Draw initial positions (hollow circles)
  for (let i = 0; i < n; i++) {
    const color = labPointColors[i] || [150, 150, 150];
    const x = toX(labInitialPoints.as[i]);
    const y = toY(labInitialPoints.bs[i]);
    ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},0.6)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw current positions (filled circles)
  if (labTrajectoryHistory.length > 0) {
    const last = labTrajectoryHistory[labTrajectoryHistory.length - 1];
    for (let i = 0; i < n; i++) {
      const color = labPointColors[i] || [150, 150, 150];
      const x = toX(last.as[i]);
      const y = toY(last.bs[i]);
      ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw index label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(i.toString(), x, y - 7);
    }
    ctx.textAlign = 'start';
  }
}

// ===== Draw Lab Trajectory: L* Profile =====
function drawLabTrajectoryL() {
  const canvas = $('#labTrajL');
  if (!canvas || !labInitialPoints) return;

  const w = 240, h = 140;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0f0f17';
  ctx.fillRect(0, 0, w, h);

  const n = labInitialPoints.ls.length;
  if (n < 2) return;

  const pad = { left: 28, right: 8, top: 12, bottom: 20 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.5;
  for (let lv = 0; lv <= 100; lv += 25) {
    const y = pad.top + plotH * (1 - lv / 100);
    ctx.beginPath();
    ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    // Y-axis label
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '8px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(lv.toString(), pad.left - 4, y + 3);
  }
  ctx.textAlign = 'start';

  // X-axis label
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '8px Inter, sans-serif';
  ctx.fillText('Index', w / 2 - 10, h - 2);

  // Y-axis label
  ctx.save();
  ctx.translate(8, pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('L*', 0, 0);
  ctx.restore();

  const toX = (idx) => pad.left + idx / (n - 1) * plotW;
  const toY = (L) => pad.top + plotH * (1 - Math.max(0, Math.min(100, L)) / 100);

  // Draw initial L* profile (dashed line)
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = toX(i), y = toY(labInitialPoints.ls[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw initial points (hollow)
  for (let i = 0; i < n; i++) {
    const color = labPointColors[i] || [150, 150, 150];
    ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},0.5)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(toX(i), toY(labInitialPoints.ls[i]), 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw current L* profile (solid line)
  if (labTrajectoryHistory.length > 0) {
    const last = labTrajectoryHistory[labTrajectoryHistory.length - 1];

    // Draw line connecting current points
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = toX(i), y = toY(last.ls[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw current points (filled)
    for (let i = 0; i < n; i++) {
      const color = labPointColors[i] || [150, 150, 150];
      ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(toX(i), toY(last.ls[i]), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Draw vertical movement lines (initial → current)
    for (let i = 0; i < n; i++) {
      const color = labPointColors[i] || [150, 150, 150];
      const x = toX(i);
      const y0 = toY(labInitialPoints.ls[i]);
      const y1 = toY(last.ls[i]);
      if (Math.abs(y0 - y1) > 1) {
        ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},0.25)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y0); ctx.lineTo(x, y1);
        ctx.stroke();
      }
    }
  }

  // Draw x-axis tick labels
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '7px Inter, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < n; i++) {
    ctx.fillText(i.toString(), toX(i), h - pad.bottom + 12);
  }
  ctx.textAlign = 'start';
}

// ===== Optimization =====
function startOptimization() {
  if (state.isOptimizing) return;
  
  const pts = state.optimizedSlots || state.slots;
  if (!pts[0] || !pts[N_SLOTS - 1]) {
    alert('両端のスロット（0番と14番）に色を設定してから最適化してください。\n\nPlease set colors for both endpoint slots (0 and 14) before optimizing.');
    return;
  }
  const full = getFullSlots();
  if (!full) {
    alert('Please assign at least 2 control points.');
    return;
  }
  const { fullLs, fullAs, fullBs, assignedIndices } = full;

  state.isOptimizing = true;
  const btn = $('#btnOptimize');
  btn.disabled = true;
  btn.textContent = 'Optimizing...';

  const progress = $('#progressContainer');
  progress.style.display = 'flex';
  $('#progressFill').style.width = '0%';
  $('#progressPercent').textContent = '0%';
  $('#progressScore').textContent = '';

  // Initialize Lab trajectory tracking
  labInitialPoints = {
    ls: Array.from(fullLs),
    as: Array.from(fullAs),
    bs: Array.from(fullBs),
  };
  labTrajectoryHistory = [{
    ls: Array.from(fullLs),
    as: Array.from(fullAs),
    bs: Array.from(fullBs),
  }];

  // Compute RGB colors for each control point
  labPointColors = [];
  for (let i = 0; i < N_SLOTS; i++) {
    const rgb = cielab2nlrgb(fullLs[i], fullAs[i], fullBs[i]);
    labPointColors.push([
      Math.round(Math.max(0, Math.min(255, rgb[0]))),
      Math.round(Math.max(0, Math.min(255, rgb[1]))),
      Math.round(Math.max(0, Math.min(255, rgb[2]))),
    ]);
  }

  const labPanel = $('#labTrajectoryPanel');
  if (labPanel) labPanel.style.display = '';
  drawLabTrajectoryAB();
  drawLabTrajectoryL();

  const params = {
    n: N_SLOTS,
    tInit: parseFloat($('#paramTInit').value),
    tEnd: parseFloat($('#paramTEnd').value),
    alpha: parseFloat($('#paramAlpha').value),
    iterCount: parseInt($('#paramIter').value),
    UP: $('#cvdP').checked ? 1 : 0,
    UD: $('#cvdD').checked ? 1 : 0,
    UT: $('#cvdT').checked ? 1 : 0,
    S1_WEIGHT: parseFloat($('#paramS1').value),
    u_WEIGHT: parseFloat($('#paramU').value),
    q_WEIGHT: parseFloat($('#paramQ').value),
    R: parseFloat($('#paramR').value),
    R_dash: parseFloat($('#paramRDash').value),
  };

  const worker = new Worker(
    new URL('./optimizer.worker.js', import.meta.url),
    { type: 'module' }
  );
  state.worker = worker;

  let lastTrajectoryUpdate = 0;
  const TRAJECTORY_UPDATE_INTERVAL = 100;
  // Pre-generation evaluation, on the same gap-subsampled basis as the post-generation one
  const initialEval = evalScoreGap(fullLs, fullAs, fullBs, params);

  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === 'progress') {
      const pct = Math.round(msg.progress * 100);
      $('#progressFill').style.width = pct + '%';
      $('#progressPercent').textContent = pct + '%';
      $('#progressScore').textContent = `e = ${msg.eScore.toFixed(6)}`;

      if (msg.currentPoints) {
        const now = performance.now();
        if (now - lastTrajectoryUpdate > TRAJECTORY_UPDATE_INTERVAL) {
          labTrajectoryHistory.push({
            ls: [...msg.currentPoints.ls],
            as: [...msg.currentPoints.as],
            bs: [...msg.currentPoints.bs],
          });
          for (let i = 0; i < msg.currentPoints.ls.length; i++) {
            const rgb = cielab2nlrgb(msg.currentPoints.ls[i], msg.currentPoints.as[i], msg.currentPoints.bs[i]);
            labPointColors[i] = [
              Math.round(Math.max(0, Math.min(255, rgb[0]))),
              Math.round(Math.max(0, Math.min(255, rgb[1]))),
              Math.round(Math.max(0, Math.min(255, rgb[2]))),
            ];
          }
          drawLabTrajectoryAB();
          drawLabTrajectoryL();
          lastTrajectoryUpdate = now;
        }
      }
    } else if (msg.type === 'done') {
      state.isOptimizing = false;
      btn.disabled = false;
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> Optimize`;

      if (msg.controlPoints) {
        labTrajectoryHistory.push({
          ls: [...msg.controlPoints.ls],
          as: [...msg.controlPoints.as],
          bs: [...msg.controlPoints.bs],
        });
        for (let i = 0; i < msg.controlPoints.ls.length; i++) {
          const rgb = cielab2nlrgb(msg.controlPoints.ls[i], msg.controlPoints.as[i], msg.controlPoints.bs[i]);
          labPointColors[i] = [
            Math.round(Math.max(0, Math.min(255, rgb[0]))),
            Math.round(Math.max(0, Math.min(255, rgb[1]))),
            Math.round(Math.max(0, Math.min(255, rgb[2]))),
          ];
        }
        drawLabTrajectoryAB();
        drawLabTrajectoryL();
      }

      // Final results cover all 15 slots
      state.optimizedSlots = new Array(N_SLOTS).fill(null);
      for (let i = 0; i < N_SLOTS; i++) {
        state.optimizedSlots[i] = {
          L: msg.controlPoints.ls[i],
          a: msg.controlPoints.as[i],
          b: msg.controlPoints.bs[i],
        };
      }

      // Evaluate the generated colormap (gap-subsampled), not the SA objective on the representative colors
      const finalEval = evalScoreGap(msg.controlPoints.ls, msg.controlPoints.as, msg.controlPoints.bs, params, true);

      $('#scoreDisplay').style.display = 'flex';
      $('#scoreValue').textContent = `${initialEval.toFixed(5)} → ${finalEval.finalScore.toFixed(5)}`;

      // Render score details
      if (msg.controlPoints) {
        const d = finalEval;
        const detailsEl = $('#scoreDetails');
        detailsEl.style.display = 'grid';
        
        let html = '';
        html += `<div class="score-detail-item"><span class="score-detail-label">UN′ (Uniformity N):</span> <span class="score-detail-value">${(d.eu * 100).toFixed(1)}</span></div>`;
        if (params.UP) {
          html += `<div class="score-detail-item"><span class="score-detail-label">UP′ (Uniformity P):</span> <span class="score-detail-value">${(d.euP * 100).toFixed(1)}</span></div>`;
          html += `<div class="score-detail-item"><span class="score-detail-label">QP′ (Contrast P):</span> <span class="score-detail-value">${(d.ePPsi * 1000).toFixed(1)}</span></div>`;
        }
        if (params.UD) {
          html += `<div class="score-detail-item"><span class="score-detail-label">UD′ (Uniformity D):</span> <span class="score-detail-value">${(d.euD * 100).toFixed(1)}</span></div>`;
          html += `<div class="score-detail-item"><span class="score-detail-label">QD′ (Contrast D):</span> <span class="score-detail-value">${(d.eDPsi * 1000).toFixed(1)}</span></div>`;
        }
        if (params.UT) {
          html += `<div class="score-detail-item"><span class="score-detail-label">UT′ (Uniformity T):</span> <span class="score-detail-value">${(d.euT * 100).toFixed(1)}</span></div>`;
          html += `<div class="score-detail-item"><span class="score-detail-label">QT′ (Contrast T):</span> <span class="score-detail-value">${(d.eTPsi * 1000).toFixed(1)}</span></div>`;
        }
        html += `<div class="score-detail-item"><span class="score-detail-label">S′ (Smoothness):</span> <span class="score-detail-value">${(d.es * 1000).toFixed(1)}</span></div>`;
        
        detailsEl.innerHTML = html;
      }

      renderAll();
      if (state.selectedSlot >= 0) showPicker(state.selectedSlot);
      worker.terminate();
      state.worker = null;
    }
  };

  worker.postMessage({
    initialLs: Array.from(fullLs),
    initialAs: Array.from(fullAs),
    initialBs: Array.from(fullBs),
    prefIndices: assignedIndices,
    params,
  });
}

// ===== Export =====
function getExportData() {
  const { colors } = getActivePoints();
  if (colors.length < 2) return null;
  const ls = colors.map(c => c.L);
  const as = colors.map(c => c.a);
  const bs = colors.map(c => c.b);
  const interp = interpolateColors(256, colors.length, ls, as, bs);
  return { colors, interp };
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v / 255));
}

function toHex(r, g, b) {
  const rr = Math.max(0, Math.min(255, Math.round(r)));
  const gg = Math.max(0, Math.min(255, Math.round(g)));
  const bb = Math.max(0, Math.min(255, Math.round(b)));
  return '#' + rr.toString(16).padStart(2, '0')
            + gg.toString(16).padStart(2, '0')
            + bb.toString(16).padStart(2, '0');
}

function exportJSON() {
  const d = getExportData();
  if (!d) return;
  const format = $('#jsonFormatSelect')?.value || 'rgb01';
  const data = [];

  for (let i = 0; i < 256; i++) {
    const rgb = cielab2nlrgb(d.interp.ls[i], d.interp.as[i], d.interp.bs[i]);
    if (format === 'hex') {
      data.push({
        index: i,
        hex: toHex(rgb[0], rgb[1], rgb[2]),
      });
    } else {
      // rgb01: [0, 1]
      data.push({
        index: i,
        R: +clamp01(rgb[0]).toFixed(6),
        G: +clamp01(rgb[1]).toFixed(6),
        B: +clamp01(rgb[2]).toFixed(6),
      });
    }
  }
  downloadFile('colormap.json', JSON.stringify(data, null, 2), 'application/json');
}

function exportCSS() {
  const d = getExportData();
  if (!d) return;
  const stops = [];
  for (let i = 0; i < 256; i += 16) {
    const rgb = cielab2nlrgb(d.interp.ls[i], d.interp.as[i], d.interp.bs[i]);
    stops.push(`rgb(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])}) ${((i / 255) * 100).toFixed(1)}%`);
  }
  const last = cielab2nlrgb(d.interp.ls[255], d.interp.as[255], d.interp.bs[255]);
  stops.push(`rgb(${Math.round(last[0])},${Math.round(last[1])},${Math.round(last[2])}) 100%`);
  downloadFile('colormap.css', `background: linear-gradient(90deg, ${stops.join(', ')});`, 'text/css');
}

function exportPNG() {
  const d = getExportData();
  if (!d) return;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 50;
  const ctx = c.getContext('2d');
  for (let x = 0; x < 256; x++) {
    const rgb = cielab2nlrgb(d.interp.ls[x], d.interp.as[x], d.interp.bs[x]);
    ctx.fillStyle = `rgb(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])})`;
    ctx.fillRect(x, 0, 1, 50);
  }
  const dataUrl = c.toDataURL('image/png');
  triggerDownload('colormap.png', dataUrl);
}

function exportCSV() {
  const d = getExportData();
  if (!d) return;
  const format = $('#csvFormatSelect')?.value || 'rgb01';

  let csv = '';
  if (format === 'lab') {
    csv = 'index,L*,a*,b*\n';
    for (let i = 0; i < 256; i++) {
      csv += `${i},${d.interp.ls[i].toFixed(6)},${d.interp.as[i].toFixed(6)},${d.interp.bs[i].toFixed(6)}\n`;
    }
  } else if (format === 'hex') {
    csv = 'index,hex\n';
    for (let i = 0; i < 256; i++) {
      const rgb = cielab2nlrgb(d.interp.ls[i], d.interp.as[i], d.interp.bs[i]);
      csv += `${i},${toHex(rgb[0], rgb[1], rgb[2])}\n`;
    }
  } else {
    // rgb01
    csv = 'index,R,G,B\n';
    for (let i = 0; i < 256; i++) {
      const rgb = cielab2nlrgb(d.interp.ls[i], d.interp.as[i], d.interp.bs[i]);
      csv += `${i},${clamp01(rgb[0]).toFixed(6)},${clamp01(rgb[1]).toFixed(6)},${clamp01(rgb[2]).toFixed(6)}\n`;
    }
  }
  downloadFile('colormap.csv', csv, 'text/csv');
}

function downloadFile(name, content, type) {
  // Convert text content to base64 data URL for reliable download
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const dataUrl = `data:${type};base64,${base64}`;
  triggerDownload(name, dataUrl);
}

function triggerDownload(name, dataUrl) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ===== Page Routing =====
function navigateToPage(pageName) {
  state.currentPage = pageName;
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  // Show target page
  const target = document.getElementById(`page-${pageName}`);
  if (target) target.style.display = '';

  // Update nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.page === pageName);
  });

  // Update hash
  window.location.hash = pageName;

  // Trigger page-specific rendering
  if (pageName === 'test') {
    renderTestPage();
  } else if (pageName === 'tutorial') {
    renderTutorialPage();
  }
}

function initRouting() {
  // Tab click handlers
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      navigateToPage(tab.dataset.page);
    });
  });

  // Hash change handler
  window.addEventListener('hashchange', () => {
    const page = window.location.hash.replace('#', '') || 'generator';
    if (['generator', 'test', 'tutorial'].includes(page)) {
      navigateToPage(page);
    }
  });

  // Initial route
  const initialPage = window.location.hash.replace('#', '') || 'generator';
  if (['generator', 'test', 'tutorial'].includes(initialPage)) {
    navigateToPage(initialPage);
  }
}

// ===== Events =====
function initEvents() {
  // Preset selector. The "Upload" entry opens a file dialog instead of loading a preset.
  const presetSelect = $('#presetSelect');
  const colormapFile = $('#colormapFile');
  const uploadNote = $('#uploadNote');
  let lastPreset = presetSelect.value;
  let uploaded = null; // { points, note, name } from the last successful upload
  const setNote = (text) => { uploadNote.textContent = text; uploadNote.hidden = !text; };
  const revertPreset = () => { presetSelect.value = lastPreset; };

  presetSelect.addEventListener('change', (e) => {
    const v = e.target.value;
    if (v === 'upload') {
      colormapFile.value = '';
      colormapFile.click();
      return;
    }
    lastPreset = v;
    if (v === 'uploaded') {
      loadPoints(uploaded.points);
      setNote(uploaded.note);
    } else {
      setNote('');
      loadPreset(v);
    }
  });

  colormapFile.addEventListener('cancel', revertPreset);
  colormapFile.addEventListener('change', async () => {
    const file = colormapFile.files[0];
    if (!file) { revertPreset(); return; }
    try {
      const { points, note } = await loadColormapFile(file, N_SLOTS);
      uploaded = { points, note, name: file.name };
      const opt = presetSelect.querySelector('option[value="uploaded"]');
      opt.textContent = `Uploaded: ${file.name}`;
      opt.hidden = false;
      presetSelect.value = 'uploaded';
      lastPreset = 'uploaded';
      loadPoints(points);
      setNote(note);
    } catch (err) {
      alert(err.message);
      revertPreset();
    }
  });

  // CVD toggles
  ['#cvdP', '#cvdD', '#cvdT'].forEach(sel =>
    $(sel).addEventListener('change', renderAll)
  );

  // Advanced params
  ['#paramS1', '#paramU', '#paramQ'].forEach(sel =>
    $(sel).addEventListener('input', renderStats)
  );

  // Picker close
  $('#pickerClose').addEventListener('click', hidePicker);
  $('#pickerBackdrop').addEventListener('click', hidePicker);

  // Apply button
  $('#btnApplyColor').addEventListener('click', applyCurrentPickerAndClose);

  // Lab inputs → apply on change/enter
  ['#pickerL', '#pickerA', '#pickerB'].forEach(sel => {
    $(sel).addEventListener('change', () => {
      applyCurrentPicker();
      drawGamutCanvas();
      drawLightnessBar();
    });
    $(sel).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        applyCurrentPicker();
        drawGamutCanvas();
        drawLightnessBar();
      }
    });
  });

  // RGB inputs
  ['#pickerR', '#pickerG', '#pickerBl'].forEach(sel => {
    $(sel).addEventListener('change', applyPickerRGB);
    $(sel).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyPickerRGB();
    });
  });

  // Gamut canvas click
  $('#gamutCanvas').addEventListener('click', onGamutCanvasClick);

  // Gamut canvas drag
  let isDragging = false;
  $('#gamutCanvas').addEventListener('mousedown', (e) => {
    isDragging = true;
    onGamutCanvasClick(e);
  });
  document.addEventListener('mousemove', (e) => {
    if (isDragging) onGamutCanvasClick(e);
  });
  document.addEventListener('mouseup', () => { isDragging = false; });

  // Lightness slider
  $('#lightnessSlider').addEventListener('input', (e) => {
    const L = parseFloat(e.target.value);
    $('#gamutLLabel').textContent = L.toFixed(0);
    $('#pickerL').value = L.toFixed(2);
    drawGamutCanvas();
    // If we have a selected color, update its L but keep a*, b*
    if (state.selectedSlot >= 0) {
      const pts = state.optimizedSlots || state.slots;
      const p = pts[state.selectedSlot];
      if (p) {
        p.L = L;
        const rgb = cielab2nlrgb(p.L, p.a, p.b);
        $('#pickerR').value = Math.round(rgb[0]);
        $('#pickerG').value = Math.round(rgb[1]);
        $('#pickerBl').value = Math.round(rgb[2]);
        renderAll();
      }
    }
  });

  // Lightness bar click
  $('#lightnessBar').addEventListener('click', (e) => {
    const rect = e.target.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    const L = 100 - (100 * y / h);
    $('#lightnessSlider').value = Math.max(0, Math.min(100, L));
    $('#lightnessSlider').dispatchEvent(new Event('input'));
  });

  // Optimize
  $('#btnOptimize').addEventListener('click', startOptimization);

  // Export
  $('#btnExportJSON').addEventListener('click', exportJSON);
  $('#btnExportPNG').addEventListener('click', exportPNG);
  $('#btnExportCSV').addEventListener('click', exportCSV);
}

// ===== Init =====
function init() {
  initDefaults();
  initEvents();
  initTestPage(getSharedColormap, PRESETS);
  initTutorialPage();
  initRouting();
  renderAll();
}

init();
