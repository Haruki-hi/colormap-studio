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

// ===== Constants =====
const N_SLOTS = 16;
const GAMUT_RANGE = 128; // a*, b* range: [-128, 128]

// ===== State =====
const state = {
  // 16 slots: each is null (empty) or { L, a, b }
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
    [11.953036, 23.194790, -19.997262],
    [33.827512, 29.841248, -54.147603],
    [50.588957, 25.090278, -65.229466],
    [63.157590, 5.606340, -56.887318],
    [73.318176, -29.087611, -25.610082],
    [81.492731, -55.846026, 9.836004],
    [86.925102, -68.522003, 42.991899],
    [90.393188, -62.676964, 70.497547],
    [90.087969, -44.122605, 79.023453],
    [85.949566, -16.305732, 75.488213],
    [79.486801, 11.793547, 70.011554],
    [69.512039, 36.243261, 67.241810],
    [58.021414, 54.786353, 64.092052],
    [48.040978, 60.661745, 58.662489],
    [37.436540, 56.823130, 50.628927],
    [24.490451, 45.744637, 35.512119],
  ],
  plasma: [
    [15.426020, 46.668968, -64.798370],
    [20.243983, 53.670552, -67.104692],
    [24.797271, 58.896057, -66.069434],
    [29.212204, 63.144251, -62.164650],
    [33.591049, 65.409171, -54.178609],
    [38.065018, 65.053932, -41.499065],
    [42.740470, 62.481617, -25.310220],
    [47.641772, 58.592053, -7.884034],
    [52.741012, 53.914575, 9.205032],
    [58.017554, 48.445255, 25.459472],
    [63.477909, 41.819701, 40.761147],
    [69.146527, 33.496714, 54.794450],
    [75.050969, 22.948065, 66.938291],
    [81.214660, 9.780092, 76.447834],
    [87.655736, -6.199627, 82.707067],
    [94.368188, -24.436331, 88.359165],
  ],
  viridis: [
    [14.948710, 40.569264, -32.257416],
    [20.731502, 37.680484, -38.564884],
    [26.325054, 30.068663, -40.575698],
    [31.714758, 18.734690, -38.314546],
    [36.898552, 6.128408, -33.028750],
    [41.924005, -5.674563, -26.292089],
    [46.863674, -16.129667, -18.986089],
    [51.780150, -25.710540, -11.106990],
    [56.708482, -34.859497, -2.071091],
    [61.653847, -43.239607, 8.821537],
    [66.601130, -49.581835, 21.994469],
    [71.526142, -52.066196, 37.359405],
    [76.404120, -49.023702, 54.089216],
    [81.221879, -39.787514, 70.147521],
    [86.012146, -25.676938, 81.830810],
    [90.897354, -10.239563, 85.410403],
  ],
  afmhot: [
    [0.000000, 0.000000, 0.000000],
    [3.069165, 13.769084, 4.850542],
    [10.769194, 30.973072, 16.973504],
    [19.328041, 40.876015, 29.660167],
    [27.895969, 48.750230, 40.867714],
    [38.265647, 50.125803, 50.888882],
    [49.587456, 48.076018, 59.979093],
    [61.165563, 44.838642, 69.293878],
    [70.454423, 34.681682, 73.756974],
    [78.192243, 17.745446, 70.933698],
    [86.629289, 1.614103, 66.271583],
    [95.500138, -13.136278, 61.386995],
    [98.065482, -14.233184, 48.665767],
    [98.578216, -10.329473, 32.607646],
    [99.221633, -5.568590, 16.279896],
    [100.000000, 0.000000, 0.000000],
  ],
  jet: [
    [12.893677, 47.372108, -64.516026],
    [24.942138, 67.125947, -91.418759],
    [32.710617, 77.923715, -107.170846],
    [41.935045, 50.951731, -91.829437],
    [59.267818, 8.651174, -63.581378],
    [78.785608, -28.576859, -32.858987],
    [90.060036, -59.604558, 9.927579],
    [89.967471, -63.768904, 37.727607],
    [91.200228, -56.848321, 64.652343],
    [93.776179, -40.673334, 85.464567],
    [90.665979, -9.347890, 89.799520],
    [75.353664, 22.966018, 79.236148],
    [62.624187, 54.170834, 71.511488],
    [54.907932, 75.288169, 67.838559],
    [42.683032, 67.898711, 56.979235],
    [25.413776, 47.917463, 37.914351],
  ],
  RdYlGn: [
    [34.271271, 58.620118, 29.318535],
    [43.105425, 62.371887, 40.410694],
    [52.224911, 59.375298, 46.061550],
    [62.147741, 49.325430, 47.931977],
    [71.944818, 30.978430, 49.115864],
    [81.406527, 13.904129, 48.498688],
    [89.973537, -0.595614, 45.276303],
    [95.723637, -6.989103, 35.471614],
    [96.056271, -14.045132, 35.743359],
    [90.938832, -22.378811, 45.872967],
    [84.402406, -30.537425, 47.872325],
    [77.239915, -38.221086, 45.020186],
    [69.555501, -44.496999, 37.380875],
    [59.943048, -48.925498, 31.395303],
    [49.730720, -45.717233, 26.056720],
    [38.157295, -38.417799, 20.439327],
  ],
  Spectral: [
    [33.316251, 58.196392, 9.599110],
    [43.790237, 60.465137, 19.502032],
    [53.654207, 56.447359, 32.922045],
    [62.147741, 49.325430, 47.931977],
    [71.944818, 30.978430, 49.115864],
    [81.406527, 13.904129, 48.498688],
    [89.973537, -0.595614, 45.276303],
    [95.723637, -6.989103, 35.471614],
    [96.958945, -12.887848, 34.835472],
    [93.621708, -18.938798, 43.127100],
    [86.805171, -24.546839, 29.669980],
    [79.656634, -30.012115, 17.221634],
    [72.311945, -34.414458, 6.162335],
    [59.974559, -18.382512, -21.169217],
    [48.423848, 2.674961, -38.554658],
    [38.864372, 27.153468, -43.039596],
  ],
  RdGn: [
    [34.843566, 55.931724, 40.226724],
    [42.799821, 48.845406, 36.646709],
    [50.813953, 41.652273, 33.556790],
    [58.774125, 33.966017, 30.367058],
    [66.714203, 26.518287, 27.127274],
    [74.716553, 19.120225, 23.906955],
    [82.700130, 11.800771, 21.095715],
    [90.916539, 4.365828, 17.948387],
    [90.930029, -2.043503, 17.822532],
    [82.924499, -6.597864, 19.909195],
    [74.820180, -11.170948, 21.649789],
    [66.949703, -16.048913, 24.059363],
    [58.699194, -20.398517, 25.776022],
    [50.973446, -25.667174, 27.980362],
    [42.896673, -30.189198, 30.008154],
    [34.713539, -34.752855, 31.825810],
  ],
  Leaf_NASA: [
    [74.047742, 0, 0],
    [66, -4.25, 63.01],
    [82.986948, -64.344253, 59.949565],
    [70.816003, -60.774305, 52.092969],
    [52.631784, -51.154028, 41.36226],
    [36.760037, -41.320116, 32.501574],
    [27.713414, -34.681317, 27.86048],
    [21.817336, -30.428804, 25.701649],
    [19.3885, -28.771664, 24.631918],
    [17.400288, -26.729282, 23.108755],
    [16.182599, -25.621951, 22.429637],
    [14.588756, -23.646092, 20.821427],
    [13.758382, -22.706789, 18.507754],
    [13.797674, -22.081382, 16.11058],
    [13.899845, -20.717435, 11.790171],
    [0, 0, 0],
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

function loadPreset(name) {
  const data = PRESETS[name];
  if (!data) return;
  state.optimizedSlots = null;
  state.selectedSlot = -1;
  state.prefIndices.clear();
  for (let i = 0; i < N_SLOTS; i++) {
    state.slots[i] = { L: data[i][0], a: data[i][1], b: data[i][2] };
    state.prefIndices.add(i);
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
  const w = canvas.clientWidth || 280;
  const h = canvas.clientHeight || parseInt(canvas.getAttribute('height')) || 40;
  canvas.width = w * window.devicePixelRatio;
  canvas.height = h * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  ctx.fillStyle = '#1c1c30';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Assign at least 2 colors', w / 2, h / 2 + 4);
}

function drawColormapBar(canvas, interp) {
  const ctx = canvas.getContext('2d');
  const w = canvas.clientWidth || 280;
  const h = canvas.clientHeight || parseInt(canvas.getAttribute('height')) || 40;
  canvas.width = w * window.devicePixelRatio;
  canvas.height = h * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

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

  const dInitial = new Float64Array(15);
  const scoreData = eScore(full.fullLs, full.fullAs, full.fullBs, 16, dInitial, params, true);
  
  $('#scoreDisplay').style.display = 'flex';
  $('#scoreValue').textContent = scoreData.finalScore.toFixed(5);

  const d = scoreData;
  const detailsEl = $('#scoreDetails');
  detailsEl.style.display = 'grid';
  
  let html = '';
  html += `<div class="score-detail-item"><span class="score-detail-label">UN (Uniformity N):</span> <span class="score-detail-value">${d.eu.toFixed(4)}</span></div>`;
  if (params.UP) {
    html += `<div class="score-detail-item"><span class="score-detail-label">UP (Uniformity P):</span> <span class="score-detail-value">${d.euP.toFixed(4)}</span></div>`;
    html += `<div class="score-detail-item"><span class="score-detail-label">QP (Quality P):</span> <span class="score-detail-value">${d.ePPsi.toFixed(4)}</span></div>`;
  }
  if (params.UD) {
    html += `<div class="score-detail-item"><span class="score-detail-label">UD (Uniformity D):</span> <span class="score-detail-value">${d.euD.toFixed(4)}</span></div>`;
    html += `<div class="score-detail-item"><span class="score-detail-label">QD (Quality D):</span> <span class="score-detail-value">${d.eDPsi.toFixed(4)}</span></div>`;
  }
  if (params.UT) {
    html += `<div class="score-detail-item"><span class="score-detail-label">UT (Uniformity T):</span> <span class="score-detail-value">${d.euT.toFixed(4)}</span></div>`;
    html += `<div class="score-detail-item"><span class="score-detail-label">QT (Quality T):</span> <span class="score-detail-value">${d.eTPsi.toFixed(4)}</span></div>`;
  }
  html += `<div class="score-detail-item"><span class="score-detail-label">S (Smoothness):</span> <span class="score-detail-value">${d.es.toFixed(4)}</span></div>`;
  
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
    './src/optimizer.worker.js',
    { type: 'module' }
  );
  state.worker = worker;

  let lastTrajectoryUpdate = 0;
  const TRAJECTORY_UPDATE_INTERVAL = 100;
  let initialScore = null;

  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === 'progress') {
      if (initialScore === null) initialScore = msg.eScore;
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

      // Final results cover all 16 slots
      state.optimizedSlots = new Array(N_SLOTS).fill(null);
      for (let i = 0; i < N_SLOTS; i++) {
        state.optimizedSlots[i] = {
          L: msg.controlPoints.ls[i],
          a: msg.controlPoints.as[i],
          b: msg.controlPoints.bs[i],
        };
      }

      $('#scoreDisplay').style.display = 'flex';
      if (initialScore !== null) {
        $('#scoreValue').textContent = `${initialScore.toFixed(5)} → ${msg.eScore.toFixed(5)}`;
      } else {
        $('#scoreValue').textContent = msg.eScore.toFixed(5);
      }

      // Render score details
      if (msg.controlPoints && msg.controlPoints.details) {
        const d = msg.controlPoints.details;
        const detailsEl = $('#scoreDetails');
        detailsEl.style.display = 'grid';
        
        let html = '';
        html += `<div class="score-detail-item"><span class="score-detail-label">UN (Uniformity N):</span> <span class="score-detail-value">${d.eu.toFixed(4)}</span></div>`;
        if (params.UP) {
          html += `<div class="score-detail-item"><span class="score-detail-label">UP (Uniformity P):</span> <span class="score-detail-value">${d.euP.toFixed(4)}</span></div>`;
          html += `<div class="score-detail-item"><span class="score-detail-label">QP (Quality P):</span> <span class="score-detail-value">${d.ePPsi.toFixed(4)}</span></div>`;
        }
        if (params.UD) {
          html += `<div class="score-detail-item"><span class="score-detail-label">UD (Uniformity D):</span> <span class="score-detail-value">${d.euD.toFixed(4)}</span></div>`;
          html += `<div class="score-detail-item"><span class="score-detail-label">QD (Quality D):</span> <span class="score-detail-value">${d.eDPsi.toFixed(4)}</span></div>`;
        }
        if (params.UT) {
          html += `<div class="score-detail-item"><span class="score-detail-label">UT (Uniformity T):</span> <span class="score-detail-value">${d.euT.toFixed(4)}</span></div>`;
          html += `<div class="score-detail-item"><span class="score-detail-label">QT (Quality T):</span> <span class="score-detail-value">${d.eTPsi.toFixed(4)}</span></div>`;
        }
        html += `<div class="score-detail-item"><span class="score-detail-label">S (Smoothness):</span> <span class="score-detail-value">${d.es.toFixed(4)}</span></div>`;
        
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
  // Preset selector
  $('#presetSelect').addEventListener('change', (e) => {
    const val = e.target.value;
    if (val !== 'custom') {
      loadPreset(val);
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
  $('#btnApplyColor').addEventListener('click', applyCurrentPicker);

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
  $('#btnExportCSS').addEventListener('click', exportCSS);
  $('#btnExportPNG').addEventListener('click', exportPNG);
  $('#btnExportCSV').addEventListener('click', exportCSV);
}

// ===== Init =====
function init() {
  initDefaults();
  initEvents();
  initTestPage();
  initTutorialPage();
  initRouting();
  renderAll();
}

init();
