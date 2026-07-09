import { useMemo, useState } from 'react';
import useStore from '../store/useStore.js';
import { buildCommand }       from '../utils/buildCommand.js';
import { buildMagickCommand } from '../utils/buildMagickCommand.js';

export default function CommandBar() {
  const { media, mediaType, operations, output } = useStore();
  const setShowDownloadDialog = useStore(s => s.setShowDownloadDialog);
  const [copied, setCopied] = useState(false);

  const isImage       = mediaType === 'image';
  const isDatamosh    = mediaType === 'video' && !!operations.datamosh?.enabled;
  const isMoshTrans   = mediaType === 'video' && !!operations.datamoshTransition?.enabled;
  const isServerSide  = isDatamosh || isMoshTrans;

  // When a server-side effect is on, don't try to build a CLI command — the
  // actual render lives on the server (see Preview.jsx → renderDatamosh /
  // renderDatamoshTransition).
  const result = useMemo(() => {
    if (isImage)        return buildMagickCommand(media, operations);
    if (isServerSide)   return { command: '', outputExt: 'avi', isScript: false };
    return buildCommand(media, operations);
  }, [media, operations, isImage, isServerSide]);

  const { command } = result;

  function copy(text) {
    navigator.clipboard.writeText(text || command).then(() => {
      setCopied(true); setTimeout(()=>setCopied(false), 1800);
    });
  }

  const html = useMemo(
    () => highlightCmd(command, media?.name, isImage),
    [command, media, isImage]
  );

  return (
    <div className="cmd-bar">
      <span className="cmd-prompt">{isImage ? '⬡' : '$'}</span>

      {isServerSide ? (
        <div className="cmd-text" title="">
          <span style={{ color:'var(--dim)' }}>
            {isMoshTrans
              ? <>A→datamosh→B transition — click <b style={{color:'var(--fg)'}}>“Run A→B Datamosh on Server”</b> below to render via FFglitch (ffgac + ffedit).</>
              : <>Native datamosh — click <b style={{color:'var(--fg)'}}>“Run Datamosh on Server”</b> below to render via FFglitch (ffgac + ffedit).</>}
          </span>
        </div>
      ) : (
        <div className="cmd-text" title={command||''}
          dangerouslySetInnerHTML={{ __html: html ||
            '<span style="color:var(--dim)">Load a file and enable operations…</span>' }} />
      )}

      {!isServerSide && command && (
        <button className={`cbtn ${!isImage ? 'run' : ''}`} onClick={() => copy()}>
          {copied ? '✓ Copied!' : isImage ? '📋 Copy' : '📋 Copy & run locally'}
        </button>
      )}
      {output && !isImage && (
        <a className="cbtn dl" href={output.url} download={output.name}
          target={output.isBlob?undefined:'_blank'} rel="noreferrer">
          ↓ Download
        </a>
      )}
      {output && isImage && (
        <button className="cbtn dl" onClick={() => setShowDownloadDialog(true)}>
          ↓ Download
        </button>
      )}
    </div>
  );
}

function highlightCmd(cmd, inputName, isImage) {
  if (!cmd) return '';
  const safe  = cmd.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inRe  = inputName ? new RegExp(inputName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g') : null;

  if (isImage) {
    return safe
      .replace(/^(Processing locally:)/, '<span class="tc">$1</span>')
      .replace(/→/g, '<span class="tf">→</span>')
      .replace(/output\.\w+/g, m => `<span class="tout">${m}</span>`)
      .replace(inRe||/(?!x)x/, m => `<span class="tin">${m}</span>`);
  }

  const word = 'ffmpeg';
  return safe
    .replace(new RegExp(`^(${word})`),'<span class="tc">$1</span>')
    .replace(/((?:^|\s)-[a-zA-Z_:][a-zA-Z0-9_:]*)/g, m=>`<span class="tf">${m}</span>`)
    .replace(/output\.\w+/g, m=>`<span class="tout">${m}</span>`)
    .replace(inRe||/(?!x)x/, m=>`<span class="tin">${m}</span>`)
    .replace(/"([^"]+)"/g, (_,i)=>`"<span class="tfl">${i}</span>"`);
}