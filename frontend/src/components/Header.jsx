import { useRef, useState } from 'react';
import useStore from '../store/useStore.js';

const PRESETS = [
  { label:'Compress video for web',    ops:{ videoCodec:{enabled:true,params:{codec:'libx264',crf:28,preset:'fast'}}, pixfmt:{enabled:true,params:{format:'yuv420p'}}, container:{enabled:true,params:{format:'mp4'}} }},
  { label:'Extract audio as MP3',      ops:{ extractAudio:{enabled:true,params:{format:'mp3'}}, audioCodec:{enabled:true,params:{codec:'libmp3lame',bitrate:'192k'}} }},
  { label:'Podcast master',            ops:{ normalize:{enabled:true,params:{I:-16,LRA:11,TP:-1.5}}, compressor:{enabled:true,params:{threshold:-20,ratio:3,attack:5,release:50}} }},
  { label:'Loudness (broadcast -23)',  ops:{ normalize:{enabled:true,params:{I:-23,LRA:7,TP:-2}} }},
  { label:'GIF from video (480px)',    ops:{ gifExport:{enabled:true,params:{fps:15,width:480}} }},
  { label:'Remove audio track',        ops:{ removeAudio:{enabled:true,params:{}} }},
  { label:'Speed 2×',                  ops:{ speed:{enabled:true,params:{factor:2}} }},
  { label:'Grayscale',                 ops:{ grayscale:{enabled:true,params:{}} }},
  { label:'Old film look',             ops:{ oldFilm:{enabled:true,params:{grain:12,saturation:0.35}}, vignette:{enabled:true,params:{angle:1.2}} }},
  { label:'VHS effect',                ops:{ vhsEffect:{enabled:true,params:{intensity:1.2}}, scanlines:{enabled:true,params:{darkness:0.35}} }},
  { label:'FLAC lossless encode',      ops:{ audioCodec:{enabled:true,params:{codec:'flac',flacLevel:8}}, container:{enabled:true,params:{format:'flac'}} }},
  { label:'Optimize image for web',    ops:{ scale:{enabled:true,params:{width:1920,height:1080,keepAspect:true}}, imgFormat:{enabled:true,params:{format:'webp'}}, imgQuality:{enabled:true,params:{quality:85}}, im_strip:{enabled:true,params:{}} }},
];

export default function Header() {
  const { media, loadMedia } = useStore();
  const fileRef   = useRef();
  const [showPre, setShowPre] = useState(false);

  function applyPreset(preset) {
    // Single atomic update — no race condition
    useStore.setState(s => ({
      operations: { ...s.operations, ...preset.ops },
    }));
    setShowPre(false);
  }

  return (
    <header className="hdr">
      <div className="hdr-logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
        </svg>
        fg · FFmpeg GUI
      </div>

      <div className="hdr-file" onClick={()=>fileRef.current.click()}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span className="hdr-fname">{media?.name || 'Open file…'}</span>
        {media && <span className="hdr-info">{media.type} · {(media.file.size/1024/1024).toFixed(1)} MB</span>}
      </div>
      <input ref={fileRef} type="file" accept="video/*,audio/*,image/*"
        style={{display:'none'}} onChange={e=>e.target.files[0]&&loadMedia(e.target.files[0])} />

      <div style={{position:'relative'}}>
        <button className="hdr-preset-btn" onClick={()=>setShowPre(p=>!p)}>⚡ Presets</button>
        {showPre && (
          <>
            <div className="preset-backdrop" onClick={()=>setShowPre(false)} />
            <div className="preset-menu">
              <div className="preset-title">Quick Presets</div>
              {PRESETS.map(p => (
                <button key={p.label} className="preset-item" onClick={()=>applyPreset(p)}>
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="hsp" />
      <span className="hdr-privacy">All processes are done locally</span>
      <a href="https://tools.mwlmedia.org" target="_blank" rel="noreferrer" className="hdr-tools">
        tools.mwlmedia.org ↗
      </a>
    </header>
  );
}