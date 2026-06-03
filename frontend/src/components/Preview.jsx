import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import useStore            from '../store/useStore.js';
import CropOverlay         from './CropOverlay.jsx';
import TrimBar             from './TrimBar.jsx';
import WaveformDisplay     from './WaveformDisplay.jsx';
import DownloadDialog      from './DownloadDialog.jsx';
import { buildCommand, buildCSSPreview, buildImagePreviewStyles } from '../utils/buildCommand.js';
import { runFFmpeg }                      from '../utils/ffmpegLocal.js';
import { processImageLocal }              from '../utils/processImageLocal.js';

export default function Preview() {
  const store = useStore();
  const { media, mediaType, operations, isProcessing, output } = store;

  const videoRef  = useRef();
  const audioRef  = useRef();
  const wrapRef   = useRef();
  const fileRef   = useRef();
  const [isDrag,    setIsDrag]    = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mediaSize, setMediaSize] = useState({ w:0, h:0 });
  const [copiedCTA, setCopiedCTA] = useState(false);
  const showDownloadDlg = useStore(s => s.showDownloadDialog);
  const setShowDownloadDlg = useStore(s => s.setShowDownloadDialog);
  const [livePreviewUrl, setLivePreviewUrl] = useState(null);
  const previewTimer = useRef(null);
  const lastPreviewUrl = useRef(null);

  const hasCrop = operations.crop?.enabled;
  const hasTrim = operations.trim?.enabled;

  const hasEnabledOps = useMemo(() => {
    return Object.values(operations).some(op => op?.enabled);
  }, [operations]);

  const previewStyle = useMemo(() => buildCSSPreview(operations), [operations]);
  const imagePreviewStyles = useMemo(() => {
    if (mediaType !== 'image' || !media) return {};
    return buildImagePreviewStyles(operations, media.actualW, media.actualH);
  }, [operations, media, mediaType]);

  // ── Live canvas preview for images ──────────────────────────────────
  const previewAbortRef = useRef(null);

  useEffect(() => {
    if (mediaType !== 'image' || !media?.file || !hasEnabledOps) {
      // No operations enabled: show original image, clean up preview
      // Cancel any pending render
      if (previewAbortRef.current) {
        previewAbortRef.current.aborted = true;
        previewAbortRef.current = null;
      }
      if (lastPreviewUrl.current) {
        URL.revokeObjectURL(lastPreviewUrl.current);
        lastPreviewUrl.current = null;
      }
      setLivePreviewUrl(null);
      return;
    }

    // Cancel any previous pending render
    if (previewAbortRef.current) {
      previewAbortRef.current.aborted = true;
    }

    // Create abort token for this render cycle
    const token = { aborted: false };
    previewAbortRef.current = token;

    // Use rAF + short timeout for responsive feel
    const rafId = requestAnimationFrame(() => {
      if (token.aborted) return;

      if (previewTimer.current) clearTimeout(previewTimer.current);
      previewTimer.current = setTimeout(async () => {
        if (token.aborted) return;

        try {
          // Clean up previous preview URL
          if (lastPreviewUrl.current) {
            URL.revokeObjectURL(lastPreviewUrl.current);
          }
          // Preview mode: downsample large images for speed
          const result = await processImageLocal(media.file, operations, undefined, { preview: true });
          if (token.aborted) {
            // Stale render, discard
            URL.revokeObjectURL(result.url);
            return;
          }
          lastPreviewUrl.current = result.url;
          setLivePreviewUrl(result.url);
        } catch {
          // Silently fail — preview is best-effort
        }
      }, 60); // shorter debounce: 60ms feels instant
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [operations, media, mediaType, hasEnabledOps]);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (lastPreviewUrl.current) {
        URL.revokeObjectURL(lastPreviewUrl.current);
      }
    };
  }, []);

  const computeSize = useCallback((natW, natH) => {
    const wrap = wrapRef.current;
    if (!wrap||!natW||!natH) return;
    const { width:cw, height:ch } = wrap.getBoundingClientRect();
    const scale = Math.min((cw-24)/natW, (ch-24)/natH);
    setMediaSize({ w:Math.round(natW*scale), h:Math.round(natH*scale) });
  }, []);

  useEffect(() => {
    if (!media) return;
    const ro = new ResizeObserver(() => {
      const { actualW, actualH } = useStore.getState().media || {};
      if (actualW) computeSize(actualW, actualH);
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [media, computeSize]);

  function onVideoMeta(e) {
    const { videoWidth:w, videoHeight:h, duration:d } = e.target;
    store.setMediaDims(w, h);
    store.setDuration(d);
    computeSize(w, h);
  }

  function onImgLoad(e) {
    // Only track original image dimensions (not live preview)
    if (livePreviewUrl && e.target.src === livePreviewUrl) return;
    const { naturalWidth:w, naturalHeight:h } = e.target;
    store.setMediaDims(w, h);
    computeSize(w, h);
  }

  function loadFile(file) { if (file) store.loadMedia(file); }

  function onDrop(e) {
    e.preventDefault(); setIsDrag(false);
    loadFile(e.dataTransfer.files[0]);
  }

  function togglePlay() {
    const el = videoRef.current || audioRef.current;
    if (!el) return;
    isPlaying ? el.pause() : el.play();
  }

  function step(dir) {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.max(0, Math.min(store.duration, store.currentTime + dir/30));
  }

  async function renderAudio() {
    if (!media||isProcessing) return;
    const { args, outputExt } = buildCommand(media, operations);
    store.setIsProcessing(true); store.setProgress(0);
    try {
      const blob = await runFFmpeg(media.file, args, outputExt, store.setProgress);
      store.setOutput({ url:URL.createObjectURL(blob), name:`output.${outputExt}`, isBlob:true });
    } catch (err) {
      const msg = err?.message || String(err || 'Unknown error');
      alert('Render failed:\n' + msg);
    } finally {
      store.setIsProcessing(false); store.setProgress(0);
    }
  }

  async function processImage() {
    if (!media||isProcessing) return;
    store.setIsProcessing(true); store.setProgress(0);
    try {
      const { url, name } = await processImageLocal(media.file, operations, store.setProgress);
      store.setOutput({ url, name, isBlob:true });
    } catch (err) {
      alert('Image processing failed:\n' + err.message);
    } finally {
      store.setIsProcessing(false);
    }
  }

  function copyVideoCmd() {
    const { command } = buildCommand(media, operations);
    navigator.clipboard.writeText(command).then(() => {
      setCopiedCTA(true); setTimeout(()=>setCopiedCTA(false), 2000);
    });
  }

  const mStyle = mediaSize.w
    ? { width:mediaSize.w, height:mediaSize.h }
    : { maxWidth:'100%', maxHeight:'calc(100vh - 220px)' };

  const trimParams = operations.trim?.params || {};
  const activeMediaRef = mediaType === 'video' ? videoRef : audioRef;

  return (
    <div className="preview-area"
      onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
      onDragLeave={() => setIsDrag(false)}
      onDrop={onDrop}
    >
      <div className="preview-main" ref={wrapRef}>
        {!media ? (
          <div className={`drop-zone ${isDrag?'over':''}`} onClick={()=>fileRef.current.click()}>
            <svg className="dz-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <div className="dz-title">Drop media here</div>
            <div className="dz-sub">Video · Audio · Image — any size</div>
            <input ref={fileRef} type="file" accept="video/*,audio/*,image/*"
              style={{display:'none'}} onChange={e=>loadFile(e.target.files[0])} />
          </div>

        ) : mediaType === 'video' ? (
          <div className="media-wrap">
            <video ref={videoRef} className="prev-video" src={media.localUrl}
              style={{...mStyle, ...previewStyle}}
              onLoadedMetadata={onVideoMeta}
              onTimeUpdate={e => store.setCurrentTime(e.target.currentTime)}
              onPlay={()=>setIsPlaying(true)} onPause={()=>setIsPlaying(false)}
            />
            {hasCrop && mediaSize.w > 0 && <CropOverlay displayW={mediaSize.w} displayH={mediaSize.h} />}
          </div>

        ) : mediaType === 'image' ? (
          <div className="media-wrap">
            <img className="prev-img"
              src={livePreviewUrl || media.localUrl} alt={media.name}
              style={{
                ...mStyle,
                // When live canvas preview is active, effects are already baked in —
                // don't double-apply CSS preview styles
                ...(livePreviewUrl ? {} : { ...previewStyle, ...imagePreviewStyles })
              }}
              onLoad={onImgLoad} />
            {hasCrop && mediaSize.w > 0 && <CropOverlay displayW={mediaSize.w} displayH={mediaSize.h} />}
          </div>

        ) : (
          <div className="prev-audio">
            <svg className="prev-audio-icon" width="64" height="64" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            <div className="prev-audio-name">{media.name}</div>
            {/* Audio element with proper time tracking */}
            <audio ref={audioRef} controls src={media.localUrl}
              onLoadedMetadata={e => store.setDuration(e.target.duration)}
              onTimeUpdate={e => store.setCurrentTime(e.target.currentTime)}
              onPlay={()=>setIsPlaying(true)} onPause={()=>setIsPlaying(false)}
            />
            <WaveformDisplay
              file={media.file}
              currentTime={store.currentTime}
              duration={store.duration}
              trimStart={hasTrim ? trimParams.start : undefined}
              trimEnd={hasTrim ? (trimParams.end ?? store.duration) : undefined}
            />
          </div>
        )}
      </div>

      {/* Trim bar — video AND audio */}
      {media && (mediaType==='video'||mediaType==='audio') && hasTrim && (
        <TrimBar mediaRef={activeMediaRef} />
      )}

      {/* Video copy-command CTA */}
      {media && mediaType === 'video' && (
        <div className="vid-cta">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span>Video processing runs on your local machine — copy the command below and run it in your terminal.</span>
          <button className={`vid-cta-copy ${copiedCTA?'ok':''}`} onClick={copyVideoCmd}>
            {copiedCTA ? '✓ Copied!' : 'Copy command'}
          </button>
        </div>
      )}

      {/* Controls bar */}
      {media && (
        <div className="prev-ctrls">
          {mediaType === 'video' && (
            <>
              <button className="pb" onClick={()=>step(-1)} title="Prev frame">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="19 20 9 12 19 4 19 20"/><rect x="5" y="4" width="2" height="16"/>
                </svg>
              </button>
              <button className="pb play" onClick={togglePlay}>
                {isPlaying
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                }
              </button>
              <button className="pb" onClick={()=>step(1)} title="Next frame">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 4 15 12 5 20 5 4"/><rect x="17" y="4" width="2" height="16"/>
                </svg>
              </button>
              <span className="time-d">{fmt(store.currentTime)} / {fmt(store.duration)}</span>
            </>
          )}
          <div className="psp" />
          {output && mediaType !== 'image' && (
            <a className="pb dl" href={output.url} download={output.name}
              target={output.isBlob?undefined:'_blank'} rel="noreferrer">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </a>
          )}
          {output && mediaType === 'image' && (
            <button className="pb dl" onClick={() => setShowDownloadDlg(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </button>
          )}
          {mediaType === 'audio' && (
            <button className="pb render" onClick={renderAudio} disabled={isProcessing}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              {isProcessing ? 'Processing…' : 'Render in Browser'}
            </button>
          )}
          {mediaType === 'image' && (
            <button className="pb render img-render" onClick={processImage} disabled={isProcessing}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              {isProcessing ? 'Processing…' : 'Process Image'}
            </button>
          )}
        </div>
      )}
      {showDownloadDlg && <DownloadDialog onClose={() => setShowDownloadDlg(false)} />}
    </div>
  );
}

function fmt(s) {
  if (!s||isNaN(s)) return '0:00';
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}