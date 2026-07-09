import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let inst     = null;
let loadProm = null;

function getInstance() {
  if (!inst) inst = new FFmpeg();
  return inst;
}

export async function loadFFmpeg(onLog) {
  if (loadProm) return loadProm;
  const ff = getInstance();

  // Attach a single persistent log handler and fan-out to the latest subscriber.
  // (ff.on('log') would otherwise stack handlers across repeated calls.)
  let currentHandler = onLog || null;
  ff.on('log', ({ message }) => { if (currentHandler) currentHandler(message); });

  loadProm = (async () => {
    // Use the ES module build — ffmpeg.wasm's worker tries importScripts first
    // then falls back to dynamic import(). The ESM build works with import().
    try {
      await ff.load({
        coreURL: '/ffmpeg/ffmpeg-core.esm.js',
        wasmURL: '/ffmpeg/ffmpeg-core.wasm',
      });
    } catch (err) {
      loadProm = null; // allow retry on next call
      inst     = null; // discard broken instance
      throw err;
    }
  })();

  // Allow callers to swap the log subscriber (e.g. between runs).
  loadProm.setLogHandler = (fn) => { currentHandler = fn || null; };
  return loadProm;
}

export async function runFFmpeg(file, args, outputExt, onProgress) {
  const loader  = await loadFFmpeg();
  const ff      = getInstance();
  const inExt   = (file.name.split('.').pop() || 'bin').toLowerCase();
  const inName  = `in.${inExt}`;
  const outName = `out.${outputExt}`;

  const progHandler = ({ progress }) => onProgress && onProgress(Math.round(progress * 100));
  ff.on('progress', progHandler);

  // Capture ffmpeg log for better error messages.
  const logs = [];
  const logHandler = ({ message }) => { logs.push(message); };
  loader.setLogHandler(logHandler);

  try {
    await ff.writeFile(inName, await fetchFile(file));
    const resolved = args.map(a =>
      a === '__INPUT__'  ? inName  :
      a === '__OUTPUT__' ? outName : a
    );

    let code;
    try {
      code = await ff.exec(resolved);
    } catch (execErr) {
      const tail = logs.slice(-10).join('\n');
      const msg = execErr?.message || String(execErr);
      throw new Error(`FFmpeg crashed: ${msg}\n${tail}`);
    }

    if (code !== 0) {
      const tail = logs.slice(-10).join('\n');
      throw new Error(`FFmpeg exited with code ${code}\n${tail}`);
    }
    const data = await ff.readFile(outName);
    return new Blob([data.buffer], { type: getMime(outputExt) });
  } catch (err) {
    // Re-throw with a clean message
    throw new Error(err?.message || String(err || 'FFmpeg processing failed'));
  } finally {
    ff.off('progress', progHandler);
    loader.setLogHandler(null);
    try { await ff.deleteFile(inName);  } catch {}
    try { await ff.deleteFile(outName); } catch {}
  }
}

function getMime(ext) {
  const m = {
    mp4:'video/mp4',webm:'video/webm',mkv:'video/x-matroska',
    avi:'video/x-msvideo',mov:'video/quicktime',gif:'image/gif',
    mp3:'audio/mpeg',aac:'audio/aac',wav:'audio/wav',
    flac:'audio/flac',ogg:'audio/ogg',opus:'audio/ogg',m4a:'audio/mp4',
    png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',
    webp:'image/webp',avif:'image/avif',bmp:'image/bmp',
  };
  return m[ext] || 'application/octet-stream';
}