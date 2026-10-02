import { Download, FileUp, Plus, Search, X } from 'lucide-react'
import { useMemo } from 'react'
import { TransactionList } from '../components/TransactionList'
import { CATEGORIES, category } from '../domain/categories'
import type { CategoryId, Transaction } from '../domain/types'
import { toCSV } from '../lib/csv'
import { money, monthKey, monthLabel } from '../lib/format'
import { totalSpend } from '../lib/stats'
import { useStore } from '../store/store'
import { EMPTY_FILTER, type TxFilter } from './txFilter'


export function Transactions({
  filter,
  setFilter,
  onAdd,
  onEdit,
  onImport,
}: {
  filter: TxFilter
  setFilter: (f: TxFilter) => void
  onAdd: () => void
  onEdit: (t: Transaction) => void
  onImport: () => void
}) {
  const { state } = useStore()
  const s = state.settings
  const months = useMemo(() => [...new Set(state.transactions.map((t) => monthKey(t.date)))].sort().reverse(), [state.transactions])

  const filtered = useMemo(() => {
    const q = filter.q.trim().toLowerCase()
    return state.transactions.filter(
      (t) =>
        (!q || t.merchant.toLowerCase().includes(q) || t.note?.toLowerCase().includes(q)) &&
        (!filter.cardId || t.cardId === filter.cardId) &&
        (!filter.category || t.category === filter.category) &&
        (!filter.month || monthKey(t.date) === filter.month),
    )
  }, [state.transactions, filter])

  const active = filter.cardId || filter.category || filter.month || filter.q

  const exportCSV = () => {
    const cards = new Map(state.cards.map((c) => [c.id, c]))
    const csv = toCSV([
      ['date', 'merchant', 'amount', 'category', 'card', 'note'],
      ...filtered.map((t) => [t.date, t.merchant, t.amount, category(t.category).label, cards.get(t.cardId)?.nickname ?? '', t.note ?? '']),
    ])
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `cardwise-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <p>
            {filtered.length} shown · <span className="num">{money(totalSpend(filtered), s)}</span> spent
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={onImport}>
            <FileUp size={16} /> Import
          </button>
          <button className="btn" onClick={exportCSV} disabled={!filtered.length}>
            <Download size={16} /> Export
          </button>
          <button className="btn btn-primary" onClick={onAdd}>
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="filters">
          <div className="search">
            <Search size={16} />
            <input className="input" placeholder="Search merchants or notes" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
          </div>
          <select className="select" value={filter.cardId} onChange={(e) => setFilter({ ...filter, cardId: e.target.value })} aria-label="Card">
            <option value="">All cards</option>
            {state.cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname} ••{c.last4}
              </option>
            ))}
          </select>
          <select className="select" value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value as CategoryId | '' })} aria-label="Category">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select className="select" value={filter.month} onChange={(e) => setFilter({ ...filter, month: e.target.value })} aria-label="Month">
            <option value="">All time</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m, s.locale, 'long')}
              </option>
            ))}
          </select>
          {active && (
            <button className="btn btn-ghost" onClick={() => setFilter(EMPTY_FILTER)}>
              <X size={14} /> Clear
            </button>
          )}
        </div>
        <TransactionList txs={filtered} onEdit={onEdit} />
      </div>
    </>
  )
}
