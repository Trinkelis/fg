import useStore from '../store/useStore.js';

export default function Controls({ opId, controls, params }) {
  const { setOperation } = useStore();
  const set = (id, val) => setOperation(opId, { [id]: val });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
      {controls.map(c => {
        const val = params[c.id] ?? (c.type === 'checkbox' ? false : (c.options?.[0]?.value ?? ''));
        return (
          <div key={c.id} className="ctrl">
            {c.type === 'slider' && (
              <>
                <div className="ctrl-row">
                  <span className="ctrl-lbl">{c.label}</span>
                  <span className="ctrl-val">{Number(val).toFixed(c.step < 1 ? 2 : 0)}{c.unit || ''}</span>
                </div>
                <input type="range" className="ctrl-slider"
                  min={c.min} max={c.max} step={c.step} value={val}
                  onChange={e => set(c.id, Number(e.target.value))} />
              </>
            )}
            {c.type === 'number' && (
              <>
                <span className="ctrl-lbl">{c.label}{c.unit ? ` (${c.unit})` : ''}</span>
                <input type="number" className="ctrl-in"
                  min={c.min} max={c.max} step={c.step || 1} value={val}
                  onChange={e => set(c.id, Number(e.target.value))} />
              </>
            )}
            {c.type === 'select' && (
              <>
                <span className="ctrl-lbl">{c.label}</span>
                <select className="ctrl-in" value={val}
                  onChange={e => set(c.id, e.target.value)}>
                  {c.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </>
            )}
            {c.type === 'checkbox' && (
              <label className="ctrl-check">
                <input type="checkbox" checked={!!val}
                  onChange={e => set(c.id, e.target.checked)} />
                {c.label}
              </label>
            )}
            {c.type === 'text' && (
              <>
                <span className="ctrl-lbl">{c.label}</span>
                <input type="text" className="ctrl-in" value={val}
                  onChange={e => set(c.id, e.target.value)} />
              </>
            )}
            {c.type === 'color' && (
              <>
                <span className="ctrl-lbl">{c.label}</span>
                <div className="ctrl-color-row">
                  <input type="color" value={toHex(val)}
                    onChange={e => set(c.id, e.target.value)} />
                  <input type="text" className="ctrl-in" value={val}
                    onChange={e => set(c.id, e.target.value)}
                    placeholder="white / #ff0000 / 0xff0000" />
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function toHex(v = '') {
  if (v.startsWith('#'))  return v;
  if (v.startsWith('0x')) return '#' + v.slice(2).padEnd(6, '0');
  const m = { white:'#ffffff', black:'#000000', red:'#ff0000', green:'#00ff00',
               blue:'#0000ff', yellow:'#ffff00', cyan:'#00ffff', magenta:'#ff00ff' };
  return m[v] || '#ffffff';
}
