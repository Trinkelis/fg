import { useMemo, useState } from 'react';
import useStore from '../store/useStore.js';
import { buildCommand } from '../utils/buildCommand.js';

export default function CommandBar() {
  const { media, operations, output, isProcessing } = useStore();
  const [copied, setCopied] = useState(false);

  const { command, args, outputExt } = useMemo(
    () => buildCommand(media, operations),
    [media, operations]
  );

  function copy() {
    if (!command) return;
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const html = useMemo(() => highlight(command, media?.name), [command, media]);

  return (
    <div className="cmd-bar">
      <span className="cmd-prompt">$</span>
      <div className="cmd-text"
        title={command || 'Load a file to see the FFmpeg command'}
        dangerouslySetInnerHTML={{ __html: html ||
          '<span style="color:var(--dim)">Load a file and enable operations to build the command…</span>' }}
      />
      {command && (
        <button className="cbtn" onClick={copy}>
          {copied ? '✓ Copied!' : 'Copy command'}
        </button>
      )}
      {output && (
        <a className="cbtn dl" href={output.url} download={output.name}>
          ↓ Download output
        </a>
      )}
    </div>
  );
}

function highlight(cmd, inputName) {
  if (!cmd) return '';
  // Escape HTML first
  const safe = cmd.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const outRe = /output\.\w+/g;
  const inRe  = inputName
    ? new RegExp(inputName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'g')
    : null;

  return safe
    .replace(/^(ffmpeg)/, '<span class="tc">$1</span>')
    .replace(/((?:^|\s)-[a-zA-Z_:][a-zA-Z0-9_:]*)/g, (m, flag) =>
      `<span class="tf">${flag}</span>`)
    .replace(outRe,  m => `<span class="tout">${m}</span>`)
    .replace(inRe ? inRe : /(?!x)x/, m => `<span class="tin">${m}</span>`) // noop if no inputName
    .replace(/"([^"]+)"/g, (_m, inner) =>
      `"<span class="tfl">${inner}</span>"`);
}
