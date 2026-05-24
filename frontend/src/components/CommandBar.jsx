import { useMemo, useState } from 'react';
import useStore from '../store/useStore.js';
import { buildCommand }       from '../utils/buildCommand.js';
import { buildMagickCommand } from '../utils/buildMagickCommand.js';

export default function CommandBar() {
  const { media, mediaType, operations, output, isProcessing } = useStore();
  const [copied, setCopied] = useState(false);

  const isImage = mediaType === 'image';
  const isVideo = mediaType === 'video';

  const { command, outputExt } = useMemo(() => {
    if (isImage) return buildMagickCommand(media, operations);
    return buildCommand(media, operations);
  }, [media, operations, isImage]);

  function copy() {
    if (!command) return;
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const html = useMemo(() => highlightCmd(command, media?.name, isImage), [command, media, isImage]);

  return (
    <div className="cmd-bar">
      <span className="cmd-prompt">{isImage ? 'convert' : '$'}</span>
      <div className="cmd-text"
        title={command || ''}
        dangerouslySetInnerHTML={{ __html: html ||
          '<span style="color:var(--dim)">Load a file and enable operations…</span>' }}
      />

      {command && (
        <button className={`cbtn ${isVideo ? 'run' : ''}`} onClick={copy}
          title={isVideo ? 'Copy this command and run it in your terminal' : 'Copy to clipboard'}>
          {copied ? '✓ Copied!' : isVideo ? '📋 Copy & run locally' : 'Copy'}
        </button>
      )}

      {output && (
        <a className="cbtn dl" href={output.url} download={output.name}
          target={output.isBlob ? undefined : '_blank'} rel="noreferrer">
          ↓ Download output
        </a>
      )}
    </div>
  );
}

function highlightCmd(cmd, inputName, isImage) {
  if (!cmd) return '';
  const safe = cmd.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const outRe = /output\.\w+/g;
  const inRe  = inputName
    ? new RegExp(inputName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'g')
    : null;
  const cmdWord = isImage ? 'convert' : 'ffmpeg';
  return safe
    .replace(new RegExp(`^(${cmdWord})`), '<span class="tc">$1</span>')
    .replace(/((?:^|\s)-[a-zA-Z_:][a-zA-Z0-9_:]*)/g, m => `<span class="tf">${m}</span>`)
    .replace(outRe, m => `<span class="tout">${m}</span>`)
    .replace(inRe  ? inRe : /(?!x)x/, m => `<span class="tin">${m}</span>`)
    .replace(/"([^"]+)"/g, (_m, inner) => `"<span class="tfl">${inner}</span>"`);
}