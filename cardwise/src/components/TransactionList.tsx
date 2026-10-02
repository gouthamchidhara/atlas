import { Pencil, Receipt, Trash2 } from 'lucide-react'
import { CATEGORIES } from '../domain/categories'
import type { CategoryId, Transaction } from '../domain/types'
import { dayLabel, money } from '../lib/format'
import { useStore } from '../store/store'
import { CategoryIcon } from './CategoryIcon'

export function TransactionList({
  txs,
  onEdit,
  grouped = true,
  limit,
}: {
  txs: Transaction[]
  onEdit?: (t: Transaction) => void
  grouped?: boolean
  limit?: number
}) {
  const { state, dispatch } = useStore()
  const s = state.settings
  const cards = new Map(state.cards.map((c) => [c.id, c]))
  const list = limit ? txs.slice(0, limit) : txs

  if (!list.length)
    return (
      <div className="empty">
        <Receipt size={28} />
        <div>No transactions found.</div>
      </div>
    )

  const groups: [string, Transaction[]][] = []
  for (const t of list) {
    const last = groups[groups.length - 1]
    if (grouped && last && last[0] === t.date) last[1].push(t)
    else if (grouped) groups.push([t.date, [t]])
    else if (last) last[1].push(t)
    else groups.push(['', [t]])
  }

  return (
    <div>
      {groups.map(([day, items]) => (
        <div className="tx-group" key={day || 'all'}>
          {grouped && (
            <div className="tx-day">
              <span>{dayLabel(day, s.locale)}</span>
              <span className="num">{money(items.reduce((a, t) => a + (t.amount > 0 ? t.amount : 0), 0), s)}</span>
            </div>
          )}
          {items.map((t) => {
            const card = cards.get(t.cardId)
            return (
              <div className="tx" key={t.id}>
                <CategoryIcon id={t.category} size={18} />
                <div className="tx-main">
                  <div className="tx-merchant">{t.merchant}</div>
                  <div className="tx-meta">
                    <select
                      className="tx-cat-select"
                      value={t.category}
                      aria-label={`Category for ${t.merchant}`}
                      onChange={(e) => dispatch({ type: 'tx/recategorize', id: t.id, category: e.target.value as CategoryId })}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    {card && <span>· {card.nickname} ••{card.last4}</span>}
                    {!grouped && <span>· {dayLabel(t.date, s.locale)}</span>}
                    {t.note && <span>· {t.note}</span>}
                  </div>
                </div>
                <div className={`tx-amt num${t.amount < 0 ? ' credit' : ''}`}>
                  {t.amount < 0 ? '+' : '−'}
                  {money(Math.abs(t.amount), s)}
                </div>
                {onEdit && (
                  <div className="tx-actions">
                    <button className="btn btn-ghost btn-icon" aria-label="Edit" onClick={() => onEdit(t)}>
                      <Pencil size={15} />
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-danger"
                      aria-label="Delete"
                      onClick={() => confirm(`Delete "${t.merchant}"?`) && dispatch({ type: 'tx/delete', id: t.id })}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
