import { useMemo, useState } from 'react';
import useStore from '../store/useStore.js';
import { buildCommand }       from '../utils/buildCommand.js';
import { buildMagickCommand } from '../utils/buildMagickCommand.js';

export default function CommandBar() {
  const { media, mediaType, operations, output } = useStore();
  const [copied,     setCopied]     = useState(false);
  const [showScript, setShowScript] = useState(false);

  const isImage    = mediaType === 'image';
  const isDatamosh = !!operations.datamosh?.enabled;

  const result = useMemo(() => {
    if (isImage) return buildMagickCommand(media, operations);
    return buildCommand(media, operations);
  }, [media, operations, isImage]);

  const { command, isScript } = result;

  function copy(text) {
    navigator.clipboard.writeText(text || command).then(() => {
      setCopied(true); setTimeout(()=>setCopied(false), 1800);
    });
  }

  const html = useMemo(() => highlightCmd(command, media?.name, isImage, isScript), [command, media, isImage, isScript]);

  return (
    <>
      <div className="cmd-bar">
        <span className="cmd-prompt">{isImage ? '⬡' : '$'}</span>

        {isScript ? (
          <div className="cmd-script" onClick={()=>setShowScript(true)}
            title="Click to view full datamosh script">
            {/* Show first line only */}
            {command.split('\n').find(l => l && !l.startsWith('#') && l.trim()) || command.slice(0,120)}
          </div>
        ) : (
          <div className="cmd-text" title={command||''}
            dangerouslySetInnerHTML={{ __html: html ||
              '<span style="color:var(--dim)">Load a file and enable operations…</span>' }} />
        )}

        {command && (
          <button className={`cbtn ${!isImage&&!isScript ? 'run' : ''}`}
            onClick={() => isScript ? setShowScript(true) : copy()}>
            {isScript ? '📋 View script' : copied ? '✓ Copied!' : isImage ? '📋 Copy' : '📋 Copy & run locally'}
          </button>
        )}
        {output && (
          <a className="cbtn dl" href={output.url} download={output.name}
            target={output.isBlob?undefined:'_blank'} rel="noreferrer">
            ↓ Download
          </a>
        )}
      </div>

      {/* Datamosh script modal */}
      {showScript && isScript && (
        <div className="cmd-script-full" onClick={()=>setShowScript(false)}>
          <div className="cmd-script-box" onClick={e=>e.stopPropagation()}>
            <div className="cmd-script-hdr">
              <span className="cmd-script-hdr-title">🎞 Datamosh Script — copy & run in your terminal</span>
              <button className="op-reset" onClick={()=>setShowScript(false)}>✕</button>
            </div>
            <pre className="cmd-script-body"
              dangerouslySetInnerHTML={{ __html: highlightBash(command) }} />
            <div className="cmd-script-footer">
              <button className="cbtn run" onClick={()=>copy(command)}>
                {copied ? '✓ Copied!' : 'Copy script'}
              </button>
              <button className="cbtn" onClick={()=>setShowScript(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function highlightCmd(cmd, inputName, isImage, isScript) {
  if (!cmd||isScript) return '';
  const safe  = cmd.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inRe  = inputName ? new RegExp(inputName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g') : null;

  if (isImage) {
    // Local processing description
    return safe
      .replace(/^(Processing locally:)/, '<span class="tc">$1</span>')
      .replace(/→/g, '<span class="tf">→</span>')
      .replace(/output\.\w+/g, m => `<span class="tout">${m}</span>`)
      .replace(inRe||/(?!x)x/, m => `<span class="tin">${m}</span>`);
  }

  const word = 'ffmpeg';
  return safe
    .replace(new RegExp(`^(${word})`),'<span class="tc">$1</span>')
    .replace(/((?:^|\s)-[a-zA-Z_:][a-zA-Z0-9_:]*)/g,m=>`<span class="tf">${m}</span>`)
    .replace(/output\.\w+/g, m=>`<span class="tout">${m}</span>`)
    .replace(inRe||/(?!x)x/, m=>`<span class="tin">${m}</span>`)
    .replace(/"([^"]+)"/g,(_,i)=>`"<span class="tfl">${i}</span>"`);
}

function highlightBash(script) {
  return script
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .split('\n')
    .map(line => {
      if (line.startsWith('#')) return `<span class="sh-comment">${line}</span>`;
      return line
        .replace(/^(ffmpeg|ffprobe|cat|ls|mkdir|mv|cp|cd|echo)\b/,'<span class="sh-cmd">$1</span>')
        .replace(/((?:^|\s)-[a-zA-Z_:][a-zA-Z0-9_:]*)/g,m=>`<span class="sh-flag">${m}</span>`)
        .replace(/"([^"]*)"/g,(_,i)=>`"<span class="sh-str">${i}</span>"`);
    })
    .join('\n');
}