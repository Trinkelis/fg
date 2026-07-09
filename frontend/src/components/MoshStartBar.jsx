import { useEffect, useRef } from 'react';
import useStore from '../store/useStore.js';

/**
 * MoshStartBar — single-handle timeline for picking where a server-side
 * datamosh effect begins. Reused for two operations:
 *
 *   - `datamosh`           → param `moshStart` (single-clip melt)
 *   - `datamoshTransition` → param `transitionAt` (A→melt→B start point
 *                            on clip A)
 *
 * Same UX as TrimBar:
 *   - Click on the track  → scrub only (moves the playhead, the mosh
 *                            start stays put).
 *   - Drag the handle     → set / move the mosh start (or transition
 *                            point) to where the cursor is.
 *
 * The mosh start is a fixed authoring decision — separate from where the
 * user is currently looking — so the playhead and the handle are
 * intentionally independent.
 */
export default function MoshStartBar({ mediaRef }) {
  const { operations, setOperation, currentTime, duration, setCurrentTime } = useStore();
  const barRef   = useRef();
  // 'playhead' = scrub only, 'handle' = move the mosh-start, null = idle
  const dragging = useRef(null);

  // Pick whichever datamosh op is enabled, and the matching param key.
  const datamoshOn = operations.datamosh?.enabled;
  const transOn    = operations.datamoshTransition?.enabled;
  const activeOpId = datamoshOn ? 'datamosh' : (transOn ? 'datamoshTransition' : null);
  const paramKey   = datamoshOn ? 'moshStart' : 'transitionAt';
  const startTime  = (activeOpId && operations[activeOpId]?.params?.[paramKey]) ?? 0;

  // Map a clientX to a time, clamped to [0, duration].
  const getT = (clientX) => {
    const rect = barRef.current.getBoundingClientRect();
    if (duration <= 0) return 0;
    return Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration));
  };

  // Click on the track (but NOT the handle) → start scrubbing.
  // The handle's own onMouseDown calls stopPropagation() before this
  // runs, so the handle stays drag-only.
  function onBarDown(e) {
    if (!activeOpId) return;
    dragging.current = 'playhead';
    const t = getT(e.clientX);
    setCurrentTime(t);
    if (mediaRef?.current) mediaRef.current.currentTime = t;
  }

  // Click on the handle → start moving the mosh start. The mosh start
  // is also clamped so it stays within the video.
  function onHandleDown(e) {
    if (!activeOpId) return;
    e.stopPropagation();
    dragging.current = 'handle';
  }

  useEffect(() => {
    function onMove(e) {
      const d = dragging.current;
      if (!d || !barRef.current || !activeOpId) return;
      const t = getT(e.clientX);
      if (d === 'playhead') {
        setCurrentTime(t);
        if (mediaRef?.current) mediaRef.current.currentTime = t;
      } else if (d === 'handle') {
        setOperation(activeOpId, { [paramKey]: round1(t) });
      }
    }
    function onUp() { dragging.current = null; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [duration, setCurrentTime, setOperation, mediaRef, activeOpId, paramKey]);

  const pct = t => duration > 0 ? `${Math.max(0, Math.min(100, (t / duration) * 100))}%` : '0%';

  if (!activeOpId) return null;

  // Label text adapts to which effect is active.
  const isTrans = activeOpId === 'datamoshTransition';
  const startLabel = isTrans ? 'Transition starts at' : 'Mosh starts at';
  const subLabel   = isTrans
    ? '(clip A plays clean until then, then B melts in)'
    : '(clean playback until then)';

  return (
    <div className="trim-wrap">
      <div className="trim-labels">
        <span>
          <span style={{ color:'var(--accent)', fontWeight:600 }}>●</span>{' '}
          {startLabel} <b style={{color:'var(--fg)'}}>{fmtS(startTime)}</b>
          {' '}<span style={{color:'var(--dim)'}}>{subLabel}</span>
        </span>
        <span>
          <span style={{color:'var(--dim)'}}>Drag the handle · click track to scrub</span>
        </span>
      </div>
      <div className="trim-track" ref={barRef} onMouseDown={onBarDown}
        title={isTrans ? 'Click to scrub · drag the handle to set the transition point' : 'Click to scrub · drag the handle to set the mosh start'}>
        {/* Clean-playback region (start of video → mosh/transition start) */}
        <div className="trim-sel" style={{ left:'0%', width:`calc(${pct(startTime)} - 0%)` }} />
        {/* Draggable handle — its own mousedown handler steals the gesture
            so the track's onBarDown (scrub-only) doesn't fire when grabbing it. */}
        <div className="trim-h" style={{ left:pct(startTime) }}
          onMouseDown={onHandleDown}
          title={`${startLabel} ${fmtS(startTime)} — drag to move`} />
        {/* Live playhead (read-only marker, doesn't intercept clicks) */}
        <div className="trim-ph" style={{ left:pct(currentTime) }} />
      </div>
    </div>
  );
}

function round1(n) { return Math.round(n * 10) / 10; }

function fmtS(s) {
  if (s == null || isNaN(s)) return '0:00.0';
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}
