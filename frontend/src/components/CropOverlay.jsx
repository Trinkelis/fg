import { useRef, useEffect, useCallback } from 'react';
import useStore from '../store/useStore.js';

// displayW/H: the actual pixel size of the rendered media element
export default function CropOverlay({ displayW, displayH }) {
  const { media, operations, setOperation } = useStore();
  const dragging = useRef(null); // { type, startX, startY, startRegion }

  const actW = media?.actualW || displayW;
  const actH = media?.actualH || displayH;

  // Region in fractional coords [0,1]
  const p = operations.crop?.params || { x: 0, y: 0, w: actW, h: actH };
  const rf = {
    x: p.x / actW,
    y: p.y / actH,
    w: p.w / actW,
    h: p.h / actH,
  };

  const toFrac = useCallback((clientX, clientY, rect) => ({
    x: Math.max(0, Math.min(1, (clientX - rect.left)  / rect.width)),
    y: Math.max(0, Math.min(1, (clientY - rect.top)   / rect.height)),
  }), []);

  const startDrag = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = { type, startX: e.clientX, startY: e.clientY, startRegion: { ...rf } };
  }, [rf]);

  useEffect(() => {
    function onMove(e) {
      if (!dragging.current) return;
      const overlay = document.querySelector('.crop-overlay');
      if (!overlay) return;
      const rect = overlay.getBoundingClientRect();
      const dx = (e.clientX - dragging.current.startX) / rect.width;
      const dy = (e.clientY - dragging.current.startY) / rect.height;
      const sr = dragging.current.startRegion;
      const MIN = 0.03;
      let { x, y, w, h } = sr;

      const t = dragging.current.type;
      if (t === 'move') {
        x = Math.max(0, Math.min(1 - w, sr.x + dx));
        y = Math.max(0, Math.min(1 - h, sr.y + dy));
      } else {
        if (t.includes('l')) { const nx = sr.x + dx; w = Math.max(MIN, sr.w - dx); x = Math.min(nx, sr.x + sr.w - MIN); }
        if (t.includes('r')) { w = Math.max(MIN, sr.w + dx); }
        if (t.includes('t')) { const ny = sr.y + dy; h = Math.max(MIN, sr.h - dy); y = Math.min(ny, sr.y + sr.h - MIN); }
        if (t.includes('b')) { h = Math.max(MIN, sr.h + dy); }
        x = Math.max(0, x);
        y = Math.max(0, y);
        w = Math.min(1 - x, w);
        h = Math.min(1 - y, h);
      }

      setOperation('crop', {
        x: Math.round(x * actW),
        y: Math.round(y * actH),
        w: Math.round(w * actW),
        h: Math.round(h * actH),
      });
    }
    function onUp() { dragging.current = null; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [actW, actH, setOperation]);

  const left   = `${rf.x * 100}%`;
  const top    = `${rf.y * 100}%`;
  const width  = `${rf.w * 100}%`;
  const height = `${rf.h * 100}%`;

  return (
    <div className="crop-overlay" style={{ width:displayW, height:displayH }}>
      <div className="crop-region" style={{ left, top, width, height }}
        onMouseDown={e => startDrag(e, 'move')}>
        <div className="crop-h tl" onMouseDown={e => startDrag(e, 'tl')} />
        <div className="crop-h tr" onMouseDown={e => startDrag(e, 'tr')} />
        <div className="crop-h bl" onMouseDown={e => startDrag(e, 'bl')} />
        <div className="crop-h br" onMouseDown={e => startDrag(e, 'br')} />
        <div className="crop-h tc" onMouseDown={e => startDrag(e, 't')}  />
        <div className="crop-h bc" onMouseDown={e => startDrag(e, 'b')}  />
        <div className="crop-h lc" onMouseDown={e => startDrag(e, 'l')}  />
        <div className="crop-h rc" onMouseDown={e => startDrag(e, 'r')}  />
      </div>
    </div>
  );
}
