'use strict';
const express = require('express');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;
const DIST    = path.join(__dirname, '../frontend/dist');

// Required for FFmpeg.wasm SharedArrayBuffer
app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy',  'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
  next();
});

app.use(express.static(DIST));
app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`fg-ffmpeg on :${PORT}`));
