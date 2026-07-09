/**
 * processImageLocal.js — Canvas-based image processing
 * All operations run locally in the browser. No server needed.
 */

// ── Main entry point ──────────────────────────────────────────────────────
export async function processImageLocal(file, operations, onProgress, opts = {}) {
  const { preview = false, maxPreviewWidth = 600 } = opts;
  const enabled = getEnabledOps(operations);
  if (Object.keys(enabled).length === 0) {
    throw new Error('No operations enabled');
  }

  onProgress && onProgress(5);

  // Load the image
  const img = await loadImage(file);
  onProgress && onProgress(10);

  // Determine output canvas size
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  let outputExt = getOutputExt(file.name, enabled);

  // Pre-calculate output size for scale/crop/pad operations
  let cropW = null, cropH = null, cropX = 0, cropY = 0;
  if (enabled.crop && enabled.crop.w && enabled.crop.h) {
    cropW = enabled.crop.w;
    cropH = enabled.crop.h;
    cropX = enabled.crop.x || 0;
    cropY = enabled.crop.y || 0;
  }

  if (enabled.scale) {
    const baseW = cropW || w;
    const baseH = cropH || h;
    const { width, height, keepAspect } = enabled.scale;
    if (keepAspect !== false) {
      const ratio = Math.min(
        (width > 0 ? width / baseW : Infinity),
        (height > 0 ? height / baseH : Infinity)
      );
      if (isFinite(ratio)) { w = Math.round(baseW * ratio); h = Math.round(baseH * ratio); }
    } else {
      if (width > 0) w = width;
      if (height > 0) h = height;
    }
  } else if (cropW && cropH) {
    // No scale, so canvas = crop dimensions
    w = cropW;
    h = cropH;
  }

  // Preview mode: downscale large images for faster pixel processing
  if (preview && Math.max(w, h) > maxPreviewWidth) {
    const ratio = maxPreviewWidth / Math.max(w, h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  // Handle rotation dimension swap before canvas creation
  if (enabled.rotate) {
    const angle = Number(enabled.rotate.angle) || 90;
    if (angle === 90 || angle === 270) {
      [w, h] = [h, w]; // swap for 90/270 degree rotation
    }
  }

  let canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d');

  // Apply operations in order
  canvas.width = w;
  canvas.height = h;

  // Step 1: Draw the original image (applying flip/rotate during draw)
  await applyDraw(ctx, img, enabled, w, h);
  onProgress && onProgress(30);

  // Step 2: Apply pixel-level filters
  if (hasPixelOps(enabled)) {
    await applyPixelFilters(ctx, canvas, enabled);
    onProgress && onProgress(60);
  }

  // Step 3: Apply overlays (text, vignette, border, tint)
  await applyOverlays(ctx, canvas, enabled, img);
  onProgress && onProgress(80);

  // Step 4: Output format conversion
  const mimeType = getMimeType(outputExt);
  const quality = enabled.imgQuality?.quality;

  // For formats that support quality parameter
  const blob = await new Promise(resolve => {
    if (quality && ['image/jpeg', 'image/webp', 'image/avif'].includes(mimeType)) {
      canvas.toBlob(resolve, mimeType, quality / 100);
    } else {
      canvas.toBlob(resolve, mimeType);
    }
  });

  onProgress && onProgress(100);

  return {
    blob,
    url: URL.createObjectURL(blob),
    name: `output.${outputExt}`,
  };
}

// ── Image loading ─────────────────────────────────────────────────────────
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

// ── Draw step: render image with transforms ───────────────────────────────
async function applyDraw(ctx, img, ops, w, h) {
  ctx.save();

  // Apply flip transforms
  if (ops.flip?.horizontal) {
    ctx.translate(ctx.canvas.width, 0);
    ctx.scale(-1, 1);
  }
  if (ops.flip?.vertical) {
    ctx.translate(0, ctx.canvas.height);
    ctx.scale(1, -1);
  }

  // Apply rotation
  if (ops.rotate) {
    const angle = Number(ops.rotate.angle) || 90;
    const rad = (angle * Math.PI) / 180;
    if (angle === 90) {
      ctx.translate(ctx.canvas.width, 0);
      ctx.rotate(rad);
    } else if (angle === 180) {
      ctx.translate(ctx.canvas.width, ctx.canvas.height);
      ctx.rotate(rad);
    } else if (angle === 270) {
      ctx.translate(0, ctx.canvas.height);
      ctx.rotate(rad);
    }
  }

  // Draw image (handles scale + crop)
  if (ops.crop && ops.crop.w && ops.crop.h) {
    ctx.drawImage(img, ops.crop.x || 0, ops.crop.y || 0, ops.crop.w, ops.crop.h, 0, 0, ctx.canvas.width, ctx.canvas.height);
  } else {
    ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  ctx.restore();

  // Apply CSS filters for color ops
  await applyCSSFilters(ctx, ops);
}

async function applyCSSFilters(ctx, ops) {
  const filters = [];

  if (ops.grayscale) filters.push('grayscale(1)');
  if (ops.sepia) filters.push('sepia(1)');
  if (ops.im_negate) filters.push('invert(1)');

  if (ops.hue) {
    filters.push(`hue-rotate(${ops.hue.degrees || 0}deg)`);
  }
  if (ops.blur) {
    const sigma = ops.blur.sigma || 3;
    filters.push(`blur(${Math.min(sigma * 0.7, 20)}px)`);
  }
  if (ops.colorCorrect) {
    const { brightness = 0, contrast = 1, saturation = 1 } = ops.colorCorrect;
    filters.push(`brightness(${1 + brightness})`);
    filters.push(`contrast(${contrast})`);
    filters.push(`saturate(${saturation})`);
  }

  if (filters.length > 0) {
    // CSS filter only works with drawImage, not putImageData.
    // Draw current canvas to an offscreen canvas, then draw back with filter.
    const off = document.createElement('canvas');
    off.width = ctx.canvas.width;
    off.height = ctx.canvas.height;
    const offCtx = off.getContext('2d');
    offCtx.drawImage(ctx.canvas, 0, 0);
    ctx.filter = filters.join(' ');
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(off, 0, 0);
    ctx.filter = 'none';
  }
}

// ── Pixel-level operations ────────────────────────────────────────────────
function hasPixelOps(ops) {
  return !!(
    ops.im_threshold || ops.im_posterize || ops.im_solarize ||
    ops.im_pixelate || ops.im_addnoise || ops.im_spread ||
    ops.sharpen || ops.denoise || ops.im_charcoal ||
    ops.im_emboss || ops.im_normalize || ops.im_equalize ||
    ops.im_autolevel || ops.im_autogamma || ops.im_despeckle ||
    ops.im_sketch || ops.im_oilpaint || ops.im_swirl ||
    ops.im_wave || ops.im_implode || ops.im_clahe ||
    ops.im_trim_auto
  );
}

async function applyPixelFilters(ctx, canvas, ops) {
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Pixelate (scale down then up — done pre-draw, but handle here too)
  if (ops.im_pixelate) {
    imageData = pixelate(imageData, ops.im_pixelate.size || 10);
  }

  // Threshold
  if (ops.im_threshold) {
    imageData = threshold(imageData, ops.im_threshold.value || 50);
  }

  // Posterize
  if (ops.im_posterize) {
    imageData = posterize(imageData, ops.im_posterize.levels || 4);
  }

  // Solarize
  if (ops.im_solarize) {
    imageData = solarize(imageData, ops.im_solarize.threshold || 50);
  }

  // Sharpen (unsharp mask via convolution)
  if (ops.sharpen) {
    imageData = convolve(imageData, [
      0, -1, 0,
      -1, 5 + (ops.sharpen.amount || 1.5) * 2, -1,
      0, -1, 0,
    ]);
  }

  // Denoise (simple box blur)
  if (ops.denoise) {
    imageData = boxBlur(imageData, Math.round(ops.denoise.strength || 1.5));
  }

  // Despeckle (median filter)
  if (ops.im_despeckle) {
    imageData = medianFilter(imageData, 1);
  }

  // Add noise
  if (ops.im_addnoise) {
    imageData = addNoise(imageData, ops.im_addnoise.type || 'Gaussian');
  }

  // Spread / Diffuse
  if (ops.im_spread) {
    imageData = spread(imageData, ops.im_spread.amount || 5);
  }

  // Emboss
  if (ops.im_emboss) {
    imageData = convolve(imageData, [
      -2, -1, 0,
      -1, 1, 1,
      0, 1, 2,
    ]);
    // Add 128 to bring to mid-gray. Reading each channel's own value before
    // the first write (R) avoids accidentally using the updated R for G and B.
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      d[i]     = clamp(r + 128);
      d[i + 1] = clamp(g + 128);
      d[i + 2] = clamp(b + 128);
    }
  }

  // Charcoal sketch (edge detect + invert + grayscale)
  if (ops.im_charcoal) {
    imageData = grayscale(imageData);
    imageData = convolve(imageData, [
      -1, -1, -1,
      -1, 8, -1,
      -1, -1, -1,
    ]);
    imageData = invert(imageData);
  }

  // Pencil sketch (grayscale + invert + blur + color dodge blend)
  if (ops.im_sketch) {
    imageData = pencilSketch(imageData, ops.im_sketch.sigma || 5);
  }

  // Swirl
  if (ops.im_swirl) {
    imageData = swirl(imageData, ops.im_swirl.degrees || 90);
  }

  // Wave
  if (ops.im_wave) {
    imageData = wave(imageData, ops.im_wave.amplitude || 10, ops.im_wave.wavelength || 100);
  }

  // Implode/Explode
  if (ops.im_implode) {
    imageData = implode(imageData, ops.im_implode.factor || 0.5);
  }

  // Normalize (stretch histogram)
  if (ops.im_normalize) {
    imageData = normalize(imageData);
  }

  // Equalize histogram
  if (ops.im_equalize) {
    imageData = equalize(imageData);
  }

  // Auto level
  if (ops.im_autolevel) {
    imageData = autoLevel(imageData);
  }

  // Auto gamma
  if (ops.im_autogamma) {
    imageData = autoGamma(imageData);
  }

  // CLAHE (simplified)
  if (ops.im_clahe) {
    imageData = simpleCLAHE(imageData, ops.im_clahe.size || 64, ops.im_clahe.limit || 3);
  }

  // Auto trim whitespace
  if (ops.im_trim_auto) {
    imageData = autoTrim(imageData, ops.im_trim_auto.fuzz || 10);
  }

  ctx.putImageData(imageData, 0, 0);
}

// ── Overlay operations (text, vignette, border, tint) ─────────────────────
async function applyOverlays(ctx, canvas, ops, img) {
  // Vignette
  if (ops.vignette) {
    applyVignette(ctx, canvas, ops.vignette.angle || 0.628);
  }

  // Draw text
  if (ops.drawText) {
    const { text = '', x = 10, y = 10, size = 48, color = 'white' } = ops.drawText;
    ctx.font = `${size}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(String(text), x, y + size);
  }

  // Tint
  if (ops.im_tint) {
    const { color = '#0000ff', amount = 50 } = ops.im_tint;
    ctx.fillStyle = color;
    ctx.globalAlpha = amount / 100;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }

  // Colorize
  if (ops.im_colorize) {
    const { color = '#ff0000', amount = 30 } = ops.im_colorize;
    // Grayscale first, then overlay color
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const gray = grayscale(imageData);
    ctx.putImageData(gray, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = color;
    ctx.globalAlpha = amount / 100;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Add border
  if (ops.im_border) {
    const { width: bw = 10, color = 'black' } = ops.im_border;
    const newCanvas = document.createElement('canvas');
    newCanvas.width = canvas.width + bw * 2;
    newCanvas.height = canvas.height + bw * 2;
    const newCtx = newCanvas.getContext('2d');
    newCtx.fillStyle = color;
    newCtx.fillRect(0, 0, newCanvas.width, newCanvas.height);
    newCtx.drawImage(canvas, bw, bw);
    canvas.width = newCanvas.width;
    canvas.height = newCanvas.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(newCanvas, 0, 0);
  }

  // Pad / extent
  if (ops.pad) {
    const { w: pw = 1920, h: ph = 1080, color: pcolor = 'black' } = ops.pad;
    const newCanvas = document.createElement('canvas');
    newCanvas.width = pw;
    newCanvas.height = ph;
    const newCtx = newCanvas.getContext('2d');
    newCtx.fillStyle = pcolor;
    newCtx.fillRect(0, 0, pw, ph);
    const dx = Math.round((pw - canvas.width) / 2);
    const dy = Math.round((ph - canvas.height) / 2);
    newCtx.drawImage(canvas, dx, dy);
    canvas.width = pw;
    canvas.height = ph;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(newCanvas, 0, 0);
  }

  // Letterbox
  if (ops.letterbox) {
    const { w: lw = 1920, h: lh = 1080, color: lcolor = 'black' } = ops.letterbox;
    const scale = Math.min(lw / canvas.width, lh / canvas.height);
    const sw = Math.round(canvas.width * scale);
    const sh = Math.round(canvas.height * scale);
    const newCanvas = document.createElement('canvas');
    newCanvas.width = lw;
    newCanvas.height = lh;
    const newCtx = newCanvas.getContext('2d');
    newCtx.fillStyle = lcolor;
    newCtx.fillRect(0, 0, lw, lh);
    newCtx.drawImage(canvas, Math.round((lw - sw) / 2), Math.round((lh - sh) / 2), sw, sh);
    canvas.width = lw;
    canvas.height = lh;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(newCanvas, 0, 0);
  }
}

// ── Helper: vignette effect ───────────────────────────────────────────────
function applyVignette(ctx, canvas, angle) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy);
  const innerR = maxR * (1 - angle / Math.PI);

  const gradient = ctx.createRadialGradient(cx, cy, innerR, cx, cy, maxR);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ── Pixel manipulation helpers ────────────────────────────────────────────

function getPixel(data, x, y, w) {
  const i = (y * w + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

function setPixel(data, x, y, w, r, g, b, a = 255) {
  const i = (y * w + x) * 4;
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = a;
}

function clamp(v, lo = 0, hi = 255) {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function cloneImageData(id) {
  return new ImageData(new Uint8ClampedArray(id.data), id.width, id.height);
}

// ── Filters ───────────────────────────────────────────────────────────────

function grayscale(id) {
  const out = cloneImageData(id);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  return out;
}

function invert(id) {
  const out = cloneImageData(id);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  }
  return out;
}

function threshold(id, value) {
  const out = cloneImageData(id);
  const d = out.data;
  const t = (value / 100) * 255;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const bw = v >= t ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = bw;
  }
  return out;
}

function posterize(id, levels) {
  const out = cloneImageData(id);
  const d = out.data;
  const step = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.round(d[i] / step) * step;
    d[i + 1] = Math.round(d[i + 1] / step) * step;
    d[i + 2] = Math.round(d[i + 2] / step) * step;
  }
  return out;
}

function solarize(id, threshold) {
  const out = cloneImageData(id);
  const d = out.data;
  const t = (threshold / 100) * 255;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > t) d[i] = 255 - d[i];
    if (d[i + 1] > t) d[i + 1] = 255 - d[i + 1];
    if (d[i + 2] > t) d[i + 2] = 255 - d[i + 2];
  }
  return out;
}

function pixelate(id, size) {
  const out = cloneImageData(id);
  const { width: w, height: h, data } = out;
  const s = Math.max(2, Math.round(size));
  for (let y = 0; y < h; y += s) {
    for (let x = 0; x < w; x += s) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let dy = 0; dy < s && y + dy < h; dy++) {
        for (let dx = 0; dx < s && x + dx < w; dx++) {
          const [pr, pg, pb] = getPixel(data, x + dx, y + dy, w);
          r += pr; g += pg; b += pb; count++;
        }
      }
      r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
      for (let dy = 0; dy < s && y + dy < h; dy++) {
        for (let dx = 0; dx < s && x + dx < w; dx++) {
          setPixel(data, x + dx, y + dy, w, r, g, b);
        }
      }
    }
  }
  return out;
}

function addNoise(id, type) {
  const out = cloneImageData(id);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    let noise;
    if (type === 'Gaussian') {
      // Box-Muller
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      noise = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * 30;
    } else if (type === 'Impulse') {
      noise = Math.random() < 0.05 ? (Math.random() < 0.5 ? -255 : 255) : 0;
    } else if (type === 'Poisson') {
      noise = (Math.random() - 0.5) * 50;
    } else {
      noise = (Math.random() - 0.5) * 40; // Laplacian approx
    }
    d[i] = clamp(d[i] + noise);
    d[i + 1] = clamp(d[i + 1] + noise);
    d[i + 2] = clamp(d[i + 2] + noise);
  }
  return out;
}

function spread(id, amount) {
  const out = cloneImageData(id);
  const { width: w, height: h, data } = out;
  const src = new Uint8ClampedArray(data);
  const a = Math.round(amount);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = clamp(x + Math.floor(Math.random() * a * 2 - a), 0, w - 1);
      const ny = clamp(y + Math.floor(Math.random() * a * 2 - a), 0, h - 1);
      const si = (ny * w + nx) * 4;
      const di = (y * w + x) * 4;
      data[di] = src[si];
      data[di + 1] = src[si + 1];
      data[di + 2] = src[si + 2];
    }
  }
  return out;
}

function convolve(id, kernel, kernelSize = 3) {
  const out = cloneImageData(id);
  const { width: w, height: h, data } = out;
  const src = new Uint8ClampedArray(data);
  const half = Math.floor(kernelSize / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const px = clamp(x + kx - half, 0, w - 1);
          const py = clamp(y + ky - half, 0, h - 1);
          const si = (py * w + px) * 4;
          const k = kernel[ky * kernelSize + kx];
          r += src[si] * k;
          g += src[si + 1] * k;
          b += src[si + 2] * k;
        }
      }
      const di = (y * w + x) * 4;
      data[di] = clamp(r);
      data[di + 1] = clamp(g);
      data[di + 2] = clamp(b);
    }
  }
  return out;
}

function boxBlur(id, radius) {
  const k = [];
  const size = radius * 2 + 1;
  const val = 1 / (size * size);
  for (let i = 0; i < size * size; i++) k.push(val);
  return convolve(id, k, size);
}

function medianFilter(id, radius) {
  const out = cloneImageData(id);
  const { width: w, height: h, data } = out;
  const src = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rs = [], gs = [], bs = [];
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const px = clamp(x + dx, 0, w - 1);
          const py = clamp(y + dy, 0, h - 1);
          const si = (py * w + px) * 4;
          rs.push(src[si]);
          gs.push(src[si + 1]);
          bs.push(src[si + 2]);
        }
      }
      rs.sort((a, b) => a - b);
      gs.sort((a, b) => a - b);
      bs.sort((a, b) => a - b);
      const mid = Math.floor(rs.length / 2);
      const di = (y * w + x) * 4;
      data[di] = rs[mid];
      data[di + 1] = gs[mid];
      data[di + 2] = bs[mid];
    }
  }
  return out;
}

// ── Complex effects ───────────────────────────────────────────────────────

function pencilSketch(id, sigma) {
  // Grayscale → invert → blur → color dodge blend with original
  let gray = grayscale(id);
  const inv = invert(gray);
  const blurred = boxBlur(inv, Math.round(sigma / 2));
  // Color dodge: out = src / (1 - blurred/255)
  const out = cloneImageData(id);
  const sd = gray.data;
  const bd = blurred.data;
  const od = out.data;
  for (let i = 0; i < sd.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const s = sd[i + c];
      const b = bd[i + c];
      od[i + c] = b === 255 ? 255 : clamp(Math.min(255, (s * 255) / (255 - b)));
    }
    od[i + 3] = 255;
  }
  return out;
}

function swirl(id, degrees) {
  const out = cloneImageData(id);
  const { width: w, height: h, data } = out;
  const src = new Uint8ClampedArray(data);
  const cx = w / 2, cy = h / 2;
  const maxR = Math.min(cx, cy);
  const factor = (degrees * Math.PI) / 180;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      const theta = Math.atan2(dy, dx) + factor * (1 - r / maxR);
      const sx = clamp(Math.round(cx + r * Math.cos(theta)), 0, w - 1);
      const sy = clamp(Math.round(cy + r * Math.sin(theta)), 0, h - 1);
      const si = (sy * w + sx) * 4;
      const di = (y * w + x) * 4;
      data[di] = src[si];
      data[di + 1] = src[si + 1];
      data[di + 2] = src[si + 2];
    }
  }
  return out;
}

function wave(id, amplitude, wavelength) {
  const out = cloneImageData(id);
  const { width: w, height: h, data } = out;
  const src = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = clamp(Math.round(x + amplitude * Math.sin((2 * Math.PI * y) / wavelength)), 0, w - 1);
      const sy = clamp(Math.round(y + amplitude * Math.cos((2 * Math.PI * x) / wavelength)), 0, h - 1);
      const si = (sy * w + sx) * 4;
      const di = (y * w + x) * 4;
      data[di] = src[si];
      data[di + 1] = src[si + 1];
      data[di + 2] = src[si + 2];
    }
  }
  return out;
}

function implode(id, factor) {
  const out = cloneImageData(id);
  const { width: w, height: h, data } = out;
  const src = new Uint8ClampedArray(data);
  const cx = w / 2, cy = h / 2;
  const maxR = Math.min(cx, cy);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy) / maxR;
      const theta = Math.atan2(dy, dx);
      const newR = factor >= 0
        ? Math.pow(r, 1 + factor) * maxR
        : Math.pow(r, 1 / (1 - factor)) * maxR;
      const sx = clamp(Math.round(cx + newR * Math.cos(theta)), 0, w - 1);
      const sy = clamp(Math.round(cy + newR * Math.sin(theta)), 0, h - 1);
      const si = (sy * w + sx) * 4;
      const di = (y * w + x) * 4;
      data[di] = src[si];
      data[di + 1] = src[si + 1];
      data[di + 2] = src[si + 2];
    }
  }
  return out;
}

// ── Histogram operations ──────────────────────────────────────────────────

function normalize(id) {
  const out = cloneImageData(id);
  const d = out.data;
  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max <= min) return out;
  const range = max - min;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp(((d[i] - min) / range) * 255);
    d[i + 1] = clamp(((d[i + 1] - min) / range) * 255);
    d[i + 2] = clamp(((d[i + 2] - min) / range) * 255);
  }
  return out;
}

function equalize(id) {
  const out = cloneImageData(id);
  const d = out.data;
  const hist = new Array(256).fill(0);
  const total = (d.length / 4) | 0;

  for (let i = 0; i < d.length; i += 4) {
    const v = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
    hist[clamp(v)]++;
  }

  const cdf = new Array(256);
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += hist[i];
    cdf[i] = Math.round((sum / total) * 255);
  }

  for (let i = 0; i < d.length; i += 4) {
    const v = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
    const ev = cdf[clamp(v)];
    // Scale RGB proportionally
    const scale = v > 0 ? ev / v : 1;
    d[i] = clamp(d[i] * scale);
    d[i + 1] = clamp(d[i + 1] * scale);
    d[i + 2] = clamp(d[i + 2] * scale);
  }
  return out;
}

function autoLevel(id) {
  // Same as normalize but per channel
  const out = cloneImageData(id);
  const d = out.data;
  for (let c = 0; c < 3; c++) {
    let min = 255, max = 0;
    for (let i = c; i < d.length; i += 4) {
      if (d[i] < min) min = d[i];
      if (d[i] > max) max = d[i];
    }
    if (max > min) {
      const range = max - min;
      for (let i = c; i < d.length; i += 4) {
        d[i] = clamp(((d[i] - min) / range) * 255);
      }
    }
  }
  return out;
}

function autoGamma(id) {
  const out = cloneImageData(id);
  const d = out.data;
  // Calculate average luminance
  let avg = 0;
  const count = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    avg += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  }
  avg /= count;
  // Target middle gray (128)
  const gamma = avg > 0 ? Math.log(128 / 255) / Math.log(avg / 255) : 1;
  if (gamma > 0.1 && gamma < 10) {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp(255 * Math.pow(d[i] / 255, gamma));
      d[i + 1] = clamp(255 * Math.pow(d[i + 1] / 255, gamma));
      d[i + 2] = clamp(255 * Math.pow(d[i + 2] / 255, gamma));
    }
  }
  return out;
}

function simpleCLAHE(id, tileSize, clipLimit) {
  // Tile-based contrast stretch with histogram clipping (simplified CLAHE).
  const { width: w, height: h, data } = id;
  const out = cloneImageData(id);
  const src = new Uint8ClampedArray(data);
  const ts = Math.max(16, Math.min(128, tileSize));
  const tilesX = Math.ceil(w / ts);
  const tilesY = Math.ceil(h / ts);
  const tilePixels = ts * ts;
  const clipMax = Math.max(1, Math.round(clipLimit * tilePixels / 256));

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = tx * ts, y0 = ty * ts;
      const x1 = Math.min(w, x0 + ts), y1 = Math.min(h, y0 + ts);

      // Build luminance histogram for the tile.
      const hist = new Uint32Array(256);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          const v = Math.round(src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114);
          hist[v]++;
        }
      }

      // Clip histogram excess and redistribute the clipped amount evenly.
      let clipped = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > clipMax) { clipped += hist[i] - clipMax; hist[i] = clipMax; }
      }
      const redistribute = clipped / 256 | 0;
      let leftover = clipped - redistribute * 256;
      for (let i = 0; i < 256; i++) hist[i] += redistribute;
      while (leftover-- > 0) hist[leftover % 256]++;

      // CDF → LUT.
      const lut = new Uint8Array(256);
      let sum = 0;
      for (let i = 0; i < 256; i++) { sum += hist[i]; lut[i] = Math.round((sum / tilePixels) * 255); }

      // Apply LUT, scaling each channel by its own value to preserve hue.
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          const v = Math.round(src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114);
          const ev = lut[v];
          const scale = v > 0 ? ev / v : 1;
          out.data[i]     = clamp(src[i]     * scale);
          out.data[i + 1] = clamp(src[i + 1] * scale);
          out.data[i + 2] = clamp(src[i + 2] * scale);
        }
      }
    }
  }
  return out;
}

function autoTrim(id, fuzz) {
  const { width: w, height: h, data } = id;
  const threshold = (fuzz / 100) * 255;

  let top = 0, bottom = h - 1, left = 0, right = w - 1;

  // Find top
  topLoop: for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (Math.abs(v - 255) > threshold) { top = y; break topLoop; }
    }
  }

  // Find bottom
  bottomLoop: for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (Math.abs(v - 255) > threshold) { bottom = y; break bottomLoop; }
    }
  }

  // Find left
  leftLoop: for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      const v = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (Math.abs(v - 255) > threshold) { left = x; break leftLoop; }
    }
  }

  // Find right
  rightLoop: for (let x = w - 1; x >= 0; x--) {
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      const v = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (Math.abs(v - 255) > threshold) { right = x; break rightLoop; }
    }
  }

  const newW = right - left + 1;
  const newH = bottom - top + 1;
  if (newW <= 0 || newH <= 0) return id;

  const out = new ImageData(newW, newH);
  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      const si = ((top + y) * w + (left + x)) * 4;
      const di = (y * newW + x) * 4;
      out.data[di] = data[si];
      out.data[di + 1] = data[si + 1];
      out.data[di + 2] = data[si + 2];
      out.data[di + 3] = data[si + 3];
    }
  }
  return out;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getEnabledOps(operations) {
  const out = {};
  for (const [id, op] of Object.entries(operations)) {
    if (op?.enabled) out[id] = op.params || {};
  }
  return out;
}

function getOutputExt(filename, ops) {
  if (ops.imgFormat?.format) return ops.imgFormat.format;
  const parts = (filename || '').split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'png';
  return ext;
}

function getMimeType(ext) {
  const m = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp',
    tiff: 'image/tiff', gif: 'image/gif',
  };
  return m[ext] || 'image/png';
}
