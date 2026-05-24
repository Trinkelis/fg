import useStore      from '../store/useStore.js';
import { CATEGORIES, OPERATIONS } from '../ops/definitions.js';
import OperationCard from './OperationCard.jsx';

export default function Sidebar() {
  const { activeCategory, setActiveCategory, mediaType, operations } = useStore();

  const ops = OPERATIONS.filter(op => {
    if (op.category !== activeCategory) return false;
    if (!mediaType) return true;
    if (!op.applies || op.applies.length === 0) return true;
    return op.applies.includes(mediaType);
  });

  return (
    <aside className="sidebar">
      <div className="cat-tabs">
        {CATEGORIES.map(cat => {
          const count = OPERATIONS.filter(op =>
            op.category === cat.id && operations[op.id]?.enabled
          ).length;
          return (
            <button key={cat.id}
              className={`cat-tab ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
              {count > 0 && <span className="cat-badge">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="op-list">
        {ops.length === 0
          ? <div className="op-empty">
              {mediaType
                ? 'No operations available for this file type.'
                : 'Load a file to see available operations.'}
            </div>
          : ops.map(op => <OperationCard key={op.id} op={op} />)
        }
      </div>
    </aside>
  );
}
