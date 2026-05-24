import useStore  from '../store/useStore.js';
import Controls  from './Controls.jsx';

export default function OperationCard({ op }) {
  const { operations, toggleOperation, resetOperation, enableOperation, activeOp, setActiveOp, media } = useStore();
  const opState   = operations[op.id];
  const isEnabled = opState?.enabled ?? false;
  const isOpen    = activeOp === op.id;

  function onToggle(e) {
    e.stopPropagation();
    if (!isEnabled) {
      // seed defaults that depend on actual media dimensions
      const defaults = { ...op.defaultParams };
      if (op.id === 'crop' && media?.actualW) {
        defaults.w = media.actualW;
        defaults.h = media.actualH;
      }
      enableOperation(op.id, defaults);
    } else {
      toggleOperation(op.id);
    }
  }

  function onReset(e) {
    e.stopPropagation();
    resetOperation(op.id);
  }

  return (
    <div className={`op-card ${isEnabled ? 'enabled' : ''}`}>
      <div className="op-hdr" onClick={() => setActiveOp(op.id)}>
        <button className={`op-toggle ${isEnabled ? 'on' : ''}`} onClick={onToggle} />
        <span className="op-label">{op.label}</span>
        {op.note && <span className="op-tag warn">!</span>}
        {opState && <button className="op-reset" onClick={onReset} title="Reset">✕</button>}
        <svg className={`op-chev ${isOpen ? 'open' : ''}`} viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {isOpen && (
        <div className="op-body">
          {op.note && <div className="op-note">{op.note}</div>}
          {op.hasTrimBar && (
            <div className="op-hint">Use the trim bar below the preview to set start/end points.</div>
          )}
          {op.hasCropOverlay && (
            <div className="op-hint">Drag the handles in the preview to set the crop region.</div>
          )}
          {op.controls.length > 0 && (
            <Controls opId={op.id} controls={op.controls}
              params={opState?.params || op.defaultParams} />
          )}
          {op.controls.length === 0 && !op.hasTrimBar && !op.hasCropOverlay && !op.note && (
            <div className="op-hint">No settings — just enable/disable.</div>
          )}
        </div>
      )}
    </div>
  );
}
