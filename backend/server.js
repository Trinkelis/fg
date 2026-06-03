'use strict';
const express        = require('express');
const multer         = require('multer');
const { execFile }   = require('child_process');
const path           = require('path');
const fs             = require('fs');
const { v4: uuid }   = require('uuid');

const app     = express();
const PORT    = process.env.PORT || 3000;
const DIST    = path.join(__dirname, '../frontend/dist');
const UPLOADS = '/tmp/fg-uploads';
const OUTPUTS = '/tmp/fg-outputs';

for (const d of [UPLOADS, OUTPUTS]) fs.mkdirSync(d, { recursive: true });

// COOP/COEP headers are set by nginx reverse proxy;
// setting them here would duplicate headers and break cross-origin isolation.
// If running without nginx, uncomment the block below:
// app.use((_req, res, next) => {
//   res.setHeader('Cross-Origin-Opener-Policy',   'same-origin');
//   res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
//   next();
// });

app.use(express.json({ limit: '2mb' }));
app.use(express.static(DIST));

// Output file download
app.use('/outputs', express.static(OUTPUTS, {
  setHeaders: (res, fp) => {
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fp)}"`);
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  },
}));

// Multer — no size limit
const storage = multer.diskStorage({
  destination: UPLOADS,
  filename: (_req, file, cb) => {
    cb(null, uuid() + (path.extname(file.originalname).toLowerCase() || '.bin'));
  },
});
const upload = multer({ storage });

// ── Image upload ──────────────────────────────────────────────────────────
app.post('/api/image/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ id: req.file.filename, size: req.file.size });
});

// ── ImageMagick process ───────────────────────────────────────────────────
app.post('/api/image/process', (req, res) => {
  const { inputId, args, outputExt = 'jpg' } = req.body || {};
  if (!inputId || !Array.isArray(args)) return res.status(400).json({ error: 'Bad request' });

  const safeId   = path.basename(inputId).replace(/[^a-zA-Z0-9._-]/g, '');
  const inPath   = path.join(UPLOADS, safeId);
  if (!fs.existsSync(inPath)) return res.status(404).json({ error: 'Input not found' });

  const safeExt  = outputExt.replace(/[^a-z0-9]/gi, '').slice(0, 10);
  const outName  = `${uuid()}.${safeExt}`;
  const outPath  = path.join(OUTPUTS, outName);

  const resolved = args.map(a =>
    a === '__INPUT__'  ? inPath  :
    a === '__OUTPUT__' ? outPath : a
  );

  console.log('[magick]', resolved.join(' '));

  execFile('magick', resolved, { timeout: 120_000 }, (err, _out, stderr) => {
    if (err) {
      console.error('[magick]', stderr?.slice(-600));
      return res.status(500).json({ error: 'ImageMagick failed', details: stderr?.slice(-600) });
    }
    res.json({ downloadUrl: `/outputs/${outName}` });
  });
});

// ── Cleanup (> 2h old) ────────────────────────────────────────────────────
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const dir of [UPLOADS, OUTPUTS]) {
    try {
      for (const f of fs.readdirSync(dir)) {
        const fp = path.join(dir, f);
        try { if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp); } catch {}
      }
    } catch {}
  }
}, 60 * 60 * 1000);

app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`fg-ffmpeg :${PORT}`));