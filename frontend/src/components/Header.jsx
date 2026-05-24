import { useRef } from 'react';
import useStore from '../store/useStore.js';

export default function Header() {
  const { media, loadMedia } = useStore();
  const ref = useRef();

  const pick = f => f && loadMedia(f);

  return (
    <header className="hdr">
      <div className="hdr-logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
        </svg>
        fg · FFmpeg GUI
      </div>

      <div className="hdr-file" onClick={() => ref.current.click()}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span className="hdr-fname">{media?.name || 'Open file…'}</span>
        {media && (
          <span className="hdr-info">
            {media.type} · {(media.file.size / 1024 / 1024).toFixed(1)} MB
          </span>
        )}
      </div>

      <input ref={ref} type="file" accept="video/*,audio/*,image/*"
        style={{ display:'none' }} onChange={e => pick(e.target.files[0])} />

      <div className="hsp" />

      <div style={{ fontSize:11, color:'var(--dim)', whiteSpace:'nowrap' }}>
        🔒 All processing runs in your browser
      </div>
    </header>
  );
}
