import { useState, useRef, useEffect } from 'react';
import useStore from '../store/useStore.js';
import { processImageLocal } from '../utils/processImageLocal.js';

const FORMATS = [
  { ext:'png',  label:'PNG',  mime:'image/png' },
  { ext:'jpg',  label:'JPEG', mime:'image/jpeg' },
  { ext:'webp', label:'WebP', mime:'image/webp' },
  { ext:'avif', label:'AVIF', mime:'image/avif' },
  { ext:'bmp',  label:'BMP',  mime:'image/bmp' },
  { ext:'gif',  label:'GIF',  mime:'image/gif' },
  { ext:'tiff', label:'TIFF', mime:'image/tiff' },
];

export default function DownloadDialog({ onClose }) {
  const { media, operations, output, setOutput, setIsProcessing, setProgress } = useStore();
  const [format, setFormat] = useState('png');
  const [customName, setCustomName] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const inputRef = useRef();

  const baseName = (media?.name || 'image').replace(/\.[^.]+$/, '');

  useEffect(() => {
    // Auto-focus the name input
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function handleDownload() {
    if (!media || isRendering) return;

    const name = (customName.trim() || baseName) + '.' + format;

    // If the output is already in the desired format, just trigger download
    if (output && output.name === name) {
      triggerDownload(output.url, name);
      onClose();
      return;
    }

    // Otherwise, re-render with the new format
    setIsRendering(true);
    setIsProcessing(true);
    setProgress(0);

    try {
      // Clone operations and force the imgFormat
      const ops = { ...operations };
      ops.imgFormat = { enabled: true, params: { format } };

      const result = await processImageLocal(media.file, ops, setProgress);

      // Replace the output with the new format
      if (output?.url && output.isBlob) {
        URL.revokeObjectURL(output.url);
      }

      setOutput({ url: result.url, name, isBlob: true });
      triggerDownload(result.url, name);
      onClose();
    } catch (err) {
      alert('Render failed:\n' + err.message);
    } finally {
      setIsProcessing(false);
      setIsRendering(false);
    }
  }

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleDownload();
    if (e.key === 'Escape') onClose();
  }

  return (
    <div className="dl-dialog-backdrop" onClick={onClose}>
      <div className="dl-dialog" onClick={e => e.stopPropagation()}>
        <div className="dl-dialog-hdr">
          <span>⬇ Download Image</span>
          <button className="op-reset" onClick={onClose}>✕</button>
        </div>

        <div className="dl-dialog-body">
          <label className="dl-label">Filename</label>
          <div className="dl-name-row">
            <input
              ref={inputRef}
              className="dl-name-input"
              type="text"
              value={customName || baseName}
              onChange={e => setCustomName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={baseName}
            />
            <span className="dl-ext">.{format}</span>
          </div>

          <label className="dl-label">Format</label>
          <div className="dl-format-grid">
            {FORMATS.map(f => (
              <button
                key={f.ext}
                className={`dl-fmt-btn ${format === f.ext ? 'active' : ''}`}
                onClick={() => setFormat(f.ext)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {format === 'jpg' && (
            <div className="dl-note">JPEG does not support transparency.</div>
          )}
          {format === 'gif' && (
            <div className="dl-note">GIF: 256 colors max, no partial transparency.</div>
          )}
          {format === 'bmp' && (
            <div className="dl-note">BMP: uncompressed, large file size.</div>
          )}
        </div>

        <div className="dl-dialog-footer">
          <button className="cbtn" onClick={onClose}>Cancel</button>
          <button className="cbtn run" onClick={handleDownload} disabled={isRendering}>
            {isRendering ? 'Rendering…' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
