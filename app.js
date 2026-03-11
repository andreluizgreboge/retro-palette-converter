/* ============================================================
   RETRO PALETTE CONVERTER — app.js
   Vanilla JavaScript, Canvas API only. No frameworks.
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────
   PALETTE DEFINITIONS
   All colors defined as [r, g, b] arrays.
   ────────────────────────────────────────────── */
const BUILT_IN_PALETTES = {
  'classic-handheld': {
    name: 'Classic Handheld',
    colors: [
      [15, 56, 15],
      [48, 98, 48],
      [139, 172, 15],
      [155, 188, 15],
    ]
  },
  'retro-handheld-green': {
    name: 'Retro Handheld Green',
    colors: [
      [8, 24, 32],
      [52, 104, 86],
      [136, 192, 112],
      [224, 248, 208],
    ]
  },
  '8bit-console': {
    name: '8-bit Console (16)',
    colors: [
      [0,   0,   0  ], [252, 252, 252], [248, 16,  24 ], [0,  120, 248],
      [0,  200,  0  ], [248, 144, 0  ], [120, 0,  248 ], [168, 0,   32],
      [0,  232, 216], [0,  56,  232 ], [88,  248, 152], [248, 120, 88],
      [104,136,252 ], [248, 56, 0   ], [152,120,  0  ], [128,128, 128],
    ]
  },
  'early-pc': {
    name: 'Early PC Graphics (16)',
    colors: [
      [0,   0,   0  ], [0,   0,  170], [0,  170,   0 ], [0,  170, 170],
      [170, 0,   0  ], [170, 0,  170], [170,  85,   0], [170,170, 170],
      [85,  85,  85 ], [85,  85, 255], [85, 255,  85 ], [85, 255, 255],
      [255, 85,  85 ], [255, 85, 255], [255,255,  85 ], [255,255, 255],
    ]
  },
  'limited-indie': {
    name: 'Limited Indie Palette',
    colors: [
      [26,  28,  44 ], [93,  39,  93 ], [177, 62,  83 ], [239,125,  87],
      [255,205,117 ], [167,240,112 ], [56, 183, 100], [37, 113, 121],
    ]
  },
  'pico-style': {
    name: 'Micro Fantasy (16)',
    colors: [
      [0,   0,   0  ], [29,  43,  83 ], [126, 37,  83 ], [0,  135,  81],
      [171, 82,  54 ], [95,  87, 79  ], [194,195, 199], [255,241, 232],
      [255, 0,  77  ], [255,163,   0 ], [255,236,  39], [0,  228,  54],
      [41,  173,255 ], [131,118, 156], [255,119, 168], [255,204, 170],
    ]
  }
};

/* ──────────────────────────────────────────────
   APPLICATION STATE
   ────────────────────────────────────────────── */
const state = {
  originalImage: null,       // ImageData of the uploaded image
  convertedImageData: null,  // ImageData of the converted image
  currentPaletteKey: 'classic-handheld',
  currentPalette: BUILT_IN_PALETTES['classic-handheld'],
  customPalette: null,
  ditherEnabled: false,
  sliderPercent: 50,         // 0–100
  isDraggingSlider: false,
  hasImage: false,
  pendingAction: null,       // callback for after modal confirm
};

/* ──────────────────────────────────────────────
   DOM REFERENCES
   ────────────────────────────────────────────── */
