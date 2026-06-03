// Describes local image operations (processed via Canvas API in browser)
export function buildMagickCommand(media, operations) {
  if (!media) return { command: '', outputExt: 'jpg', isScript: false };

  const ena = getEnabled(operations);
  let ext = getExt(media.name);
  if (ena.imgFormat) ext = ena.imgFormat.format || ext;
  const outName = `output.${ext}`;

  const opLabels = {
    scale:'Resize', crop:'Crop', pad:'Pad', letterbox:'Letterbox',
    rotate:'Rotate', flip:'Flip',
    colorCorrect:'Color Correct', hue:'Hue Shift', grayscale:'Grayscale',
    sepia:'Sepia', blur:'Blur', sharpen:'Sharpen', denoise:'Denoise',
    vignette:'Vignette', drawText:'Add Text',
    im_charcoal:'Charcoal', im_oilpaint:'Oil Paint',
    im_sketch:'Pencil Sketch', im_emboss:'Emboss',
    im_swirl:'Swirl', im_wave:'Wave', im_implode:'Implode',
    im_solarize:'Solarize', im_spread:'Spread', im_pixelate:'Pixelate',
    im_negate:'Invert', im_normalize:'Normalize', im_equalize:'Equalize',
    im_autolevel:'Auto Level', im_autogamma:'Auto Gamma',
    im_threshold:'Threshold', im_posterize:'Posterize',
    im_border:'Border', im_tint:'Tint', im_colorize:'Colorize',
    im_addnoise:'Add Noise', im_despeckle:'Despeckle',
    im_clahe:'CLAHE', im_strip:'Strip EXIF',
    im_trim_auto:'Auto Trim', im_deskew:'Auto Deskew',
    imgFormat:'Convert', imgQuality:'Quality',
  };

  const opNames = Object.keys(ena).map(id => opLabels[id] || id);
  const command = opNames.length > 0
    ? `Processing locally: ${opNames.join(' → ')} → ${outName}`
    : `Output: ${outName}`;

  return { command, outputExt: ext, isScript: false };
}

function getEnabled(ops) {
  const out = {};
  for (const [id, op] of Object.entries(ops))
    if (op?.enabled) out[id] = op.params || {};
  return out;
}

function getExt(name='') {
  const p = name.split('.');
  return p.length > 1 ? p[p.length-1].toLowerCase() : 'jpg';
}