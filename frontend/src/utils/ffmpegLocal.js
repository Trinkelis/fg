import { FFmpeg }               from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let inst     = null;
let loadProm = null;

function getInstance() {
  if (!inst) inst = new FFmpeg();
  return inst;
}

export async function loadFFmpeg(onLog) {
  if (loadProm) return loadProm;
  const ff = getInstance();
  if (onLog) ff.on('log', ({ message }) => onLog(message));
  loadProm = (async () => {
    const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    try {
      await ff.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`,   'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    } catch (err) {
      loadProm = null; // allow retry on next call
      inst     = null; // discard broken instance
      throw err;
    }
  })();
  return loadProm;
}

export async function runFFmpeg(file, args, outputExt, onProgress) {
  await loadFFmpeg();
  const ff      = getInstance();
  const inExt   = (file.name.split('.').pop() || 'bin').toLowerCase();
  const inName  = `in.${inExt}`;
  const outName = `out.${outputExt}`;

  const handler = ({ progress }) => onProgress && onProgress(Math.round(progress * 100));
  ff.on('progress', handler);

  try {
    await ff.writeFile(inName, await fetchFile(file));
    const resolved = args.map(a =>
      a === '__INPUT__'  ? inName  :
      a === '__OUTPUT__' ? outName : a
    );
    const code = await ff.exec(resolved);
    if (code !== 0) throw new Error(`FFmpeg exited with code ${code}`);
    const data = await ff.readFile(outName);
    return new Blob([data.buffer], { type: getMime(outputExt) });
  } finally {
    ff.off('progress', handler);
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