const dom = {
  fileInput:        document.getElementById('file-input'),
  paletteFileInput: document.getElementById('palette-file-input'),
  btnUpload:        document.getElementById('btn-upload'),
  btnImport:        document.getElementById('btn-import'),
  btnExportJson:    document.getElementById('btn-export-json'),
  btnExportGpl:     document.getElementById('btn-export-gpl'),
  btnReset:         document.getElementById('btn-reset'),
  btnDownload:      document.getElementById('btn-download'),
  paletteSelect:    document.getElementById('palette-select'),
  ditherToggle:     document.getElementById('dither-toggle'),
  previewArea:      document.getElementById('preview-area'),
  previewEmpty:     document.getElementById('preview-empty'),
  compareContainer: document.getElementById('compare-container'),
  canvasOriginal:   document.getElementById('canvas-original'),
  canvasConverted:  document.getElementById('canvas-converted'),
  canvasWork:       document.getElementById('canvas-work'),
  sliderDivider:    document.getElementById('slider-divider'),
  sliderHandle:     document.getElementById('slider-handle'),
  sliderOverlay:    document.getElementById('slider-overlay'),
  processingOverlay:document.getElementById('processing-overlay'),
  previewInfo:      document.getElementById('preview-info'),
  imgDimensions:    document.getElementById('img-dimensions'),
  imgFormat:        document.getElementById('img-format'),
  sliderPct:        document.getElementById('slider-pct'),
  convertStatus:    document.getElementById('convert-status'),
  paletteGrid:      document.getElementById('palette-grid'),
  paletteList:      document.getElementById('palette-list'),
  paletteNameDisplay:document.getElementById('palette-name-display'),
  paletteCount:     document.getElementById('palette-count'),
  footerHint:       document.getElementById('footer-hint'),
  modalBackdrop:    document.getElementById('modal-backdrop'),
  modalBody:        document.getElementById('modal-body'),
  modalCancel:      document.getElementById('modal-cancel'),
  modalConfirm:     document.getElementById('modal-confirm'),
};

/* ──────────────────────────────────────────────
   UTILITY: Color distance (Euclidean RGB)
   ────────────────────────────────────────────── */
function colorDist(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

/* ──────────────────────────────────────────────
   UTILITY: Find nearest palette color
   ────────────────────────────────────────────── */
function nearestColor(r, g, b, palette) {
  let best = null, bestDist = Infinity;
  for (const c of palette.colors) {
    const d = colorDist(r, g, b, c[0], c[1], c[2]);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

/* ──────────────────────────────────────────────
   PALETTE CONVERSION — No dithering
   ────────────────────────────────────────────── */
function convertNoDither(srcData, palette) {
  const data = new Uint8ClampedArray(srcData.data);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const c = nearestColor(r, g, b, palette);
    data[i] = c[0]; data[i+1] = c[1]; data[i+2] = c[2];
    // alpha unchanged
  }
  return new ImageData(data, srcData.width, srcData.height);
}

/* ──────────────────────────────────────────────
   PALETTE CONVERSION — Floyd–Steinberg dithering
   ────────────────────────────────────────────── */
function convertDither(srcData, palette) {
  const w = srcData.width, h = srcData.height;
  // Work with floating-point channels
  const r = new Float32Array(w * h);
  const g = new Float32Array(w * h);
  const b = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    r[i] = srcData.data[i * 4];
    g[i] = srcData.data[i * 4 + 1];
    b[i] = srcData.data[i * 4 + 2];
  }
  const out = new Uint8ClampedArray(srcData.data);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const or = r[idx], og = g[idx], ob = b[idx];
      const c = nearestColor(
        Math.min(255, Math.max(0, or)),
        Math.min(255, Math.max(0, og)),
        Math.min(255, Math.max(0, ob)),
        palette
      );
      out[idx * 4]     = c[0];
      out[idx * 4 + 1] = c[1];
      out[idx * 4 + 2] = c[2];

      // Error diffusion (Floyd–Steinberg coefficients)
      const er = or - c[0], eg = og - c[1], eb = ob - c[2];

      if (x + 1 < w) {
        r[idx + 1]     += er * 7/16;
        g[idx + 1]     += eg * 7/16;
        b[idx + 1]     += eb * 7/16;
      }
      if (y + 1 < h) {
        if (x - 1 >= 0) {
          r[idx + w - 1] += er * 3/16;
          g[idx + w - 1] += eg * 3/16;
          b[idx + w - 1] += eb * 3/16;
        }
        r[idx + w]     += er * 5/16;
        g[idx + w]     += eg * 5/16;
        b[idx + w]     += eb * 5/16;
        if (x + 1 < w) {
          r[idx + w + 1] += er * 1/16;
          g[idx + w + 1] += eg * 1/16;
          b[idx + w + 1] += eb * 1/16;
        }
      }
    }
  }
  return new ImageData(out, w, h);
}

