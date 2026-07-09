export const CATEGORIES = [
  { id:'video',    label:'Video'    },
  { id:'audio',    label:'Audio'    },
  { id:'image',    label:'Image'    },
  { id:'filters',  label:'Filters'  },
  { id:'encoding', label:'Encoding' },
];

export const OPERATIONS = [
  // ════════════════════════════════════════════════════════════
  //  VIDEO
  // ════════════════════════════════════════════════════════════
  { id:'trim', label:'Trim / Cut', category:'video', applies:['video','audio'],
    defaultParams:{ start:0, end:null }, controls:[], hasTrimBar:true },

  { id:'crop', label:'Crop', category:'video', applies:['video','image'],
    defaultParams:{ w:1280, h:720, x:0, y:0 }, hasCropOverlay:true,
    controls:[
      { id:'w', label:'Width',    type:'number', min:1, max:7680, unit:'px' },
      { id:'h', label:'Height',   type:'number', min:1, max:4320, unit:'px' },
      { id:'x', label:'X Offset', type:'number', min:0, max:7680, unit:'px' },
      { id:'y', label:'Y Offset', type:'number', min:0, max:4320, unit:'px' },
    ]},

  { id:'scale', label:'Scale / Resize', category:'video', applies:['video','image'],
    defaultParams:{ width:1280, height:720, keepAspect:true },
    controls:[
      { id:'width',      label:'Width',             type:'number',   min:1, max:7680, unit:'px' },
      { id:'height',     label:'Height',            type:'number',   min:1, max:4320, unit:'px' },
      { id:'keepAspect', label:'Keep aspect ratio', type:'checkbox' },
    ]},

  { id:'fps', label:'Frame Rate', category:'video', applies:['video'],
    defaultParams:{ fps:30 },
    controls:[{ id:'fps', label:'FPS', type:'slider', min:1, max:120, step:1 }]},

  { id:'speed', label:'Speed Change', category:'video', applies:['video'],
    defaultParams:{ factor:1.0 },
    controls:[{ id:'factor', label:'Speed', type:'slider', min:0.25, max:4, step:0.05, unit:'x' }],
    note:'Also adjusts audio tempo proportionally.' },

  { id:'rotate', label:'Rotate', category:'video', applies:['video','image'],
    defaultParams:{ angle:90 },
    controls:[
      { id:'angle', label:'Angle', type:'select', options:[
        { value:90,  label:'90° Clockwise'       },
        { value:180, label:'180°'                },
        { value:270, label:'270° CW  (90° CCW)'  },
      ]},
    ]},

  { id:'flip', label:'Flip', category:'video', applies:['video','image'],
    defaultParams:{ horizontal:false, vertical:false },
    controls:[
      { id:'horizontal', label:'Flip horizontal', type:'checkbox' },
      { id:'vertical',   label:'Flip vertical',   type:'checkbox' },
    ]},

  { id:'reverse', label:'Reverse', category:'video', applies:['video'],
    defaultParams:{}, controls:[],
    note:'Reverses video and audio. Can be very slow on large files.' },

  { id:'deinterlace', label:'Deinterlace (yadif)', category:'video', applies:['video'],
    defaultParams:{}, controls:[] },

  { id:'loop', label:'Loop', category:'video', applies:['video'],
    defaultParams:{ count:3 },
    controls:[{ id:'count', label:'Loop count', type:'number', min:2, max:100 }]},

  { id:'pad', label:'Add Padding / Borders', category:'video', applies:['video','image'],
    defaultParams:{ w:1920, h:1080, x:0, y:0, color:'black' },
    controls:[
      { id:'w',     label:'Output width',  type:'number', min:1, max:7680, unit:'px' },
      { id:'h',     label:'Output height', type:'number', min:1, max:4320, unit:'px' },
      { id:'x',     label:'X position',    type:'number', min:0, max:7680, unit:'px' },
      { id:'y',     label:'Y position',    type:'number', min:0, max:4320, unit:'px' },
      { id:'color', label:'Color',         type:'color'                              },
    ]},

  { id:'letterbox', label:'Letterbox / Pillarbox', category:'video', applies:['video','image'],
    defaultParams:{ w:1920, h:1080, color:'black' },
    controls:[
      { id:'w',     label:'Target width',  type:'number', min:1, max:7680, unit:'px' },
      { id:'h',     label:'Target height', type:'number', min:1, max:4320, unit:'px' },
      { id:'color', label:'Bar color',     type:'color'                              },
    ]},

  { id:'zoompan', label:'Ken Burns / Zoom Pan', category:'video', applies:['video','image'],
    defaultParams:{ zoom:1.5, duration:5, fps:25 },
    controls:[
      { id:'zoom',     label:'Max zoom',  type:'slider', min:1.0, max:3.0, step:0.05, unit:'x' },
      { id:'duration', label:'Duration',  type:'slider', min:1,   max:30,  step:0.5,  unit:'s' },
      { id:'fps',      label:'FPS',       type:'slider', min:1,   max:60,  step:1           },
    ]},

  { id:'chromakey', label:'Chroma Key (Green Screen)', category:'video', applies:['video'],
    defaultParams:{ color:'0x00ff00', similarity:0.1, blend:0.0 },
    controls:[
      { id:'color',      label:'Key color',  type:'color'                                        },
      { id:'similarity', label:'Similarity', type:'slider', min:0.01, max:0.5, step:0.01         },
      { id:'blend',      label:'Blend',      type:'slider', min:0.0,  max:0.5, step:0.01         },
    ]},

  { id:'gifExport', label:'GIF Export (high quality)', category:'video', applies:['video'],
    defaultParams:{ fps:15, width:480 },
    controls:[
      { id:'fps',   label:'GIF FPS', type:'slider', min:1, max:30,   step:1            },
      { id:'width', label:'Width',   type:'number', min:64, max:1920, unit:'px'        },
    ],
    note:'Uses palettegen + paletteuse for best-quality GIF output.' },

  { id:'mirror', label:'Mirror / Kaleidoscope', category:'video', applies:['video'],
    defaultParams:{ type:'horizontal' },
    controls:[
      { id:'type', label:'Mirror axis', type:'select', options:[
        { value:'horizontal', label:'Horizontal (left-right)' },
        { value:'vertical',   label:'Vertical (top-bottom)'   },
      ]},
    ]},

  { id:'motionBlur', label:'Motion Blur', category:'video', applies:['video'],
    defaultParams:{ frames:5 },
    controls:[{ id:'frames', label:'Frames to blend', type:'slider', min:2, max:15, step:1 }]},

  { id:'pixelize', label:'Pixelize', category:'video', applies:['video'],
    defaultParams:{ size:10 },
    controls:[{ id:'size', label:'Pixel size', type:'slider', min:2, max:64, step:1, unit:'px' }]},

  { id:'datamosh', label:'Datamosh (Native · FFglitch)', category:'video', applies:['video'],
    defaultParams:{ moshStart:5, normalGop:30, quality:3 },
    controls:[
      { id:'normalGop', label:'GOP before mosh',     type:'number', min:1, max:300, step:1 },
      { id:'quality',   label:'Quality (2=best)',    type:'slider', min:2, max:10, step:1 },
    ],
    note:'Server-rendered via FFglitch (ffgac + ffedit). The mosh start time '
        + 'is set on the timeline below the preview — click anywhere on it to '
        + 'scrub and mark the moment the melt begins. The video stream is '
        + 'processed and returned directly; nothing is saved on the server.',
    hasMoshBar:true },

  { id:'datamoshTransition', label:'Datamosh (Transition · A→B)', category:'video', applies:['video'],
    defaultParams:{ transitionAt:5, meltDuration:3, normalGop:30, quality:3, includeAudio:true },
    controls:[
      { id:'meltDuration', label:'Melt duration (s, 0 = never settles)', type:'number', min:0, max:600, step:0.5 },
      { id:'normalGop',    label:'GOP after melt (if settles)',          type:'number', min:1, max:300, step:1 },
      { id:'quality',      label:'Quality (2=best)',                    type:'slider', min:2, max:10, step:1 },
      { id:'includeAudio', label:'Include audio (hard cut at transition)', type:'checkbox' },
    ],
    note:'Server-rendered A→datamosh→B transition. Load clip A as your main video, '
        + 'then load clip B via the “Clip B (destination)” button in the header. '
        + 'The transition point on clip A’s timeline is set the same way as the '
        + 'single-clip mosh — click anywhere on the timeline below the preview. '
        + 'Melt duration = seconds until B is allowed a clean keyframe; 0 = never '
        + 'settles, the rest of B stays moshed forever. B is auto-scaled to A’s '
        + 'resolution/fps. Nothing is saved on the server — both inputs and the '
        + 'output are streamed through and deleted in the same request.',
    hasMoshBar:true },

  // ════════════════════════════════════════════════════════════
  //  AUDIO
  // ════════════════════════════════════════════════════════════
  { id:'volume', label:'Volume', category:'audio', applies:['video','audio'],
    defaultParams:{ level:1.0 },
    controls:[{ id:'level', label:'Volume', type:'slider', min:0, max:4, step:0.01, unit:'x' }]},

  { id:'normalize', label:'Loudness Normalize (loudnorm)', category:'audio', applies:['video','audio'],
    defaultParams:{ I:-16, LRA:11, TP:-1.5 },
    controls:[
      { id:'I',   label:'Target LUFS (I)',   type:'slider', min:-40, max:-5,  step:0.5, unit:'LUFS' },
      { id:'LRA', label:'Loudness range',    type:'slider', min:1,   max:20,  step:0.5, unit:'LU'   },
      { id:'TP',  label:'True peak ceiling', type:'slider', min:-9,  max:0,   step:0.5, unit:'dBTP' },
    ]},

  { id:'fadeIn', label:'Audio Fade In', category:'audio', applies:['video','audio'],
    defaultParams:{ duration:1 },
    controls:[{ id:'duration', label:'Duration', type:'slider', min:0.1, max:10, step:0.1, unit:'s' }]},

  { id:'fadeOut', label:'Audio Fade Out', category:'audio', applies:['video','audio'],
    defaultParams:{ duration:1, startAt:0 },
    controls:[
      { id:'duration', label:'Fade duration', type:'slider', min:0.1, max:10,    step:0.1, unit:'s' },
      { id:'startAt',  label:'Start at',      type:'number', min:0,   max:86400, unit:'s'           },
    ]},

  { id:'audioDelay', label:'Audio Delay / Sync', category:'audio', applies:['video','audio'],
    defaultParams:{ delay:0 },
    controls:[{ id:'delay', label:'Delay', type:'slider', min:0, max:5, step:0.01, unit:'s' }],
    note:'Delays audio relative to video. Use to fix sync issues.' },

  { id:'equalizer', label:'Equalizer (Bass / Mid / Treble)', category:'audio', applies:['video','audio'],
    defaultParams:{ bass:0, mid:0, treble:0 },
    controls:[
      { id:'bass',   label:'Bass',   type:'slider', min:-15, max:15, step:0.5, unit:'dB' },
      { id:'mid',    label:'Mid',    type:'slider', min:-15, max:15, step:0.5, unit:'dB' },
      { id:'treble', label:'Treble', type:'slider', min:-15, max:15, step:0.5, unit:'dB' },
    ]},

  { id:'pitch', label:'Pitch Shift', category:'audio', applies:['video','audio'],
    defaultParams:{ semitones:0 },
    controls:[{ id:'semitones', label:'Semitones', type:'slider', min:-12, max:12, step:0.5, unit:'st' }],
    note:'Uses asetrate trick — also slightly adjusts playback speed.' },

  { id:'audioTempo', label:'Audio Tempo (no pitch change)', category:'audio', applies:['audio'],
    defaultParams:{ tempo:1.0 },
    controls:[{ id:'tempo', label:'Tempo', type:'slider', min:0.5, max:2.0, step:0.01, unit:'x' }],
    note:'For audio-only. For video, use Speed Change in the Video tab.' },

  { id:'telephone', label:'Telephone Filter', category:'audio', applies:['video','audio'],
    defaultParams:{ lo:300, hi:3400 },
    controls:[
      { id:'lo', label:'Low cut (Hz)',  type:'slider', min:100,  max:1000, step:50 },
      { id:'hi', label:'High cut (Hz)', type:'slider', min:2000, max:6000, step:100 },
    ],
    note:'Simulates a telephone / walkie-talkie bandpass effect.' },

  { id:'bitcrusher', label:'Bitcrusher (Lo-Fi)', category:'audio', applies:['video','audio'],
    defaultParams:{ bits:8, samples:1 },
    controls:[
      { id:'bits',    label:'Bit depth',      type:'slider', min:2,  max:16, step:1 },
      { id:'samples', label:'Sample decimation', type:'slider', min:1, max:8,  step:1 },
    ],
    note:'Reduces bit depth for lo-fi / retro sound.' },

  { id:'stereoToMono', label:'Stereo → Mono',             category:'audio', applies:['video','audio'], defaultParams:{}, controls:[] },
  { id:'monoToStereo', label:'Mono → Stereo (duplicate)', category:'audio', applies:['video','audio'], defaultParams:{}, controls:[] },

  { id:'sampleRate', label:'Sample Rate Conversion', category:'audio', applies:['video','audio'],
    defaultParams:{ rate:44100 },
    controls:[
      { id:'rate', label:'Sample rate', type:'select', options:[
        { value:8000,   label:'8,000 Hz'   }, { value:11025, label:'11,025 Hz' },
        { value:22050,  label:'22,050 Hz'  }, { value:44100, label:'44,100 Hz' },
        { value:48000,  label:'48,000 Hz'  }, { value:96000, label:'96,000 Hz' },
        { value:192000, label:'192,000 Hz' },
      ]},
    ]},

  { id:'channels', label:'Audio Channels', category:'audio', applies:['video','audio'],
    defaultParams:{ count:2 },
    controls:[
      { id:'count', label:'Channels', type:'select', options:[
        { value:1, label:'1 (Mono)'   }, { value:2, label:'2 (Stereo)' },
        { value:6, label:'6 (5.1)'    }, { value:8, label:'8 (7.1)'    },
      ]},
    ]},

  { id:'noiseGate', label:'Noise Gate', category:'audio', applies:['video','audio'],
    defaultParams:{ threshold:-30, range:-40 },
    controls:[
      { id:'threshold', label:'Threshold', type:'slider', min:-60, max:0,   step:0.5, unit:'dB' },
      { id:'range',     label:'Range',     type:'slider', min:-90, max:-10, step:0.5, unit:'dB' },
    ]},

  { id:'compressor', label:'Audio Compressor', category:'audio', applies:['video','audio'],
    defaultParams:{ threshold:-20, ratio:4, attack:5, release:50 },
    controls:[
      { id:'threshold', label:'Threshold', type:'slider', min:-60, max:0,   step:0.5, unit:'dB' },
      { id:'ratio',     label:'Ratio',     type:'slider', min:1,   max:20,  step:0.5, unit:':1' },
      { id:'attack',    label:'Attack',    type:'slider', min:0.1, max:200, step:0.1, unit:'ms' },
      { id:'release',   label:'Release',   type:'slider', min:1,   max:500, step:1,   unit:'ms' },
    ]},

  { id:'echo', label:'Echo / Reverb', category:'audio', applies:['video','audio'],
    defaultParams:{ delay:600, decay:0.4 },
    controls:[
      { id:'delay', label:'Delay',  type:'slider', min:50,  max:2000, step:10  },
      { id:'decay', label:'Decay',  type:'slider', min:0.1, max:0.9,  step:0.01 },
    ]},

  { id:'silenceRemove', label:'Remove Silence', category:'audio', applies:['video','audio'],
    defaultParams:{ threshold:0.02, duration:1 },
    controls:[
      { id:'threshold', label:'Silence threshold', type:'slider', min:0.001, max:0.2, step:0.001 },
      { id:'duration',  label:'Min silence dur.',  type:'slider', min:0.1,   max:5,   step:0.1,  unit:'s' },
    ]},

  { id:'removeAudio',  label:'Remove Audio Track', category:'audio', applies:['video'],       defaultParams:{}, controls:[] },
  { id:'extractAudio', label:'Extract Audio Only',  category:'audio', applies:['video'],
    defaultParams:{ format:'mp3' },
    controls:[
      { id:'format', label:'Output format', type:'select', options:[
        { value:'mp3',  label:'MP3'          }, { value:'aac',  label:'AAC'    },
        { value:'wav',  label:'WAV'          }, { value:'flac', label:'FLAC'   },
        { value:'ogg',  label:'OGG Vorbis'   }, { value:'opus', label:'Opus'   },
        { value:'m4a',  label:'M4A'          },
      ]},
    ]},

  // ════════════════════════════════════════════════════════════
  //  IMAGE
  // ════════════════════════════════════════════════════════════
  { id:'imgFormat', label:'Convert Format', category:'image', applies:['image'],
    defaultParams:{ format:'png' },
    controls:[
      { id:'format', label:'Output format', type:'select', options:[
        { value:'png',  label:'PNG'  }, { value:'jpg',  label:'JPEG'  },
        { value:'webp', label:'WebP' }, { value:'avif', label:'AVIF'  },
        { value:'bmp',  label:'BMP'  }, { value:'tiff', label:'TIFF'  },
        { value:'gif',  label:'GIF'  },
      ]},
    ]},

  { id:'imgQuality', label:'JPEG / WebP Quality', category:'image', applies:['image'],
    defaultParams:{ quality:85 },
    controls:[{ id:'quality', label:'Quality %', type:'slider', min:1, max:100, step:1 }],
    note:'Sets -quality for JPEG/WebP. Higher = better.' },

  { id:'imgToVideo', label:'Image → Video (loop)', category:'image', applies:['image'],
    defaultParams:{ duration:5, fps:25 },
    controls:[
      { id:'duration', label:'Duration', type:'slider', min:1, max:120, step:0.5, unit:'s' },
      { id:'fps',      label:'FPS',      type:'slider', min:1, max:60,  step:1           },
    ]},

  { id:'im_charcoal',   label:'Charcoal Sketch',          category:'image', applies:['image'], defaultParams:{ factor:2 },         controls:[{ id:'factor',    label:'Factor',           type:'slider', min:0.5, max:5,   step:0.1           }] },
  { id:'im_oilpaint',   label:'Oil Paint',                category:'image', applies:['image'], defaultParams:{ radius:3 },         controls:[{ id:'radius',    label:'Brush radius',     type:'slider', min:1,   max:10,  step:1             }] },
  { id:'im_sketch',     label:'Pencil Sketch',            category:'image', applies:['image'], defaultParams:{ sigma:5, angle:45 },
    controls:[
      { id:'sigma', label:'Blur sigma', type:'slider', min:1,  max:30,  step:0.5 },
      { id:'angle', label:'Angle',      type:'slider', min:0,  max:360, step:1, unit:'°' },
    ]},
  { id:'im_emboss',     label:'Emboss',                   category:'image', applies:['image'], defaultParams:{ radius:3 },         controls:[{ id:'radius',    label:'Radius',           type:'slider', min:1,   max:15,  step:1             }] },
  { id:'im_swirl',      label:'Swirl',                    category:'image', applies:['image'], defaultParams:{ degrees:90 },       controls:[{ id:'degrees',   label:'Degrees',          type:'slider', min:-360,max:360, step:1,  unit:'°'   }] },
  { id:'im_wave',       label:'Wave Distortion',          category:'image', applies:['image'],
    defaultParams:{ amplitude:10, wavelength:100 },
    controls:[
      { id:'amplitude',  label:'Amplitude',  type:'slider', min:1,  max:80,  step:1, unit:'px' },
      { id:'wavelength', label:'Wavelength', type:'slider', min:10, max:500, step:5, unit:'px' },
    ]},
  { id:'im_implode',    label:'Implode / Explode',        category:'image', applies:['image'], defaultParams:{ factor:0.5 },       controls:[{ id:'factor',    label:'Factor (neg=explode)', type:'slider', min:-2, max:2, step:0.05 }] },
  { id:'im_solarize',   label:'Solarize',                 category:'image', applies:['image'], defaultParams:{ threshold:50 },     controls:[{ id:'threshold', label:'Threshold',         type:'slider', min:1,   max:99,  step:1,  unit:'%'   }] },
  { id:'im_spread',     label:'Spread / Diffuse',         category:'image', applies:['image'], defaultParams:{ amount:5 },         controls:[{ id:'amount',    label:'Amount',            type:'slider', min:1,   max:30,  step:1             }] },
  { id:'im_pixelate',   label:'Pixelate',                 category:'image', applies:['image'], defaultParams:{ size:10 },          controls:[{ id:'size',      label:'Pixel size',        type:'slider', min:2,   max:50,  step:1             }] },
  { id:'im_negate',     label:'Invert Colors',            category:'image', applies:['image'], defaultParams:{},                   controls:[] },
  { id:'im_normalize',  label:'Normalize',                category:'image', applies:['image'], defaultParams:{},                   controls:[] },
  { id:'im_equalize',   label:'Equalize Histogram',       category:'image', applies:['image'], defaultParams:{},                   controls:[] },
  { id:'im_autolevel',  label:'Auto Level',               category:'image', applies:['image'], defaultParams:{},                   controls:[] },
  { id:'im_autogamma',  label:'Auto Gamma',               category:'image', applies:['image'], defaultParams:{},                   controls:[] },
  { id:'im_threshold',  label:'Threshold (B&W)',          category:'image', applies:['image'], defaultParams:{ value:50 },         controls:[{ id:'value',     label:'Threshold',         type:'slider', min:1,   max:99,  step:1,  unit:'%'   }] },
  { id:'im_posterize',  label:'Posterize',                category:'image', applies:['image'], defaultParams:{ levels:4 },         controls:[{ id:'levels',    label:'Color levels',      type:'slider', min:2,   max:16,  step:1             }] },
  { id:'im_border',     label:'Add Border',               category:'image', applies:['image'], defaultParams:{ width:10, color:'black' },
    controls:[
      { id:'width', label:'Width', type:'slider', min:1, max:200, step:1, unit:'px' },
      { id:'color', label:'Color', type:'color' },
    ]},
  { id:'im_tint',       label:'Color Tint',               category:'image', applies:['image'], defaultParams:{ color:'#0000ff', amount:50 },
    controls:[
      { id:'color',  label:'Tint color', type:'color' },
      { id:'amount', label:'Amount',     type:'slider', min:1, max:100, step:1, unit:'%' },
    ]},
  { id:'im_colorize',   label:'Colorize',                 category:'image', applies:['image'], defaultParams:{ color:'#ff0000', amount:30 },
    controls:[
      { id:'color',  label:'Color',   type:'color' },
      { id:'amount', label:'Blend %', type:'slider', min:1, max:100, step:1, unit:'%' },
    ]},
  { id:'im_addnoise',   label:'Add Noise',                category:'image', applies:['image'], defaultParams:{ type:'Gaussian' },
    controls:[
      { id:'type', label:'Noise type', type:'select', options:[
        { value:'Gaussian',  label:'Gaussian'                },
        { value:'Impulse',   label:'Impulse (Salt & Pepper)' },
        { value:'Laplacian', label:'Laplacian'               },
        { value:'Poisson',   label:'Poisson'                 },
      ]},
    ]},
  { id:'im_despeckle',  label:'Despeckle (reduce noise)', category:'image', applies:['image'], defaultParams:{}, controls:[] },
  { id:'im_clahe',      label:'CLAHE (local contrast)',   category:'image', applies:['image'], defaultParams:{ size:64, limit:3 },
    controls:[
      { id:'size',  label:'Tile size',   type:'slider', min:16, max:128, step:8  },
      { id:'limit', label:'Clip limit',  type:'slider', min:1,  max:10,  step:0.5 },
    ]},
  { id:'im_strip',      label:'Strip EXIF Metadata',      category:'image', applies:['image'], defaultParams:{}, controls:[] },
  { id:'im_trim_auto',  label:'Auto Trim Whitespace',      category:'image', applies:['image'], defaultParams:{ fuzz:10 },         controls:[{ id:'fuzz', label:'Color fuzz', type:'slider', min:0, max:50, step:1, unit:'%' }] },
  { id:'im_deskew',     label:'Auto Deskew (straighten)', category:'image', applies:['image'], defaultParams:{}, controls:[] },

  // ════════════════════════════════════════════════════════════
  //  FILTERS  (video + image)
  // ════════════════════════════════════════════════════════════
  { id:'colorCorrect', label:'Color Correction (eq)', category:'filters', applies:['video','image'],
    defaultParams:{ brightness:0, contrast:1, saturation:1, gamma:1 },
    controls:[
      { id:'brightness', label:'Brightness', type:'slider', min:-1,  max:1,   step:0.01 },
      { id:'contrast',   label:'Contrast',   type:'slider', min:0.1, max:3,   step:0.01 },
      { id:'saturation', label:'Saturation', type:'slider', min:0,   max:3,   step:0.01 },
      { id:'gamma',      label:'Gamma',      type:'slider', min:0.1, max:3,   step:0.01 },
    ]},

  { id:'hue',       label:'Hue Shift',  category:'filters', applies:['video','image'], defaultParams:{ degrees:0 },       controls:[{ id:'degrees', label:'Hue', type:'slider', min:-180, max:180, step:1, unit:'°' }] },
  { id:'grayscale', label:'Grayscale',  category:'filters', applies:['video','image'], defaultParams:{}, controls:[] },
  { id:'sepia',     label:'Sepia Tone', category:'filters', applies:['video','image'], defaultParams:{}, controls:[] },

  { id:'blur', label:'Blur', category:'filters', applies:['video','image'],
    defaultParams:{ sigma:3, type:'gaussian' },
    controls:[
      { id:'sigma', label:'Strength', type:'slider', min:0.1, max:40, step:0.1 },
      { id:'type',  label:'Type',     type:'select', options:[
        { value:'gaussian', label:'Gaussian (gblur)' },
        { value:'box',      label:'Box blur'         },
      ]},
    ]},

  { id:'sharpen', label:'Sharpen (unsharp mask)', category:'filters', applies:['video','image'],
    defaultParams:{ amount:1.5 },
    controls:[{ id:'amount', label:'Amount', type:'slider', min:0.1, max:5, step:0.1 }]},

  { id:'denoise', label:'Denoise (hqdn3d)', category:'filters', applies:['video','image'],
    defaultParams:{ strength:1.5 },
    controls:[{ id:'strength', label:'Strength', type:'slider', min:0.1, max:10, step:0.1 }]},

  { id:'vignette', label:'Vignette', category:'filters', applies:['video','image'],
    defaultParams:{ angle:0.628 },
    controls:[{ id:'angle', label:'Intensity', type:'slider', min:0.1, max:3.14, step:0.01, unit:'rad' }]},

  { id:'drawText', label:'Draw Text', category:'filters', applies:['video','image'],
    defaultParams:{ text:'Hello World', x:10, y:10, size:48, color:'white' },
    controls:[
      { id:'text',  label:'Text',      type:'text'                                },
      { id:'x',     label:'X',         type:'number', min:0, max:9999, unit:'px' },
      { id:'y',     label:'Y',         type:'number', min:0, max:9999, unit:'px' },
      { id:'size',  label:'Font size', type:'slider', min:8, max:300,  step:1    },
      { id:'color', label:'Color',     type:'color'                               },
    ]},

  { id:'vhsEffect', label:'VHS / Retro Effect', category:'filters', applies:['video'],
    defaultParams:{ intensity:1.0 },
    controls:[{ id:'intensity', label:'Intensity', type:'slider', min:0.1, max:3, step:0.1 }]},

  { id:'filmGrain', label:'Film Grain', category:'filters', applies:['video'],
    defaultParams:{ amount:10 },
    controls:[{ id:'amount', label:'Amount', type:'slider', min:1, max:40, step:1 }]},

  { id:'scanlines', label:'Scanlines (TV)', category:'filters', applies:['video'],
    defaultParams:{ darkness:0.4 },
    controls:[{ id:'darkness', label:'Line darkness', type:'slider', min:0.05, max:0.9, step:0.05 }]},

  { id:'oldFilm', label:'Old Film', category:'filters', applies:['video'],
    defaultParams:{ grain:12, saturation:0.35 },
    controls:[
      { id:'grain',      label:'Grain amount', type:'slider', min:1,   max:30,  step:1  },
      { id:'saturation', label:'Saturation',   type:'slider', min:0.1, max:0.8, step:0.05 },
    ]},

  { id:'edgeDetect', label:'Edge Detect', category:'filters', applies:['video'],
    defaultParams:{ low:0.1, high:0.4 },
    controls:[
      { id:'low',  label:'Low threshold',  type:'slider', min:0.01, max:0.5, step:0.01 },
      { id:'high', label:'High threshold', type:'slider', min:0.1,  max:1.0, step:0.01 },
    ]},

  { id:'fisheye', label:'Fisheye / Barrel Distortion', category:'filters', applies:['video'],
    defaultParams:{ strength:0.2 },
    controls:[{ id:'strength', label:'Distortion strength', type:'slider', min:0.01, max:0.8, step:0.01 }]},

  { id:'warmFilter', label:'Warm Filter', category:'filters', applies:['video','image'],
    defaultParams:{ amount:1.0 },
    controls:[{ id:'amount', label:'Intensity', type:'slider', min:0.1, max:3, step:0.1 }]},

  { id:'coolFilter', label:'Cool / Cinematic Filter', category:'filters', applies:['video','image'],
    defaultParams:{ amount:1.0 },
    controls:[{ id:'amount', label:'Intensity', type:'slider', min:0.1, max:3, step:0.1 }]},

  { id:'neon', label:'Neon / Glow Edges', category:'filters', applies:['video'],
    defaultParams:{ low:0.05, high:0.3 },
    controls:[
      { id:'low',  label:'Low threshold',  type:'slider', min:0.01, max:0.3, step:0.01 },
      { id:'high', label:'High threshold', type:'slider', min:0.1,  max:0.8, step:0.01 },
    ]},

  { id:'hdrTonemap', label:'HDR → SDR Tonemap (zscale)', category:'filters', applies:['video'],
    defaultParams:{}, controls:[],
    note:'Requires FFmpeg built with libzimg.' },

  // ════════════════════════════════════════════════════════════
  //  ENCODING
  // ════════════════════════════════════════════════════════════
  { id:'videoCodec', label:'Video Codec', category:'encoding', applies:['video'],
    defaultParams:{ codec:'libx264', crf:23, preset:'medium' },
    controls:[
      { id:'codec',  label:'Codec',   type:'select', options:[
        { value:'libx264',    label:'H.264 (libx264)'             },
        { value:'libx265',    label:'H.265 / HEVC (libx265)'      },
        { value:'libvpx-vp9', label:'VP9 (libvpx-vp9)'           },
        { value:'libaom-av1', label:'AV1 (libaom)'                },
        { value:'copy',       label:'Stream copy (no re-encode)'  },
      ]},
      { id:'crf',    label:'CRF (lower = better quality)', type:'slider', min:0, max:63, step:1 },
      { id:'preset', label:'Preset', type:'select', options:[
        { value:'ultrafast',label:'Ultrafast'}, { value:'superfast',label:'Superfast'},
        { value:'veryfast', label:'Very fast'}, { value:'faster',   label:'Faster'  },
        { value:'fast',     label:'Fast'     }, { value:'medium',   label:'Medium'  },
        { value:'slow',     label:'Slow'     }, { value:'veryslow', label:'Very slow'},
      ]},
    ]},

  { id:'audioCodec', label:'Audio Codec', category:'encoding', applies:['video','audio'],
    defaultParams:{ codec:'aac', bitrate:'192k', flacLevel:5, opusApp:'audio' },
    controls:[
      { id:'codec',     label:'Codec',   type:'select', options:[
        { value:'aac',        label:'AAC'                  }, { value:'libmp3lame', label:'MP3'              },
        { value:'libopus',    label:'Opus'                 }, { value:'flac',       label:'FLAC (lossless)'  },
        { value:'pcm_s16le',  label:'PCM 16-bit (WAV)'     }, { value:'pcm_s24le',  label:'PCM 24-bit (WAV)' },
        { value:'pcm_s32le',  label:'PCM 32-bit (WAV)'     }, { value:'copy',       label:'Stream copy'      },
      ]},
      { id:'bitrate',   label:'Bitrate',                               type:'select', options:[
        { value:'64k',  label:'64 kbps'  }, { value:'96k',  label:'96 kbps'  },
        { value:'128k', label:'128 kbps' }, { value:'192k', label:'192 kbps' },
        { value:'256k', label:'256 kbps' }, { value:'320k', label:'320 kbps' },
      ]},
      { id:'flacLevel', label:'FLAC compression (0=fast, 12=best)',    type:'slider', min:0, max:12, step:1 },
      { id:'opusApp',   label:'Opus application',                      type:'select', options:[
        { value:'audio',    label:'Audio (music)'  },
        { value:'voip',     label:'VoIP (speech)'  },
        { value:'lowdelay', label:'Low delay'       },
      ]},
    ]},

  { id:'pixfmt', label:'Pixel Format', category:'encoding', applies:['video'],
    defaultParams:{ format:'yuv420p' },
    controls:[
      { id:'format', label:'Pixel format', type:'select', options:[
        { value:'yuv420p',    label:'yuv420p (8-bit, most compatible)' },
        { value:'yuv422p',    label:'yuv422p (8-bit)'                  },
        { value:'yuv444p',    label:'yuv444p (8-bit)'                  },
        { value:'yuv420p10le',label:'yuv420p10le (10-bit)'             },
        { value:'yuv422p10le',label:'yuv422p10le (10-bit)'             },
        { value:'rgb24',      label:'rgb24'                            },
        { value:'rgba',       label:'rgba (with alpha)'                },
      ]},
    ]},

  { id:'container', label:'Container Format', category:'encoding', applies:['video'],
    defaultParams:{ format:'mp4' },
    controls:[
      { id:'format', label:'Format', type:'select', options:[
        { value:'mp4', label:'MP4' }, { value:'mkv',  label:'MKV'     },
        { value:'webm',label:'WebM'}, { value:'avi',  label:'AVI'     },
        { value:'mov', label:'MOV' }, { value:'ts',   label:'MPEG-TS' },
        { value:'flv', label:'FLV' },
      ]},
    ]},

  { id:'streamCopy', label:'Stream Copy (fast remux)', category:'encoding', applies:['video'],
    defaultParams:{ video:true, audio:true },
    controls:[
      { id:'video', label:'Copy video stream', type:'checkbox' },
      { id:'audio', label:'Copy audio stream', type:'checkbox' },
    ],
    note:'No re-encoding. Cannot be combined with filters.' },

  { id:'hwaccel', label:'Hardware Acceleration', category:'encoding', applies:['video'],
    defaultParams:{ type:'auto' },
    controls:[
      { id:'type', label:'Backend', type:'select', options:[
        { value:'auto',          label:'Auto (let FFmpeg decide)'  },
        { value:'cuda',          label:'NVIDIA CUDA (nvenc)'       },
        { value:'videotoolbox',  label:'Apple VideoToolbox'        },
        { value:'qsv',           label:'Intel Quick Sync (QSV)'    },
        { value:'vaapi',         label:'VAAPI (Linux GPU)'         },
      ]},
    ],
    note:'Must pair with a compatible -c:v encoder (e.g. h264_nvenc for CUDA).' },

  { id:'metadata', label:'Metadata Tags', category:'encoding', applies:['video','audio'],
    defaultParams:{ title:'', artist:'', album:'', year:'', comment:'', genre:'' },
    controls:[
      { id:'title',   label:'Title',   type:'text' }, { id:'artist',  label:'Artist',  type:'text' },
      { id:'album',   label:'Album',   type:'text' }, { id:'year',    label:'Year',    type:'text' },
      { id:'comment', label:'Comment', type:'text' }, { id:'genre',   label:'Genre',   type:'text' },
    ]},

  { id:'streamMap', label:'Stream Mapping (-map)', category:'encoding', applies:['video'],
    defaultParams:{ video:'0:v:0', audio:'0:a:0' },
    controls:[
      { id:'video', label:'Video stream specifier', type:'text' },
      { id:'audio', label:'Audio stream specifier', type:'text' },
    ],
    note:'e.g. 0:v:0 = first input, video, first stream.' },
];