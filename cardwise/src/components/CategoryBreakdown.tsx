import { useState } from 'react'
import { category, SPEND_CATEGORIES } from '../domain/categories'
import type { CategoryId, Transaction } from '../domain/types'
import { money } from '../lib/format'
import { spendByCategory } from '../lib/stats'
import { useStore } from '../store/store'
import { CategoryIcon } from './CategoryIcon'

/** Share bar + ranked list. Colour carries identity; icon + label repeat it. */
export function CategoryBreakdown({ txs, onPick }: { txs: Transaction[]; onPick?: (c: CategoryId) => void }) {
  const { state } = useStore()
  const [hover, setHover] = useState<CategoryId | null>(null)
  const map = spendByCategory(txs)
  const total = [...map.values()].reduce((a, b) => a + b, 0)
  // keep fixed slot order in the share bar so colours never shuffle by rank
  const slots = SPEND_CATEGORIES.filter((c) => (map.get(c.id) ?? 0) > 0)
  const ranked = [...slots].sort((a, b) => map.get(b.id)! - map.get(a.id)!)
  const top = ranked[0] ? map.get(ranked[0].id)! : 1

  if (!total) return <div className="empty">No spending in this period yet.</div>

  return (
    <div>
      <div className={`share-bar${hover ? ' hovering' : ''}`} role="img" aria-label="Share of spend by category">
        {slots.map((c) => (
          <i
            key={c.id}
            className={hover === c.id ? 'active' : ''}
            style={{ width: `${(map.get(c.id)! / total) * 100}%`, background: c.color }}
            title={`${c.label}: ${money(map.get(c.id)!, state.settings)}`}
            onMouseEnter={() => setHover(c.id)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </div>
      <div className="cat-list">
        {ranked.map((c) => {
          const v = map.get(c.id)!
          return (
            <button
              key={c.id}
              type="button"
              className={`cat-item${hover === c.id ? ' active' : ''}`}
              onMouseEnter={() => setHover(c.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick?.(c.id)}
            >
              <CategoryIcon id={c.id} />
              <div>
                <div className="name">
                  <span>{category(c.id).label}</span>
                  <span className="faint num">{Math.round((v / total) * 100)}%</span>
                </div>
                <div className="track">
                  <i style={{ width: `${(v / top) * 100}%`, background: c.color }} />
                </div>
              </div>
              <div className="amt num">{money(v, state.settings)}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
