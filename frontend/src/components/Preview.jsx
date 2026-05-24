import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import useStore from '../store/useStore.js';
import CropOverlay from './CropOverlay.jsx';
import TrimBar     from './TrimBar.jsx';
import { buildCommand, buildCSSPreview } from '../utils/buildCommand.js';
import { runFFmpeg } from '../utils/ffmpegLocal.js';

export default function Preview() {
  const store = useStore();
  const { media, mediaType, operations, isProcessing, output } = store;

  const videoRef   = useRef();
  const wrapRef    = useRef();
  const fileRef    = useRef();
  const [isDrag,   setIsDrag]   = useState(false);
  const [isPlaying,setIsPlaying]= useState(false);
  const [mediaSize,setMediaSize] = useState({ w:0, h:0 }); // displayed px

  const cropEnabled = operations.trim?.enabled || false;
  const trimEnabled = operations.trim?.enabled || false;
  const hasCrop     = operations.crop?.enabled || false;

  // Compute CSS preview style
  const previewStyle = useMemo(() => buildCSSPreview(operations), [operations]);

  // Compute how to size the displayed media to fill container while preserving aspect ratio
  const computeSize = useCallback((natW, natH) => {
    const wrap = wrapRef.current;
    if (!wrap || !natW || !natH) return;
    const { width: cw, height: ch } = wrap.getBoundingClientRect();
    const maxW = Math.max(cw - 24, 100);
    const maxH = Math.max(ch - 24, 100);
    const scale = Math.min(maxW / natW, maxH / natH);
    setMediaSize({ w: Math.round(natW * scale), h: Math.round(natH * scale) });
  }, []);

  useEffect(() => {
    if (!media) return;
    // Recalculate on resize
    const ro = new ResizeObserver(() => {
      const { actualW, actualH } = store.media || {};
      if (actualW) computeSize(actualW, actualH);
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [media, computeSize, store.media]);

  function onVideoMeta(e) {
    const { videoWidth: w, videoHeight: h, duration: d } = e.target;
    store.setMediaDims(w, h);
    store.setDuration(d);
    computeSize(w, h);
  }

  function onImgLoad(e) {
    const { naturalWidth: w, naturalHeight: h } = e.target;
    store.setMediaDims(w, h);
    computeSize(w, h);
  }

  function loadFile(file) {
    if (file) store.loadMedia(file);
  }

  function onDrop(e) {
    e.preventDefault(); setIsDrag(false);
    loadFile(e.dataTransfer.files[0]);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    isPlaying ? v.pause() : v.play();
  }

  function step(dir) {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.max(0, Math.min(store.duration, store.currentTime + dir / 30));
  }

  async function render() {
    if (!media || isProcessing) return;
    const { args, outputExt } = buildCommand(media, operations);
    store.setIsProcessing(true);
    store.setProgress(0);
    try {
      const blob = await runFFmpeg(media.file, args, outputExt, store.setProgress);
      const url  = URL.createObjectURL(blob);
      store.setOutput({ url, name:`output.${outputExt}`, isBlob:true });
    } catch (err) {
      alert('Render failed: ' + err.message + '\n\nTip: Copy the command and run it locally for large/complex files.');
    } finally {
      store.setIsProcessing(false);
      store.setProgress(0);
    }
  }

  const mStyle = mediaSize.w
    ? { width: mediaSize.w, height: mediaSize.h }
    : { maxWidth:'100%', maxHeight:'calc(100vh - 220px)' };

  return (
    <div className="preview-area"
      onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
      onDragLeave={() => setIsDrag(false)}
      onDrop={onDrop}
    >
      <div className="preview-main" ref={wrapRef}>
        {!media ? (
          <div className={`drop-zone ${isDrag ? 'over' : ''}`}
            onClick={() => fileRef.current.click()}>
            <svg className="dz-icon" width="48" height="48" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <div className="dz-title">Drop media here</div>
            <div className="dz-sub">or click to browse · Video, Audio, Image · up to 4 GB</div>
            <input ref={fileRef} type="file" accept="video/*,audio/*,image/*"
              style={{ display:'none' }} onChange={e => loadFile(e.target.files[0])} />
          </div>
        ) : mediaType === 'video' ? (
          <div className="media-wrap" style={{ position:'relative' }}>
            <video ref={videoRef} className="prev-video" src={media.localUrl}
              style={{ ...mStyle, ...previewStyle }}
              onLoadedMetadata={onVideoMeta}
              onTimeUpdate={e => store.setCurrentTime(e.target.currentTime)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            {hasCrop && mediaSize.w > 0 && (
              <CropOverlay displayW={mediaSize.w} displayH={mediaSize.h} />
            )}
          </div>
        ) : mediaType === 'image' ? (
          <div className="media-wrap" style={{ position:'relative' }}>
            <img className="prev-img" src={media.localUrl} alt={media.name}
              style={{ ...mStyle, ...previewStyle }} onLoad={onImgLoad} />
            {hasCrop && mediaSize.w > 0 && (
              <CropOverlay displayW={mediaSize.w} displayH={mediaSize.h} />
            )}
          </div>
        ) : (
          <div className="prev-audio">
            <svg className="prev-audio-icon" width="72" height="72" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
              <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
            </svg>
            <div className="prev-audio-name">{media.name}</div>
            <audio controls src={media.localUrl} />
          </div>
        )}
      </div>

      {media && mediaType === 'video' && trimEnabled && (
        <TrimBar videoRef={videoRef} />
      )}

      {media && (
        <div className="prev-ctrls">
          {mediaType === 'video' && (
            <>
              <button className="pb" onClick={() => step(-1)} title="Prev frame">
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
              <button className="pb" onClick={() => step(1)} title="Next frame">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 4 15 12 5 20 5 4"/><rect x="17" y="4" width="2" height="16"/>
                </svg>
              </button>
              <span className="time-d">
                {fmt(store.currentTime)} / {fmt(store.duration)}
              </span>
            </>
          )}
          <div className="psp" />
          {output && (
            <a className="pb dl" href={output.url} download={output.name}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </a>
          )}
          <button className="pb render" onClick={render} disabled={isProcessing}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            {isProcessing ? 'Processing…' : 'Render in Browser'}
          </button>
        </div>
      )}
    </div>
  );
}

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
