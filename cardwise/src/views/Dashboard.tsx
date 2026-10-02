import { Plus, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { CardVisual } from '../components/CardVisual'
import { CategoryBreakdown } from '../components/CategoryBreakdown'
import { CategoryIcon } from '../components/CategoryIcon'
import { MonthlyBars } from '../components/MonthlyBars'
import { TransactionList } from '../components/TransactionList'
import type { Card, CategoryId } from '../domain/types'
import { money, monthKey, monthLabel, todayISO } from '../lib/format'
import { inMonth, lastMonths, spendByMonth, topMerchants, totalSpend } from '../lib/stats'
import { useStore } from '../store/store'

interface Props {
  onAddCard: () => void
  onEditCard: (c: Card) => void
  onAddTx: () => void
  onOpenCategory: (c: CategoryId) => void
  onSeeAll: () => void
  onLoadDemo: () => void
}

export function Dashboard({ onAddCard, onEditCard, onAddTx, onOpenCategory, onSeeAll, onLoadDemo }: Props) {
  const { state } = useStore()
  const s = state.settings
  const cur = monthKey(todayISO())
  const months = lastMonths(cur, 6)
  const thisMonth = inMonth(state.transactions, cur)
  const spent = totalSpend(thisMonth)
  const dayOfMonth = new Date().getDate()
  // compare against the same stretch of last month, not the whole of it
  const prev = totalSpend(inMonth(state.transactions, months[months.length - 2]).filter((t) => Number(t.date.slice(8)) <= dayOfMonth))
  const delta = prev ? ((spent - prev) / prev) * 100 : 0
  const purchases = thisMonth.filter((t) => t.amount > 0 && t.category !== 'income').length
  const budgetTotal = Object.values(state.budgets).reduce((a, b) => a + (b ?? 0), 0)

  if (!state.cards.length) {
    return (
      <div className="panel" style={{ maxWidth: 560, margin: '8vh auto', textAlign: 'center', padding: 36 }}>
        <div className="brand-mark" style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 18px' }}>
          <Sparkles size={26} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Welcome to Cardwise</h1>
        <p className="muted" style={{ margin: '8px 0 24px' }}>
          Add your credit and debit cards, log or import purchases, and watch them sort themselves into categories.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={onAddCard}>
            <Plus size={16} /> Add your first card
          </button>
          <button className="btn" onClick={onLoadDemo}>
            Explore with demo data
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p>{monthLabel(cur, s.locale, 'long')}</p>
        </div>
        <button className="btn btn-primary" onClick={onAddTx}>
          <Plus size={16} /> Add transaction
        </button>
      </div>

      <div className="grid grid-dash">
        <section className="panel span-7">
          <div className="hero">
            <span className="hero-label">Spent this month</span>
            <span className="hero-value num">{money(spent, s)}</span>
            {prev > 0 && (
              <span className={`status ${delta > 0 ? 'warn' : 'good'}`} style={{ alignSelf: 'flex-start' }}>
                {delta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {Math.abs(delta).toFixed(0)}% {delta > 0 ? 'more' : 'less'} than this point in {monthLabel(months[months.length - 2], s.locale, 'long')}
              </span>
            )}
          </div>
          <div className="stat-row">
            <div className="stat">
              <div className="k">Daily avg</div>
              <div className="v num">{money(spent / dayOfMonth, s)}</div>
            </div>
            <div className="stat">
              <div className="k">Purchases</div>
              <div className="v num">{purchases}</div>
            </div>
            <div className="stat">
              <div className="k">Budget left</div>
              <div className="v num" style={budgetTotal && spent > budgetTotal ? { color: 'var(--bad)' } : undefined}>
                {budgetTotal ? money(budgetTotal - spent, s, { compact: true }) : '—'}
              </div>
            </div>
          </div>
        </section>

        <section className="panel span-5">
          <div className="panel-head">
            <h2>Last 6 months</h2>
            <span className="sub">Total spend</span>
          </div>
          <MonthlyBars data={spendByMonth(state.transactions, months)} height={190} />
        </section>

        <section className="span-12">
          <div className="cards-strip">
            {state.cards.map((c) => (
              <CardVisual key={c.id} card={c} onClick={() => onEditCard(c)} />
            ))}
            <button className="add-card" onClick={onAddCard}>
              <Plus size={22} />
              Add card
            </button>
          </div>
        </section>

        <section className="panel span-5">
          <div className="panel-head">
            <h2>Where it went</h2>
            <span className="sub">This month · tap to filter</span>
          </div>
          <CategoryBreakdown txs={thisMonth} onPick={onOpenCategory} />
        </section>

        <section className="panel span-7">
          <div className="panel-head">
            <h2>Recent activity</h2>
            <button className="btn btn-ghost" onClick={onSeeAll}>
              See all
            </button>
          </div>
          <TransactionList txs={state.transactions} limit={8} />
        </section>

        <section className="panel span-12">
          <div className="panel-head">
            <h2>Top merchants</h2>
            <span className="sub">This month</span>
          </div>
          {topMerchants(thisMonth, 5).length ? (
            <div className="cat-list">
              {topMerchants(thisMonth, 5).map((m) => (
                <div className="cat-item" key={m.merchant} style={{ cursor: 'default' }}>
                  <CategoryIcon id={m.category} />
                  <div>
                    <div className="name" style={{ marginBottom: 0 }}>
                      <span>{m.merchant}</span>
                    </div>
                    <div className="faint" style={{ fontSize: 12 }}>
                      {m.count} {m.count === 1 ? 'visit' : 'visits'}
                    </div>
                  </div>
                  <div className="amt num">{money(m.total, s)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Nothing yet this month.</div>
          )}
        </section>
      </div>
    </>
  )
}
