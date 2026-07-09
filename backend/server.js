'use strict';
const express      = require('express');
const multer       = require('multer');
const path         = require('path');
const fs           = require('fs');
const fsp          = require('fs/promises');
const os           = require('os');
const { v4: uuid } = require('uuid');
const { datamoshStream, DatamoshError } = require('./datamosh');
const { datamoshTransition }            = require('./datamosh_transition');

const app  = express();
const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, '../frontend/dist');

// We use os.tmpdir() (often tmpfs on Linux) for the briefest possible
// lifetime — uploads and pipeline outputs are deleted as soon as the
// response stream finishes. Nothing is ever served from a persistent URL.
const SCRATCH_DIR = path.join(os.tmpdir(), 'fg-scratch');
fs.mkdirSync(SCRATCH_DIR, { recursive: true });

// In-memory job table for the A→B datamosh transition. The HTTP request
// returns a jobId in <1s so the browser's default response-start timer
// (which is ~30s on Chrome) can't kick in mid-pipeline; the frontend then
// polls /api/datamosh-transition/:jobId for status + progress, and pulls
// the .avi from /api/datamosh-transition/:jobId/download when ready.
//
// Each job holds its inputs/output on disk under SCRATCH_DIR and is
// auto-cleaned after 1h — same privacy posture as the scratch dir, just
// spread across two requests instead of one.
const JOBS = new Map();   // jobId -> { status, progress, label, error, fileA, fileB, outputPath, filename, startedAt }
const JOB_TTL_MS = 60 * 60 * 1000;

function newJob(fileA, fileB) {
  const jobId = uuid();
  JOBS.set(jobId, {
    status:     'processing',   // 'processing' | 'done' | 'error'
    progress:   0,
    step:       0,
    totalSteps: 8,
    label:      'Queued',
    error:      null,
    fileA,
    fileB,
    outputPath: null,
    filename:   null,
    startedAt:  Date.now(),
  });
  return jobId;
}

function updateJob(jobId, patch) {
  const j = JOBS.get(jobId);
  if (!j) return;
  Object.assign(j, patch);
}

function getJob(jobId) {
  const j = JOBS.get(jobId);
  if (!j) return null;
  // Strip large / private fields before returning to the client.
  const { fileA, fileB, outputPath, ...rest } = j;
  return rest;
}

function sweepJobs() {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, j] of JOBS) {
    if (j.startedAt < cutoff) cleanupJob(id, j);
  }
}
setInterval(sweepJobs, 5 * 60 * 1000).unref();

function cleanupJob(id, j) {
  if (!j) j = JOBS.get(id);
  if (!j) return;
  for (const f of [j.fileA, j.fileB]) {
    if (f?.path) { try { fs.unlinkSync(f.path); } catch {} }
  }
  if (j.outputPath) { try { fs.unlinkSync(j.outputPath); } catch {} }
  JOBS.delete(id);
}

// Note: COOP/COEP headers are set by the nginx reverse proxy
// (see nginx/fg.mwlmedia.org.conf) so SharedArrayBuffer stays enabled.
// If running without nginx, uncomment the block below:
// app.use((_req, res, next) => {
//   res.setHeader('Cross-Origin-Opener-Policy',   'same-origin');
//   res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
//   next();
// });

app.use(express.json({ limit: '2mb' }));
app.use(express.static(DIST));

// ── Datamosh (native, ephemeral, streamed) ────────────────────────────────
//
// Accepts multipart upload + form fields (moshStart, normalGop, quality),
// runs FFglitch (ffgac + ffedit), and streams the resulting .avi back as
// the response. Nothing is written to a persistent location — the input
// and output are deleted in the same handler cycle. The server never
// exposes a download URL for the result, so there is nothing left to leak.
//
// Custom response headers carry the pipeline metadata:
//   X-Fg-Fps, X-Fg-Mosh-Frame, X-Fg-Total-Frames
//
app.post('/api/datamosh', (req, res) => {
  // multer with custom storage pointing at our scratch dir (not /tmp/fg-uploads).
  const upload = multer({
    storage: multer.diskStorage({
      destination: SCRATCH_DIR,
      filename: (_req, file, cb) => {
        cb(null, `mosh-${uuid()}${path.extname(file.originalname).toLowerCase() || '.bin'}`);
      },
    }),
    limits: { fileSize: 4 * 1024 * 1024 * 1024 },
  }).single('file');

  upload(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message || 'Upload failed' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file' });

    const moshStart = parseFloat(req.body.moshStart);
    if (!Number.isFinite(moshStart) || moshStart < 0) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ error: 'moshStart must be a non-negative number (seconds)' });
    }
    const normalGop = Math.max(1, parseInt(req.body.normalGop, 10) || 30);
    const quality   = Math.max(2, Math.min(31, parseInt(req.body.quality, 10) || 3));

    console.log(`[datamosh] start=${moshStart}s gop=${normalGop} q=${quality} in=${req.file.filename}`);

    const filename = `moshed-${path.parse(req.file.originalname).name || 'output'}.avi`;
    try {
      const result = await datamoshStream({
        inputPath:        req.file.path,
        res,
        filename,
        moshStartSeconds: moshStart,
        normalGop,
        quality,
      });
      console.log(`[datamosh] done  fps=${result.fps.toFixed(3)} mosh@frame=${result.moshStartFrame}`);
    } catch (err) {
      // If the client already disconnected, don't bother logging / writing —
      // they're not listening and the socket is gone.
      if (res.destroyed || req.aborted) {
        console.log('[datamosh] client disconnected, aborting pipeline');
      } else {
        const message = err instanceof DatamoshError
          ? err.message
          : `Datamosh failed: ${err?.message || err}`;
        console.error('[datamosh]', message);
        if (res.headersSent) {
          res.destroy(err);
        } else {
          res.status(500).json({ error: message });
        }
      }
    } finally {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
  });
});

