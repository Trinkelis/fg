// Builds ImageMagick `convert` args from active operations
export function buildMagickCommand(media, operations) {
  if (!media) return { args: [], command: '', outputExt: 'jpg' };

  const ena = getEnabled(operations);
  const args = ['__INPUT__'];
  let ext = getExt(media.name);

  // ── Geometry ────────────────────────────────────────────────
  if (ena.scale) {
    const { width = -1, height = -1, keepAspect = true } = ena.scale;
    args.push('-resize', keepAspect ? `${width}x${height}` : `${width}x${height}!`);
  }

  if (ena.crop) {
    const { w, h, x = 0, y = 0 } = ena.crop;
    if (w && h) { args.push('-crop', `${w}x${h}+${x}+${y}`); args.push('+repage'); }
  }

  if (ena.pad) {
    const { w = 1920, h = 1080, color = 'black' } = ena.pad;
    args.push('-background', color, '-gravity', 'Center', '-extent', `${w}x${h}`);
  }

  if (ena.rotate) args.push('-rotate', String(Number(ena.rotate.angle) || 90));
  if (ena.flip?.horizontal) args.push('-flop');
  if (ena.flip?.vertical)   args.push('-flip');

  // ── Color ───────────────────────────────────────────────────
  if (ena.colorCorrect) {
    const { brightness = 0, contrast = 1, saturation = 1, gamma = 1 } = ena.colorCorrect;
    const bPct = Math.round(brightness * 100);
    const cPct = Math.round((contrast - 1) * 50);
    if (bPct !== 0 || cPct !== 0) args.push('-brightness-contrast', `${bPct}x${cPct}`);
    const sMod = Math.round(saturation * 100);
    if (sMod !== 100) args.push('-modulate', `100,${sMod},100`);
    if (gamma !== 1)  args.push('-gamma', String(gamma));
  }

  if (ena.hue) {
    // IM modulate hue: 100 = no change, shift proportionally
    const h = Math.round(((ena.hue.degrees || 0) / 180) * 100 + 100);
    args.push('-modulate', `100,100,${Math.max(0, Math.min(200, h))}`);
  }

  if (ena.grayscale) args.push('-colorspace', 'Gray');
  if (ena.sepia)     args.push('-sepia-tone', '80%');

  // ── Filters ─────────────────────────────────────────────────
  if (ena.blur) {
    const { sigma = 3, type = 'gaussian' } = ena.blur;
    args.push(type === 'box' ? '-blur' : '-gaussian-blur', `0x${sigma}`);
  }

  if (ena.sharpen)  args.push('-unsharp', `0x${ena.sharpen.amount || 1.5}`);
  if (ena.denoise)  args.push('-enhance');
  if (ena.vignette) args.push('-vignette', `0x${Math.round((ena.vignette.angle || 0.628) * 10)}`);

  if (ena.drawText) {
    const { text = '', x = 10, y = 10, size = 48, color = 'white' } = ena.drawText;
    args.push('-fill', color, '-pointsize', String(size), '-annotate', `0x0+${x}+${y}`, String(text));
  }

  // ── ImageMagick-specific effects ─────────────────────────────
  if (ena.im_charcoal)  args.push('-charcoal',   String(ena.im_charcoal.factor || 2));
  if (ena.im_oilpaint)  args.push('-paint',       String(ena.im_oilpaint.radius || 3));
  if (ena.im_emboss)    args.push('-emboss',       String(ena.im_emboss.radius || 3));
  if (ena.im_sketch) {
    const { sigma = 5, angle = 45 } = ena.im_sketch;
    args.push('-sketch', `0x${sigma}+${angle}`);
  }
  if (ena.im_solarize)  args.push('-solarize',    `${ena.im_solarize.threshold || 50}%`);
  if (ena.im_swirl)     args.push('-swirl',        String(ena.im_swirl.degrees || 90));
  if (ena.im_wave) {
    const { amplitude = 10, wavelength = 100 } = ena.im_wave;
    args.push('-wave', `${amplitude}x${wavelength}`);
  }
  if (ena.im_implode)   args.push('-implode',      String(ena.im_implode.factor || 0.5));
  if (ena.im_spread)    args.push('-spread',        String(ena.im_spread.amount || 5));
  if (ena.im_negate)    args.push('-negate');
  if (ena.im_normalize) args.push('-normalize');
  if (ena.im_equalize)  args.push('-equalize');
  if (ena.im_autolevel) args.push('-auto-level');
  if (ena.im_autogamma) args.push('-auto-gamma');
  if (ena.im_threshold) args.push('-threshold',    `${ena.im_threshold.value || 50}%`);
  if (ena.im_posterize) args.push('-posterize',     String(ena.im_posterize.levels || 4));
  if (ena.im_despeckle) args.push('-despeckle');
  if (ena.im_addnoise)  args.push('+noise',         ena.im_addnoise.type || 'Gaussian');
  if (ena.im_border) {
    const { width = 10, color = 'black' } = ena.im_border;
    args.push('-bordercolor', color, '-border', `${width}x${width}`);
  }
  if (ena.im_tint) {
    args.push('-fill', ena.im_tint.color || 'blue', '-tint', String(ena.im_tint.amount || 50));
  }
  if (ena.im_colorize) {
    args.push('-fill', ena.im_colorize.color || 'red', '-colorize', String(ena.im_colorize.amount || 30));
  }
  if (ena.im_strip)     args.push('-strip');
  if (ena.im_deskew)    args.push('-deskew', '40%');
  if (ena.im_trim_auto) {
    args.push('-fuzz', `${ena.im_trim_auto.fuzz || 10}%`, '-trim', '+repage');
  }
  if (ena.im_pixelate) {
    const s = ena.im_pixelate.size || 10;
    // scale down then up for pixelation
    args.push('-scale', `${100 / s}%`, '-scale', `${s * 100}%`);
  }
  if (ena.im_clahe) {
    args.push('-clahe', `${ena.im_clahe.size || 64}x${ena.im_clahe.size || 64}%${ena.im_clahe.limit || 3}`);
  }

  // ── Format / Quality ────────────────────────────────────────
  if (ena.imgFormat)  ext = ena.imgFormat.format || ext;
  if (ena.imgQuality && ['jpg','jpeg','webp','avif'].includes(ext)) {
    args.push('-quality', String(ena.imgQuality.quality || 85));
  }

  args.push('__OUTPUT__');

  const inName  = media?.name  || 'input.jpg';
  const outName = `output.${ext}`;
  const display = args.map(a =>
    a === '__INPUT__'  ? inName  :
    a === '__OUTPUT__' ? outName : a
  );
  const command = 'convert ' + display.map(a => /[\s()]/.test(a) ? `"${a}"` : a).join(' ');
  return { args, command, outputExt: ext };
}

function getEnabled(ops) {
  const out = {};
  for (const [id, op] of Object.entries(ops)) {
    if (op?.enabled) out[id] = op.params || {};
  }
  return out;
}

function getExt(name = '') {
  const p = name.split('.');
  return p.length > 1 ? p[p.length - 1].toLowerCase() : 'jpg';
}