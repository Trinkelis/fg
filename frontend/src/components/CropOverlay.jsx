import { useRef, useEffect, useCallback, useId } from 'react';
import useStore from '../store/useStore.js';

export default function CropOverlay({ displayW, displayH }) {
  const { media, operations, setOperation } = useStore();
  const dragging = useRef(null);
  const maskId   = useId().replace(/:/g, '');

  const actW = media?.actualW || displayW;
  const actH = media?.actualH || displayH;

  const p  = operations.crop?.params || { x:0, y:0, w:actW, h:actH };
  const rf = {
    x: Math.max(0, Math.min(1, p.x / actW)),
    y: Math.max(0, Math.min(1, p.y / actH)),
    w: Math.max(0.01, Math.min(1, p.w / actW)),
    h: Math.max(0.01, Math.min(1, p.h / actH)),
  };

  const startDrag = useCallback((e, type) => {
    e.preventDefault(); e.stopPropagation();
    dragging.current = { type, startX:e.clientX, startY:e.clientY, startR:{ ...rf } };
  }, [rf]);

  useEffect(() => {
    function onMove(e) {
      if (!dragging.current) return;
      const overlay = document.querySelector('.crop-overlay');
      if (!overlay) return;
      const rect = overlay.getBoundingClientRect();
      const dx = (e.clientX - dragging.current.startX) / rect.width;
      const dy = (e.clientY - dragging.current.startY) / rect.height;
      const sr = dragging.current.startR;
      const t  = dragging.current.type;
      const MIN = 0.02;
      let { x, y, w, h } = sr;

      if (t === 'move') {
        x = Math.max(0, Math.min(1-w, sr.x+dx));
        y = Math.max(0, Math.min(1-h, sr.y+dy));
      } else {
        if (t.includes('l')) { x = Math.min(sr.x+sr.w-MIN, sr.x+dx); w = Math.max(MIN, sr.w-dx); }
        if (t.includes('r')) { w = Math.max(MIN, sr.w+dx); }
        if (t.includes('t')) { y = Math.min(sr.y+sr.h-MIN, sr.y+dy); h = Math.max(MIN, sr.h-dy); }
        if (t.includes('b')) { h = Math.max(MIN, sr.h+dy); }
        x = Math.max(0, x); y = Math.max(0, y);
        w = Math.min(1-x, w); h = Math.min(1-y, h);
      }

      setOperation('crop', {
        x: Math.round(x * actW), y: Math.round(y * actH),
        w: Math.round(w * actW), h: Math.round(h * actH),
      });
    }
    function onUp() { dragging.current = null; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [actW, actH, setOperation]);

  const pct = v => `${(v*100).toFixed(3)}%`;

  return (
    <div className="crop-overlay" style={{ width:displayW, height:displayH }}>
      {/* SVG darkened mask — no box-shadow bleeding */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}>
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            <rect x={pct(rf.x)} y={pct(rf.y)} width={pct(rf.w)} height={pct(rf.h)} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.52)" mask={`url(#${maskId})`} />
      </svg>

      {/* Interactive crop region */}
      <div className="crop-region" style={{ left:pct(rf.x), top:pct(rf.y), width:pct(rf.w), height:pct(rf.h) }}
        onMouseDown={e => startDrag(e,'move')}>
        <div className="crop-h tl" onMouseDown={e => startDrag(e,'tl')} />
        <div className="crop-h tr" onMouseDown={e => startDrag(e,'tr')} />
        <div className="crop-h bl" onMouseDown={e => startDrag(e,'bl')} />
        <div className="crop-h br" onMouseDown={e => startDrag(e,'br')} />
        <div className="crop-h tc" onMouseDown={e => startDrag(e,'t')}  />
        <div className="crop-h bc" onMouseDown={e => startDrag(e,'b')}  />
        <div className="crop-h lc" onMouseDown={e => startDrag(e,'l')}  />
        <div className="crop-h rc" onMouseDown={e => startDrag(e,'r')}  />
      </div>
    </div>
  );
}