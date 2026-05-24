// Returns { args: string[], command: string, outputExt: string }
export function buildCommand(media, operations) {
  if (!media) return { args:[], command:'', outputExt:'mp4' };

  const ena = getEnabled(operations);
  const pre = [];   // before -i
  const post = [];  // after -i
  const vf = [];
  const af = [];
  let ext = getExt(media.name);

  // ── Pre-input options ──────────────────────────────────────────
  if (ena.trim) {
    const { start = 0 } = ena.trim;
    if (start > 0) pre.push('-ss', toHMS(start));
  }
  if (ena.loop)        pre.push('-stream_loop', String((ena.loop.count || 3) - 1));
  if (ena.imgToVideo)  pre.push('-loop', '1', '-framerate', String(ena.imgToVideo.fps || 25));
  if (ena.hwaccel)     pre.push('-hwaccel', ena.hwaccel.type || 'auto');

  // ── Input ─────────────────────────────────────────────────────
  pre.push('-i', '__INPUT__');

  // ── Duration (after trim seek) ────────────────────────────────
  if (ena.trim) {
    const { start = 0, end } = ena.trim;
    if (end !== null && end !== undefined) {
      post.push('-t', toHMS(Math.max(0, end - start)));
    }
  }
  if (ena.imgToVideo) post.push('-t', String(ena.imgToVideo.duration || 5));

  // ── Video filters ─────────────────────────────────────────────
  if (ena.scale) {
    const { width = -1, height = -1, keepAspect = true } = ena.scale;
    vf.push(keepAspect
      ? `scale=${width}:${height}`
      : `scale=${width}:${height}:force_original_aspect_ratio=disable`);
  }

  if (ena.crop) {
    const { w, h, x = 0, y = 0 } = ena.crop;
    if (w && h) vf.push(`crop=${w}:${h}:${x}:${y}`);
  }

  if (ena.pad) {
    const { w = 1920, h = 1080, x = 0, y = 0, color = 'black' } = ena.pad;
    vf.push(`pad=${w}:${h}:${x}:${y}:${color}`);
  }

  if (ena.letterbox) {
    const { w = 1920, h = 1080, color = 'black' } = ena.letterbox;
    vf.push(`scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:${color}`);
  }

  if (ena.fps) vf.push(`fps=${ena.fps.fps || 30}`);

  if (ena.speed) {
    const f = ena.speed.factor || 1.0;
    if (f !== 1.0) {
      vf.push(`setpts=${(1 / f).toFixed(6)}*PTS`);
      af.push(...atempoChain(f));
    }
  }

  if (ena.rotate) {
    const a = Number(ena.rotate.angle) || 90;
    if      (a === 90)  vf.push('transpose=1');
    else if (a === 180) vf.push('transpose=2,transpose=2');
    else if (a === 270) vf.push('transpose=2');
  }

  if (ena.flip) {
    if (ena.flip.horizontal) vf.push('hflip');
    if (ena.flip.vertical)   vf.push('vflip');
  }

  if (ena.reverse)     { vf.push('reverse');     af.push('areverse'); }
  if (ena.deinterlace) vf.push('yadif');

  if (ena.zoompan) {
    const { zoom = 1.5, duration = 5, fps = 25 } = ena.zoompan;
    const frames = Math.round(duration * fps);
    vf.push(`zoompan=z='min(zoom+0.0015,${zoom})':d=${frames}:fps=${fps}`);
  }

  if (ena.chromakey) {
    const { color = '0x00ff00', similarity = 0.1, blend = 0 } = ena.chromakey;
    vf.push(`chromakey=${color}:${similarity}:${blend}`);
  }

  if (ena.colorCorrect) {
    const { brightness = 0, contrast = 1, saturation = 1, gamma = 1 } = ena.colorCorrect;
    vf.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}:gamma=${gamma}`);
  }

  if (ena.hue)       vf.push(`hue=h=${ena.hue.degrees || 0}`);
  if (ena.grayscale) vf.push('hue=s=0');
  if (ena.sepia)     vf.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');

  if (ena.blur) {
    const { sigma = 3, type = 'gaussian' } = ena.blur;
    vf.push(type === 'box' ? `boxblur=${sigma}:${sigma}` : `gblur=sigma=${sigma}`);
  }

  if (ena.sharpen) vf.push(`unsharp=5:5:${ena.sharpen.amount || 1.5}:5:5:0`);

  if (ena.denoise) {
    const s = ena.denoise.strength || 1.5;
    vf.push(`hqdn3d=${s}:${s}:${s * 3}:${s * 3}`);
  }

  if (ena.vignette)  vf.push(`vignette=angle=${ena.vignette.angle || 0.628}`);

  if (ena.drawText) {
    const { text = '', x = 10, y = 10, size = 48, color = 'white' } = ena.drawText;
    const esc = String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:');
    vf.push(`drawtext=text='${esc}':x=${x}:y=${y}:fontsize=${size}:fontcolor=${color}`);
  }

  if (ena.hdrTonemap) {
    vf.push('zscale=transfer=linear,tonemap=tonemap=hable,zscale=transfer=bt709,format=yuv420p');
  }

  // ── Audio filters ─────────────────────────────────────────────
  const noAudio = ena.removeAudio || ena.extractAudio;

  if (!noAudio) {
    if (ena.volume && (ena.volume.level || 1) !== 1)
      af.push(`volume=${ena.volume.level}`);

    if (ena.normalize) {
      const { I = -16, LRA = 11, TP = -1.5 } = ena.normalize;
      af.push(`loudnorm=I=${I}:LRA=${LRA}:TP=${TP}`);
    }

    if (ena.fadeIn)  af.push(`afade=t=in:d=${ena.fadeIn.duration || 1}`);
    if (ena.fadeOut) af.push(`afade=t=out:st=${ena.fadeOut.startAt || 0}:d=${ena.fadeOut.duration || 1}`);

    if (ena.audioDelay) {
      const ms = Math.round((ena.audioDelay.delay || 0) * 1000);
      if (ms > 0) af.push(`adelay=${ms}|${ms}`);
    }

    if (ena.equalizer) {
      const { bass = 0, mid = 0, treble = 0 } = ena.equalizer;
      if (bass  !== 0) af.push(`bass=g=${bass}`);
      if (mid   !== 0) af.push(`equalizer=f=1000:width_type=o:width=2:g=${mid}`);
      if (treble !== 0) af.push(`treble=g=${treble}`);
    }

    if (ena.pitch) {
      const rate = Math.pow(2, (ena.pitch.semitones || 0) / 12);
      af.push(`asetrate=44100*${rate.toFixed(6)},aresample=44100`);
    }

    // audioTempo only when speed is NOT active (they conflict)
    if (ena.audioTempo && !ena.speed) af.push(...atempoChain(ena.audioTempo.tempo || 1));

    if (ena.stereoToMono) af.push('pan=mono|c0=0.5*c0+0.5*c1');
    if (ena.monoToStereo) af.push('pan=stereo|c0=c0|c1=c0');

    if (ena.noiseGate) {
      const { threshold = -30, range = -40 } = ena.noiseGate;
      af.push(`agate=threshold=${threshold}dB:range=${range}dB`);
    }

    if (ena.compressor) {
      const { threshold = -20, ratio = 4, attack = 5, release = 50 } = ena.compressor;
      af.push(`acompressor=threshold=${threshold}dB:ratio=${ratio}:attack=${attack}:release=${release}`);
    }

    if (ena.echo) {
      const { delay = 600, decay = 0.4 } = ena.echo;
      af.push(`aecho=0.8:0.9:${delay}:${decay}`);
    }

    if (ena.silenceRemove) {
      const { threshold = 0.02, duration = 1 } = ena.silenceRemove;
      af.push(`silenceremove=stop_periods=-1:stop_duration=${duration}:stop_threshold=${threshold}`);
    }

    if (ena.sampleRate) post.push('-ar', String(ena.sampleRate.rate || 44100));
    if (ena.channels)   post.push('-ac', String(ena.channels.count || 2));
  }

  // ── Apply filter chains ───────────────────────────────────────
  if (ena.gifExport) {
    const { fps = 15, width = 480 } = ena.gifExport;
    const gifPre = [`scale=${width}:-1:flags=lanczos`, `fps=${fps}`, ...vf].join(',');
    const gifVf  = `${gifPre},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
    post.push('-vf', gifVf);
    ext = 'gif';
  } else {
    if (vf.length) post.push('-vf', vf.join(','));
  }
  if (af.length && !noAudio) post.push('-af', af.join(','));

  // ── Encoding ─────────────────────────────────────────────────
  if (ena.pixfmt)    post.push('-pix_fmt', ena.pixfmt.format || 'yuv420p');

  if (ena.videoCodec && !ena.streamCopy?.video) {
    const { codec, crf, preset } = ena.videoCodec;
    if (codec === 'copy') {
      post.push('-c:v', 'copy');
    } else if (codec) {
      post.push('-c:v', codec);
      if (crf !== undefined) post.push('-crf', String(crf));
      if (preset) post.push('-preset', preset);
    }
  }

  if (ena.audioCodec && !noAudio && !ena.streamCopy?.audio) {
    const { codec, bitrate, flacLevel, opusApp } = ena.audioCodec;
    if (codec === 'copy') {
      post.push('-c:a', 'copy');
    } else if (codec) {
      post.push('-c:a', codec);
      if (codec !== 'flac' && !codec.startsWith('pcm_') && bitrate) post.push('-b:a', bitrate);
      if (codec === 'flac' && flacLevel !== undefined) post.push('-compression_level', String(flacLevel));
      if (codec === 'libopus' && opusApp) post.push('-application', opusApp);
    }
  }

  if (ena.streamCopy) {
    if (ena.streamCopy.video) post.push('-c:v', 'copy');
    if (ena.streamCopy.audio && !noAudio) post.push('-c:a', 'copy');
  }

  if (ena.removeAudio)  post.push('-an');
  if (ena.extractAudio) {
    post.push('-vn');
    ext = ena.extractAudio.format || 'mp3';
  }

  if (ena.imgFormat)  ext = ena.imgFormat.format || ext;
  if (ena.imgQuality) post.push('-q:v', String(ena.imgQuality.quality || 2));

  if (ena.container) ext = ena.container.format || ext;

  if (ena.streamMap) {
    const { video, audio } = ena.streamMap;
    if (video) post.push('-map', video);
    if (audio) post.push('-map', audio);
  }

  if (ena.metadata) {
    const { title, artist, album, year, comment, genre } = ena.metadata;
    if (title)   post.push('-metadata', `title=${title}`);
    if (artist)  post.push('-metadata', `artist=${artist}`);
    if (album)   post.push('-metadata', `album=${album}`);
    if (year)    post.push('-metadata', `date=${year}`);
    if (comment) post.push('-metadata', `comment=${comment}`);
    if (genre)   post.push('-metadata', `genre=${genre}`);
  }

  const args = [...pre, ...post, '-y', '__OUTPUT__'];
  const inName  = media.name || 'input';
  const outName = `output.${ext}`;
  const display = args.map(a =>
    a === '__INPUT__'  ? inName  :
    a === '__OUTPUT__' ? outName : a
  );
  const command = 'ffmpeg ' + display.map(a => /\s|,/.test(a) ? `"${a}"` : a).join(' ');

  return { args, command, outputExt: ext };
}