/* ──────────────────────────────────────────────
   RENDER: Draw ImageData to a canvas element,
   fitting within the canvas display size.
   ────────────────────────────────────────────── */
function drawToCanvas(canvas, imageData) {
  canvas.width  = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d').putImageData(imageData, 0, 0);
}

/* ──────────────────────────────────────────────
   UPDATE SLIDER CLIP
   ────────────────────────────────────────────── */
function updateSliderVisual(pct) {
  const p = Math.min(100, Math.max(0, pct));
  state.sliderPercent = p;
  // Clip the converted canvas to show only the right portion
  dom.canvasConverted.style.clipPath = `inset(0 0 0 ${p}%)`;
  // Move divider
  dom.sliderDivider.style.left = p + '%';
  dom.sliderPct.textContent = `Slider: ${Math.round(p)}%`;
}

/* ──────────────────────────────────────────────
   PALETTE UI — Render grid + list
   ────────────────────────────────────────────── */
function renderPaletteUI(palette) {
  dom.paletteNameDisplay.textContent = palette.name;
  dom.paletteCount.textContent = palette.colors.length + ' colors';

  // Grid swatches
  dom.paletteGrid.innerHTML = '';
  palette.colors.forEach(c => {
    const hex = rgbToHex(c[0], c[1], c[2]);
    const el = document.createElement('div');
    el.className = 'palette-swatch';
    el.style.background = hex;
    el.title = hex;
    const tip = document.createElement('span');
    tip.className = 'swatch-tip';
    tip.textContent = hex;
    el.appendChild(tip);
    dom.paletteGrid.appendChild(el);
  });

  // Color list
  dom.paletteList.innerHTML = '';
  palette.colors.forEach((c, i) => {
    const hex = rgbToHex(c[0], c[1], c[2]);
    const row = document.createElement('div');
    row.className = 'palette-row';
    row.innerHTML = `
      <div class="palette-row-dot" style="background:${hex}"></div>
      <span class="palette-row-hex">${hex}</span>
      <span style="font-size:0.6rem;color:var(--text-secondary)">${i + 1}</span>
    `;
    dom.paletteList.appendChild(row);
  });
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2,'0')).join('').toUpperCase();
}

/* ──────────────────────────────────────────────
   STATUS BAR update
   ────────────────────────────────────────────── */
function setStatus(msg) {
  dom.convertStatus.textContent = msg;
}

/* ──────────────────────────────────────────────
   CONVERT IMAGE using current palette + dither
   ────────────────────────────────────────────── */
function convertImage() {
  if (!state.originalImage) return;
  setStatus('Converting…');
  dom.processingOverlay.hidden = false;

  // Use setTimeout so the UI can repaint before blocking work
  setTimeout(() => {
    const palette = state.customPalette || state.currentPalette;
    const converted = state.ditherEnabled
      ? convertDither(state.originalImage, palette)
      : convertNoDither(state.originalImage, palette);

    state.convertedImageData = converted;
    drawToCanvas(dom.canvasConverted, converted);
    updateSliderVisual(state.sliderPercent);
    dom.processingOverlay.hidden = true;
    dom.btnDownload.disabled = false;
    dom.footerHint.textContent = 'Processed image ready to download';
    setStatus(`Done · ${palette.colors.length} colors`);
  }, 30);
}

/* ──────────────────────────────────────────────
   LOAD IMAGE from File object
   ────────────────────────────────────────────── */
function loadImageFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    // Determine display size (cap at ~1800px to keep it snappy)
    const MAX = 1800;
    let w = img.naturalWidth, h = img.naturalHeight;
    if (w > MAX || h > MAX) {
      const scale = MAX / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    // Render to work canvas to extract ImageData
    const wc = dom.canvasWork;
    wc.width = w; wc.height = h;
    const ctx = wc.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    state.originalImage = ctx.getImageData(0, 0, w, h);

    URL.revokeObjectURL(url);

    // Draw original to original canvas
    drawToCanvas(dom.canvasOriginal, state.originalImage);

    // Show compare container
    dom.previewEmpty.hidden = true;
    dom.compareContainer.hidden = false;
    dom.previewInfo.hidden = false;

    // Update info bar
    dom.imgDimensions.textContent = `${w} × ${h}`;
    dom.imgFormat.textContent = file.type.replace('image/', '').toUpperCase();

    state.hasImage = true;
    setStatus('Image loaded');

    // Run conversion
    convertImage();
  };
  img.onerror = () => {
    alert('Could not load image. Please try a different file.');
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

/* ──────────────────────────────────────────────
   MODAL HELPERS
   ────────────────────────────────────────────── */
function showModal(message, onConfirm) {
  dom.modalBody.textContent = message;
  state.pendingAction = onConfirm;
  dom.modalBackdrop.hidden = false;
}

function hideModal() {
  dom.modalBackdrop.hidden = true;
  state.pendingAction = null;
}

/* ──────────────────────────────────────────────
   RESET workspace
   ────────────────────────────────────────────── */
function resetWorkspace() {
  state.originalImage = null;
  state.convertedImageData = null;
  state.customPalette = null;
  state.hasImage = false;
  state.sliderPercent = 50;

  // Clear canvases
  [dom.canvasOriginal, dom.canvasConverted, dom.canvasWork].forEach(c => {
    c.width = 1; c.height = 1;
  });

  // Reset UI
  dom.compareContainer.hidden = true;
  dom.previewEmpty.hidden = false;
  dom.previewInfo.hidden = true;
  dom.btnDownload.disabled = true;
  dom.footerHint.textContent = 'Load an image to enable download';
  dom.paletteSelect.value = 'classic-handheld';
  dom.ditherToggle.checked = false;
  state.ditherEnabled = false;
  state.currentPaletteKey = 'classic-handheld';
  state.currentPalette = BUILT_IN_PALETTES['classic-handheld'];

  // Reset custom option
  const customOpt = document.getElementById('custom-option');
  if (customOpt) { customOpt.disabled = true; customOpt.textContent = 'Custom Palette'; }

  renderPaletteUI(state.currentPalette);
  setStatus('No image loaded');
}

/* ──────────────────────────────────────────────
   PALETTE IMPORT — parse JSON or GPL
   ────────────────────────────────────────────── */
function parsePaletteFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    let colors = [];
    let palName = file.name.replace(/\.[^.]+$/, '');

    try {
      if (file.name.endsWith('.json')) {
        // JSON: expects { name?, colors: ["#RRGGBB",...] } or { name?, colors: [[r,g,b],...] }
        const obj = JSON.parse(text);
        palName = obj.name || palName;
        colors = (obj.colors || []).map(c => {
          if (Array.isArray(c)) return [c[0], c[1], c[2]];
          return hexToRgb(c);
        }).filter(Boolean);
      } else if (file.name.endsWith('.gpl')) {
        // GPL (GIMP Palette): lines of "R G B  Name"
        const lines = text.split('\n');
        for (const line of lines) {
          const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)/);
          if (m) colors.push([parseInt(m[1]), parseInt(m[2]), parseInt(m[3])]);
          if (line.startsWith('Name:')) palName = line.replace('Name:', '').trim();
        }
      }
    } catch (err) {
      alert('Could not parse palette file: ' + err.message);
      return;
    }

    if (colors.length === 0) {
      alert('No colors found in the palette file.');
      return;
    }

    // Apply custom palette
    state.customPalette = { name: palName, colors };
    const customOpt = document.getElementById('custom-option');
    if (customOpt) {
      customOpt.disabled = false;
      customOpt.textContent = `Custom: ${palName} (${colors.length})`;
    }
    dom.paletteSelect.value = 'custom';

    renderPaletteUI(state.customPalette);
    if (state.hasImage) convertImage();
  };
  reader.readAsText(file);
}

