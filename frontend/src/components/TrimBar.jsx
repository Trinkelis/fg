import { useRef, useEffect } from 'react';
import useStore from '../store/useStore.js';

export default function TrimBar({ mediaRef }) {
  const { operations, setOperation, currentTime, duration, setCurrentTime } = useStore();
  const barRef   = useRef();
  const dragging = useRef(null);

  const params = operations.trim?.params || {};
  const start  = params.start ?? 0;
  const end    = params.end   ?? duration;
  const pct    = t => (duration > 0 ? `${Math.max(0,Math.min(100,(t/duration)*100))}%` : '0%');

  function getT(e) {
    const rect = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((e.clientX-rect.left)/rect.width) * duration));
  }

  function onBarDown(e) {
    const t = getT(e);
    dragging.current = 'head';
    setCurrentTime(t);
    if (mediaRef?.current) mediaRef.current.currentTime = t;
  }

  useEffect(() => {
    function onMove(e) {
      const d = dragging.current;
      if (!d || !barRef.current) return;
      const t = getT(e);
      if      (d === 'head')  { setCurrentTime(t); if (mediaRef?.current) mediaRef.current.currentTime = t; }
      else if (d === 'start') { setOperation('trim', { start:Math.max(0, Math.min(t,(end??duration)-0.1)), end:end??duration }); }
      else if (d === 'end')   { setOperation('trim', { start, end:Math.min(duration, Math.max(t, start+0.1)) }); }
    }
    function onUp() { dragging.current = null; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [start, end, duration, setCurrentTime, setOperation, mediaRef]);

  return (
    <div className="trim-wrap">
      <div className="trim-labels">
        <span>Trim: {fmtS(start)} → {fmtS(end ?? duration)}</span>
        <span>Selection: {fmtS((end ?? duration) - start)}</span>
      </div>
      <div className="trim-track" ref={barRef} onMouseDown={onBarDown}>
        <div className="trim-sel"  style={{ left:pct(start), width:`calc(${pct(end??duration)} - ${pct(start)})` }} />
        <div className="trim-h"    style={{ left:pct(start) }}          onMouseDown={e=>{e.stopPropagation();dragging.current='start';}} title={`Start: ${fmtS(start)}`} />
        <div className="trim-h"    style={{ left:pct(end??duration) }}  onMouseDown={e=>{e.stopPropagation();dragging.current='end';}}   title={`End: ${fmtS(end??duration)}`} />
        <div className="trim-ph"   style={{ left:pct(currentTime) }}    />
      </div>
    </div>
  );
}

function fmtS(s) {
  if (s==null||isNaN(s)) return '0:00.0';
  return `${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,'0')}`;
}