import { useEffect, useRef, useState } from 'react';

export default function WaveformDisplay({ file, currentTime, duration, trimStart, trimEnd }) {
  const canvasRef   = useRef();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!file || !canvasRef.current) return;
    setReady(false);
    const canvas = canvasRef.current;
    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext('2d');

    const ac = new (window.AudioContext || window.webkitAudioContext)();

    file.arrayBuffer()
      .then(buf => ac.decodeAudioData(buf))
      .then(audioBuffer => {
        const data = audioBuffer.getChannelData(0);
        const step = Math.max(1, Math.ceil(data.length / W));

        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(0, 0, W, H);

        // Waveform bars
        for (let i = 0; i < W; i++) {
          let peak = 0;
          const s = i * step;
          for (let j = 0; j < step; j++) peak = Math.max(peak, Math.abs(data[s + j] || 0));
          const bh = Math.max(1, peak * H * 0.88);
          const by = (H - bh) / 2;
          ctx.fillStyle = `rgba(59,130,246,${0.4 + peak * 0.6})`;
          ctx.fillRect(i, by, 1, bh);
        }
        setReady(true);
      })
      .catch(() => {})
      .finally(() => ac.close());
  }, [file]);

  const pctOf = t => duration > 0 ? `${Math.max(0, Math.min(100, (t / duration) * 100))}%` : '0%';

  return (
    <div className="waveform-wrap">
      <canvas ref={canvasRef} width={1200} height={72}
        style={{ width:'100%', height:72, display:'block', borderRadius:4 }} />
      {ready && duration > 0 && (
        <>
          {/* Trim region highlight */}
          {trimStart !== undefined && trimEnd !== undefined && (
            <div className="waveform-trim" style={{
              left: pctOf(trimStart),
              width: `calc(${pctOf(trimEnd)} - ${pctOf(trimStart)})`,
            }} />
          )}
          {/* Playhead */}
          <div className="waveform-ph" style={{ left: pctOf(currentTime) }} />
        </>
      )}
    </div>
  );
}