function hexToRgb(hex) {
  const m = hex.replace('#','').match(/.{2}/g);
  if (!m) return null;
  return m.map(x => parseInt(x, 16));
}

/* ──────────────────────────────────────────────
   PALETTE EXPORT
   ────────────────────────────────────────────── */
function exportPaletteJson() {
  const palette = state.customPalette || state.currentPalette;
  const obj = {
    name: palette.name,
    colors: palette.colors.map(c => rgbToHex(c[0], c[1], c[2]))
  };
  downloadText(JSON.stringify(obj, null, 2), `${palette.name}.json`, 'application/json');
}

function exportPaletteGpl() {
  const palette = state.customPalette || state.currentPalette;
  let gpl = `GIMP Palette\nName: ${palette.name}\nColumns: 8\n#\n`;
  palette.colors.forEach((c, i) => {
    gpl += `${c[0].toString().padStart(3)} ${c[1].toString().padStart(3)} ${c[2].toString().padStart(3)}\tColor ${i+1}\n`;
  });
  downloadText(gpl, `${palette.name}.gpl`, 'text/plain');
}

function downloadText(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

/* ──────────────────────────────────────────────
   DOWNLOAD processed image as PNG
   ────────────────────────────────────────────── */
function downloadProcessedImage() {
  if (!state.convertedImageData) return;
  const tmp = document.createElement('canvas');
  tmp.width  = state.convertedImageData.width;
  tmp.height = state.convertedImageData.height;
  tmp.getContext('2d').putImageData(state.convertedImageData, 0, 0);
  tmp.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'retro-palette-output.png');
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/* ──────────────────────────────────────────────
   SLIDER DRAG — mouse & touch
   ────────────────────────────────────────────── */
function getSliderPct(e, rect) {
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
}

dom.compareContainer.addEventListener('mousedown', e => {
  if (!state.hasImage) return;
  state.isDraggingSlider = true;
  const rect = dom.compareContainer.getBoundingClientRect();
  updateSliderVisual(getSliderPct(e, rect));
});
dom.compareContainer.addEventListener('touchstart', e => {
  if (!state.hasImage) return;
  state.isDraggingSlider = true;
  const rect = dom.compareContainer.getBoundingClientRect();
  updateSliderVisual(getSliderPct(e, rect));
}, { passive: true });

window.addEventListener('mousemove', e => {
  if (!state.isDraggingSlider) return;
  const rect = dom.compareContainer.getBoundingClientRect();
  updateSliderVisual(getSliderPct(e, rect));
});
window.addEventListener('touchmove', e => {
  if (!state.isDraggingSlider) return;
  const rect = dom.compareContainer.getBoundingClientRect();
  updateSliderVisual(getSliderPct(e, rect));
}, { passive: true });

window.addEventListener('mouseup', () => { state.isDraggingSlider = false; });
window.addEventListener('touchend', () => { state.isDraggingSlider = false; });

/* ──────────────────────────────────────────────
   DRAG AND DROP on preview area
   ────────────────────────────────────────────── */
dom.previewArea.addEventListener('dragover', e => {
  e.preventDefault();
  dom.previewArea.classList.add('drag-over');
});
dom.previewArea.addEventListener('dragleave', () => {
  dom.previewArea.classList.remove('drag-over');
});
dom.previewArea.addEventListener('drop', e => {
  e.preventDefault();
  dom.previewArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.match(/image\/(png|jpeg|webp)/)) {
    const doLoad = () => loadImageFile(file);
    if (state.hasImage) {
      showModal('Loading a new image will replace your current work. Continue?', doLoad);
    } else {
      doLoad();
    }
  }
});

