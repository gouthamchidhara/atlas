import { BellPlus, CalendarClock, Plus } from 'lucide-react'
import { category } from '../domain/categories'
import { pointsFor } from '../domain/rewards'
import { CardVisual } from '../components/CardVisual'
import type { Card } from '../domain/types'
import { money, monthKey, todayISO } from '../lib/format'
import { cardBalance, inMonth, totalSpend } from '../lib/stats'
import { useStore } from '../store/store'

function nextStatement(day: number) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), day)
  if (d < now) d.setMonth(d.getMonth() + 1)
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000)
}

export function Cards({ onAdd, onEdit, onOpen, onAlert }: { onAdd: () => void; onEdit: (c: Card) => void; onOpen: (c: Card) => void; onAlert: (c: Card) => void }) {
  const { state } = useStore()
  const s = state.settings
  const month = inMonth(state.transactions, monthKey(todayISO()))

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Cards</h1>
          <p>{state.cards.length} cards in your wallet</p>
        </div>
        <button className="btn btn-primary" onClick={onAdd}>
          <Plus size={16} /> Add card
        </button>
      </div>
      <div className="cards-grid">
        {state.cards.map((c) => {
          const spent = totalSpend(month.filter((t) => t.cardId === c.id))
          const balance = Math.max(0, cardBalance(state.transactions, c.id))
          const util = c.creditLimit ? (balance / c.creditLimit) * 100 : 0
          const level = util >= 70 ? 'bad' : util >= 30 ? 'warn' : 'good'
          return (
            <div className="card-tile" key={c.id}>
              <CardVisual card={c} onClick={() => onEdit(c)} />
              <div className="panel" style={{ padding: 16 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div className="hero-label">This month</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }} className="num">
                      {money(spent, s)}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-icon" aria-label={`Add alert for ${c.nickname}`} title="Add alert" onClick={() => onAlert(c)}>
                      <BellPlus size={15} />
                    </button>
                    <button className="btn" onClick={() => onOpen(c)}>
                      Activity
                    </button>
                  </div>
                </div>
                {c.kind === 'credit' && c.creditLimit ? (
                  <div style={{ marginTop: 14 }}>
                    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                      <span className="muted">
                        Balance <b className="num">{money(balance, s)}</b> of {money(c.creditLimit, s, { compact: true })}
                      </span>
                      <span className={`status ${level}`}>{util.toFixed(0)}% used</span>
                    </div>
                    <div className={`meter ${level === 'good' ? '' : level}`}>
                      <i style={{ width: `${Math.min(100, util)}%` }} />
                    </div>
                  </div>
                ) : null}
                {c.rewards && (c.rewards.base > 0 || Object.keys(c.rewards.rates).length > 0) && (
                  <div className="row" style={{ marginTop: 12, gap: 6 }}>
                    {Object.entries(c.rewards.rates)
                      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                      .map(([cat, r]) => (
                        <span key={cat} className="chip">
                          <i className="dot" style={{ background: category(cat as never).color }} />
                          {c.rewards!.unit === 'points' ? `${r}x` : `${r}%`} {category(cat as never).label}
                        </span>
                      ))}
                    <span className="chip">
                      {c.rewards.unit === 'points' ? `${c.rewards.base}x` : `${c.rewards.base}%`} else
                    </span>
                    {c.rewards.unit === 'points' && (
                      <span className="chip">
                        {c.rewards.program ? `${c.rewards.program} · ` : ''}
                        {c.rewards.pointValue ?? 1}¢/pt
                      </span>
                    )}
                  </div>
                )}
                {c.rewards?.unit === 'points' &&
                  (() => {
                    const yr = todayISO().slice(0, 4)
                    const pts = state.transactions.filter((t) => t.cardId === c.id && t.date.startsWith(yr)).reduce((a, t) => a + pointsFor(t, c), 0)
                    return (
                      <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                        <b className="num">{pts.toLocaleString(s.locale)} pts</b> earned this year ≈ {money((pts * (c.rewards!.pointValue ?? 1)) / 100, s)}
                      </div>
                    )
                  })()}
                {(() => {
                  const n = state.alerts.filter((a) => a.cardId === c.id && a.enabled).length
                  return n ? (
                    <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>
                      {n} alert{n === 1 ? '' : 's'} watching this card
                    </div>
                  ) : null
                })()}
                {c.kind === 'credit' && c.statementDay ? (
                  <div className="row faint" style={{ marginTop: 12, fontSize: 12 }}>
                    <CalendarClock size={14} /> Statement closes in {nextStatement(c.statementDay)} days
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
        <button className="add-card" onClick={onAdd}>
          <Plus size={22} />
          Add card
        </button>
      </div>
    </>
  )
}