// ── Datamosh Transition (A -> melt -> B) — job-based ────────────────────────
//
// Why a job table: the cross-clip pipeline can easily take 30+ seconds for
// realistic clips, but Chrome's default response-start timer is ~30s. Doing
// the whole render inside one request made the browser give up with
// "Failed to fetch" before any bytes arrived.
//
// Flow:
//   1. POST /api/datamosh-transition   — uploads both clips, returns { jobId }
//                                          in <1s. Pipeline runs in background.
//   2. GET  /api/datamosh-transition/:jobId         — status + progress
//   3. GET  /api/datamosh-transition/:jobId/download — streams the .avi
//
// Storage is the same scratch dir, just spread across two requests; the
// job table is auto-swept after 1h and uploads + output are unlinked.
//
app.post('/api/datamosh-transition', (req, res) => {
  const upload = multer({
    storage: multer.diskStorage({
      destination: SCRATCH_DIR,
      filename: (_req, file, cb) => {
        const tag = file.fieldname === 'fileB' ? 'moshB' : 'moshA';
        cb(null, `${tag}-${uuid()}${path.extname(file.originalname).toLowerCase() || '.bin'}`);
      },
    }),
    limits: { fileSize: 4 * 1024 * 1024 * 1024 },
  }).fields([
    { name: 'fileA', maxCount: 1 },
    { name: 'fileB', maxCount: 1 },
  ]);

  upload(req, res, (uploadErr) => {
    const fileA = req.files?.fileA?.[0];
    const fileB = req.files?.fileB?.[0];

    if (uploadErr) {
      for (const f of [fileA, fileB]) { if (f) { try { fs.unlinkSync(f.path); } catch {} } }
      if (res.destroyed || req.aborted) return;
      return res.status(400).json({ error: uploadErr.message || 'Upload failed' });
    }
    if (!fileA || !fileB) {
      for (const f of [fileA, fileB]) { if (f) { try { fs.unlinkSync(f.path); } catch {} } }
      return res.status(400).json({ error: 'Both clipA (fileA) and clipB (fileB) are required' });
    }

    const transitionAt = parseFloat(req.body.transitionAt);
    if (!Number.isFinite(transitionAt) || transitionAt < 0) {
      for (const f of [fileA, fileB]) { try { fs.unlinkSync(f.path); } catch {} }
      return res.status(400).json({ error: 'transitionAt must be a non-negative number (seconds)' });
    }
    let meltDuration = null;
    if (req.body.meltDuration != null && String(req.body.meltDuration).trim() !== '') {
      const n = parseFloat(req.body.meltDuration);
      if (Number.isFinite(n) && n >= 0) meltDuration = n;
    }
    const normalGop    = Math.max(1, parseInt(req.body.normalGop, 10) || 30);
    const quality      = Math.max(2, Math.min(31, parseInt(req.body.quality, 10) || 3));
    const includeAudio = String(req.body.includeAudio ?? 'true').toLowerCase() !== 'false';

    const jobId = newJob(fileA, fileB);
    const stemA = path.parse(fileA.originalname).name || 'clipA';
    const stemB = path.parse(fileB.originalname).name || 'clipB';
    const filename = `transition-${stemA}-to-${stemB}.avi`;
    const outputPath = path.join(
      SCRATCH_DIR, `mosh-out-${jobId}${path.extname(filename).toLowerCase() || '.avi'}`
    );

    console.log(
      `[datamosh-transition] job=${jobId.slice(0, 8)} at=${transitionAt}s ` +
      `melt=${meltDuration ?? 'never'} gop=${normalGop} q=${quality} audio=${includeAudio} ` +
      `A=${fileA.filename} B=${fileB.filename}`
    );

    // Respond IMMEDIATELY with the jobId — don't block on the pipeline.
    res.json({ jobId, status: 'processing' });

    // Run the pipeline in the background.
    (async () => {
      try {
        const result = await datamoshTransition({
          clipAPath:          fileA.path,
          clipBPath:          fileB.path,
          outputPath,
          transitionAtSeconds: transitionAt,
          meltDurationSeconds: meltDuration,
          normalGop,
          quality,
          includeAudio,
          onProgress: (step, total, label, fraction) => {
            updateJob(jobId, {
              step, totalSteps: total, label, progress: fraction,
            });
          },
        });
        updateJob(jobId, {
          status: 'done', progress: 1, label: 'Done',
          outputPath, filename,
          result: {
            fps:             result.fps,
            frameWidth:      result.frameWidth,
            frameHeight:     result.frameHeight,
            transitionFrame: result.transitionFrame,
            settleFrame:     result.settleFrame,
          },
        });
        // Delete the source clips immediately — the output is the only
        // thing we still need to serve (until the user downloads it).
        for (const f of [fileA, fileB]) { try { fs.unlinkSync(f.path); } catch {} }
        updateJob(jobId, { fileA: null, fileB: null });
        console.log(
          `[datamosh-transition] job=${jobId.slice(0, 8)} done ` +
          `${result.frameWidth}x${result.frameHeight}@${result.fps.toFixed(3)}fps ` +
          `transition@frame=${result.transitionFrame} settle=${result.settleFrame ?? 'never'}`
        );
      } catch (err) {
        const message = err instanceof DatamoshError
          ? err.message
          : `Datamosh transition failed: ${err?.message || err}`;
        // Free disk space on failure too.
        for (const f of [fileA, fileB]) { try { fs.unlinkSync(f.path); } catch {} }
        updateJob(jobId, { status: 'error', error: message, fileA: null, fileB: null });
        console.error(`[datamosh-transition] job=${jobId.slice(0, 8)}`, message);
      }
    })();
  });
});