/* ──────────────────────────────────────────────
   EVENT BINDINGS
   ────────────────────────────────────────────── */

// Upload button → file input
dom.btnUpload.addEventListener('click', () => {
  const doOpen = () => dom.fileInput.click();
  if (state.hasImage) {
    showModal('Loading a new image will replace your current work. Continue?', doOpen);
  } else {
    doOpen();
  }
});

dom.fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) loadImageFile(file);
  dom.fileInput.value = ''; // reset so same file can be re-uploaded
});

// Palette select
dom.paletteSelect.addEventListener('change', () => {
  const val = dom.paletteSelect.value;
  if (val === 'custom') {
    // Already loaded via import; just reconvert
    if (state.customPalette) {
      renderPaletteUI(state.customPalette);
      if (state.hasImage) convertImage();
    }
    return;
  }
  state.currentPaletteKey = val;
  state.currentPalette = BUILT_IN_PALETTES[val];
  state.customPalette = null; // clear custom when switching to built-in
  renderPaletteUI(state.currentPalette);
  if (state.hasImage) convertImage();
});

// Dither toggle
dom.ditherToggle.addEventListener('change', () => {
  state.ditherEnabled = dom.ditherToggle.checked;
  if (state.hasImage) convertImage();
});

// Import palette
dom.btnImport.addEventListener('click', () => {
  const doOpen = () => dom.paletteFileInput.click();
  if (state.hasImage) {
    showModal('Importing a new palette will re-convert your image. Continue?', doOpen);
  } else {
    doOpen();
  }
});
dom.paletteFileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) parsePaletteFile(file);
  dom.paletteFileInput.value = '';
});

// Export palette
dom.btnExportJson.addEventListener('click', exportPaletteJson);
dom.btnExportGpl.addEventListener('click',  exportPaletteGpl);

// Reset
dom.btnReset.addEventListener('click', () => {
  showModal('Reset the entire workspace? All progress will be lost.', resetWorkspace);
});

// Download
dom.btnDownload.addEventListener('click', downloadProcessedImage);

// Modal
dom.modalCancel.addEventListener('click', hideModal);
dom.modalBackdrop.addEventListener('click', e => {
  if (e.target === dom.modalBackdrop) hideModal();
});
dom.modalConfirm.addEventListener('click', () => {
  if (state.pendingAction) state.pendingAction();
  hideModal();
});

/* ──────────────────────────────────────────────
   INIT — render default palette on load
   ────────────────────────────────────────────── */
(function init() {
  renderPaletteUI(state.currentPalette);
  updateSliderVisual(50);
  setStatus('No image loaded');

  // Keyboard: Escape closes modal
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !dom.modalBackdrop.hidden) hideModal();
  });
})();

/* ──────────────────────────────────────────────
   PALETTE FORMAT HELP MODAL
   Entirely additive — no existing logic modified.
   ────────────────────────────────────────────── */
(function initHelpModal() {
  const btnHelp        = document.getElementById('btn-import-help');
  const helpBackdrop   = document.getElementById('help-modal-backdrop');
  const helpModalClose = document.getElementById('help-modal-close');

  if (!btnHelp || !helpBackdrop || !helpModalClose) return;

  function openHelp() { helpBackdrop.hidden = false; }
  function closeHelp() { helpBackdrop.hidden = true; }

  btnHelp.addEventListener('click', openHelp);
  helpModalClose.addEventListener('click', closeHelp);

  // Close on backdrop click
  helpBackdrop.addEventListener('click', e => {
    if (e.target === helpBackdrop) closeHelp();
  });

  // Close on Escape (in addition to existing modal handler)
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !helpBackdrop.hidden) closeHelp();
  });
})();
