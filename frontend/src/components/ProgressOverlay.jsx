import useStore from '../store/useStore.js';

export default function ProgressOverlay() {
  const { progress } = useStore();
  return (
    <div className="prog-ov">
      <div className="prog-card">
        <div className="prog-title">🔒 Rendering in browser…</div>
        <div className="prog-sub">Your file never leaves your device.</div>
        <div className="prog-bg">
          <div className="prog-fill" style={{ width:`${Math.max(3, progress)}%` }} />
        </div>
        <div className="prog-pct">{progress}%</div>
      </div>
    </div>
  );
}