// Status / progress — the frontend polls this every ~1s while a job is alive.
app.get('/api/datamosh-transition/:jobId', (req, res) => {
  const j = getJob(req.params.jobId);
  if (!j) return res.status(404).json({ error: 'job not found or expired' });
  res.json(j);
});

// Streams the .avi when the job is done. Custom headers carry the same
// metadata the streaming endpoint used to (X-Fg-*), so the frontend can
// re-use the existing render path.
app.get('/api/datamosh-transition/:jobId/download', (req, res) => {
  const j = JOBS.get(req.params.jobId);
  if (!j) return res.status(404).json({ error: 'job not found or expired' });
  if (j.status !== 'done' || !j.outputPath) {
    return res.status(409).json({ error: `job is ${j.status}, not ready to download` });
  }
  const stat = (() => { try { return fs.statSync(j.outputPath); } catch { return null; } })();
  if (!stat) return res.status(410).json({ error: 'output no longer available' });

  res.setHeader('Content-Type',        'video/x-msvideo');
  res.setHeader('Content-Length',      String(stat.size));
  res.setHeader('Content-Disposition', `attachment; filename="${j.filename || 'transition.avi'}"`);
  res.setHeader('Cache-Control',       'no-store');
  if (j.result) {
    res.setHeader('X-Fg-Fps',              String(j.result.fps));
    res.setHeader('X-Fg-Frame-Width',      String(j.result.frameWidth));
    res.setHeader('X-Fg-Frame-Height',     String(j.result.frameHeight));
    res.setHeader('X-Fg-Transition-Frame', String(j.result.transitionFrame));
    if (j.result.settleFrame != null) {
      res.setHeader('X-Fg-Settle-Frame', String(j.result.settleFrame));
    }
  }
  fs.createReadStream(j.outputPath)
    .on('end', () => { /* keep the file for a moment in case the user re-downloads */ })
    .pipe(res);
});

// ── Safety-net cleanup of any orphaned scratch files ──────────────────────
// In normal operation nothing should remain in SCRATCH_DIR (every upload is
// deleted in the handler), but a crashed handler or ungraceful exit could
// leave a file behind. Sweep once an hour for files older than 1 hour.
setInterval(async () => {
  try {
    const cutoff = Date.now() - 60 * 60 * 1000;
    const files = await fsp.readdir(SCRATCH_DIR);
    for (const f of files) {
      const fp = path.join(SCRATCH_DIR, f);
      try {
        const st = await fsp.stat(fp);
        if (st.mtimeMs < cutoff) await fsp.unlink(fp);
      } catch {}
    }
  } catch {}
}, 60 * 60 * 1000);

// Healthcheck
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// SPA fallback
app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`fg-ffmpeg :${PORT}`);
});

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n[${sig}] shutting down…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}