// Build CSS filter string for instant visual preview
export function buildCSSPreview(operations) {
  const ena = getEnabled(operations);
  const f = [], t = [];

  if (ena.colorCorrect) {
    const { brightness = 0, contrast = 1, saturation = 1 } = ena.colorCorrect;
    f.push(`brightness(${1 + brightness})`, `contrast(${contrast})`, `saturate(${saturation})`);
  }
  if (ena.grayscale) f.push('grayscale(1)');
  if (ena.sepia)     f.push('sepia(1)');
  if (ena.blur)      f.push(`blur(${(ena.blur.sigma || 3) * 0.25}px)`);
  if (ena.hue)       f.push(`hue-rotate(${ena.hue.degrees || 0}deg)`);

  if (ena.rotate) {
    const a = Number(ena.rotate.angle) || 90;
    t.push(`rotate(${a}deg)`);
  }
  if (ena.flip) {
    const sx = ena.flip.horizontal ? -1 : 1;
    const sy = ena.flip.vertical   ? -1 : 1;
    t.push(`scale(${sx},${sy})`);
  }

  return {
    filter:    f.length ? f.join(' ') : undefined,
    transform: t.length ? t.join(' ') : undefined,
  };
}

// ── Helpers ────────────────────────────────────────────────────
function getEnabled(operations) {
  const out = {};
  for (const [id, op] of Object.entries(operations)) {
    if (op?.enabled) out[id] = op.params || {};
  }
  return out;
}

function getExt(name = '') {
  const p = name.split('.');
  return p.length > 1 ? p[p.length - 1].toLowerCase() : 'mp4';
}

function toHMS(s) {
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = (s % 60).toFixed(3).padStart(6, '0');
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${sc}`;
}

function atempoChain(factor) {
  const filters = [];
  let r = factor;
  while (r > 2.0)  { filters.push('atempo=2.0');  r /= 2.0; }
  while (r < 0.5)  { filters.push('atempo=0.5');  r /= 0.5; }
  filters.push(`atempo=${r.toFixed(4)}`);
  return filters;
}
