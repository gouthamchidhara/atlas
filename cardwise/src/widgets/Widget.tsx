import type { HTMLAttributes } from 'react'
import { CalendarClock, GripVertical, Pencil, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { BarChart } from '../components/BarChart'
import { CategoryIcon } from '../components/CategoryIcon'
import { TransactionList } from '../components/TransactionList'
import { category } from '../domain/categories'
import type { AppState, WidgetConfig } from '../domain/types'
import { money, todayISO } from '../lib/format'
import { daysBetween, nextClose, PERIOD_LABEL } from '../lib/period'
import { cardBalance } from '../lib/stats'
import { computeWidget, rangeDays, widgetCard } from '../lib/widgetData'

const SPAN: Record<WidgetConfig['size'], string> = { s: 'span-4', m: 'span-6', l: 'span-12' }

export function scopeLabel(w: WidgetConfig, state: AppState) {
  const parts: string[] = [PERIOD_LABEL[w.period]]
  if (w.cardIds.length) parts.push(w.cardIds.map((id) => state.cards.find((c) => c.id === id)?.nickname ?? '?').join(', '))
  if (w.categories.length) parts.push(w.categories.map((c) => category(c).label).join(', '))
  if (w.merchant) parts.push(`“${w.merchant}”`)
  return parts.join(' · ')
}

export function WidgetBody({ w, state }: { w: WidgetConfig; state: AppState }) {
  const s = state.settings
  const today = todayISO()
  const d = computeWidget(w, state, today)
  const fmt = (v: number) => (w.metric === 'count' ? String(Math.round(v)) : money(v, s))
  const fmtAxis = (v: number) => (w.metric === 'count' ? String(Math.round(v)) : money(v, s, { compact: true }))

  switch (w.viz) {
    case 'stat': {
      const delta = d.prevValue ? ((d.value - d.prevValue) / d.prevValue) * 100 : null
      // rewards going up is good; spend going up is a caution
      const upIsGood = w.metric === 'rewards'
      const good = delta !== null && (delta > 0) === upIsGood
      return (
        <div className="w-stat">
          <div className="w-stat-value num">{fmt(d.value)}</div>
          {delta !== null && Math.abs(delta) >= 1 ? (
            <span className={`status ${good ? 'good' : 'warn'}`}>
              {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(delta).toFixed(0)}% vs previous
            </span>
          ) : (
            <span className="faint" style={{ fontSize: 12 }}>
              {d.prevValue ? 'About the same as previous' : 'No previous period data'}
            </span>
          )}
          <div className="w-spark" aria-hidden>
            {(() => {
              const max = Math.max(1, ...d.series.map((b) => b.value))
              return d.series.map((b) => <i key={b.key} style={{ height: `${Math.max(4, (b.value / max) * 100)}%`, opacity: b.value ? 1 : 0.25 }} />)
            })()}
          </div>
        </div>
      )
    }
    case 'trend':
      return <BarChart ariaLabel={w.title} data={d.series} format={fmt} formatAxis={fmtAxis} height={w.size === 'l' ? 220 : 180} highlightLast />
    case 'breakdown': {
      if (!d.breakdown.length) return <div className="empty">Nothing in this period.</div>
      const total = d.breakdown.reduce((a, b) => a + b.value, 0)
      const top = d.breakdown[0].value || 1
      return (
        <div className="cat-list">
          {d.breakdown.slice(0, w.size === 's' ? 4 : 6).map((g) => (
            <div className="cat-item" key={g.key} style={{ cursor: 'default' }}>
              {g.categoryId ? <CategoryIcon id={g.categoryId} /> : <span className="cat-icon mono">{g.label.slice(0, 1).toUpperCase()}</span>}
              <div>
                <div className="name">
                  <span className="ellipsis">{g.label}</span>
                  <span className="faint num">{total ? Math.round((g.value / total) * 100) : 0}%</span>
                </div>
                <div className="track">
                  <i style={{ width: `${(g.value / top) * 100}%`, background: g.categoryId ? category(g.categoryId).color : 'var(--bar)' }} />
                </div>
              </div>
              <div className="amt num">{fmt(g.value)}</div>
            </div>
          ))}
        </div>
      )
    }
    case 'goal': {
      const target = w.target || 0
      if (!target) return <div className="empty">Set a target in the widget settings.</div>
      const pct = d.value / target
      const elapsed = daysBetween(d.cur.start, today) + 1
      const total = w.period === 'this-month' ? new Date(+today.slice(0, 4), +today.slice(5, 7), 0).getDate() : rangeDays(d.cur)
      const pace = Math.min(1, elapsed / total)
      const level = pct > 1 ? 'bad' : pct > pace + 0.1 ? 'warn' : 'good'
      const left = target - d.value
      return (
        <div className="w-goal">
          <div className="budget-amount">
            <span className="big num">{fmt(d.value)}</span>
            <span className="faint num">of {fmt(target)}</span>
          </div>
          <div className={`meter tall ${level === 'good' ? '' : level}`}>
            <i style={{ width: `${Math.min(100, pct * 100)}%` }} />
            <b className="pace" style={{ left: `${pace * 100}%` }} title="Where you'd be at an even pace" />
          </div>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
            <span className={`status ${level}`}>{level === 'bad' ? 'Over target' : level === 'warn' ? 'Ahead of pace' : 'On track'}</span>
            <span className="muted num">{left >= 0 ? `${fmt(left)} left` : `${fmt(-left)} over`}</span>
          </div>
        </div>
      )
    }
    case 'card': {
      const card = widgetCard(w, state.cards)
      if (!card) return <div className="empty">Pick exactly one card for this widget.</div>
      const bal = Math.max(0, cardBalance(state.transactions, card.id))
      const util = card.creditLimit ? (bal / card.creditLimit) * 100 : null
      const level = util === null ? 'good' : util >= 70 ? 'bad' : util >= 30 ? 'warn' : 'good'
      const close = card.statementDay ? nextClose(today, card.statementDay) : null
      return (
        <div className="w-card">
          <div className={`mini-card pcard ${card.theme}`}>
            <span>{card.issuer}</span>
            <span className="num">•• {card.last4}</span>
          </div>
          <div className="w-stat-value num" style={{ fontSize: 26 }}>
            {money(d.value, s)}
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: -6 }}>
            {card.kind === 'credit' && card.statementDay ? 'charged this cycle' : 'spent ' + PERIOD_LABEL[w.period].toLowerCase()}
          </div>
          {util !== null && (
            <>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
                <span className="muted">Utilization</span>
                <span className={`status ${level}`}>{util.toFixed(0)}%</span>
              </div>
              <div className={`meter ${level === 'good' ? '' : level}`}>
                <i style={{ width: `${Math.min(100, util)}%` }} />
              </div>
            </>
          )}
          {close && (
            <div className="row faint" style={{ fontSize: 12 }}>
              <CalendarClock size={14} /> Closes in {daysBetween(today, close)} days
            </div>
          )}
        </div>
      )
    }
    case 'activity':
      return <TransactionList txs={d.txs} limit={w.size === 'l' ? 10 : 6} />
  }
}

export function Widget({
  w,
  state,
  editing,
  onEdit,
  onDelete,
  dragProps,
}: {
  w: WidgetConfig
  state: AppState
  editing: boolean
  onEdit: () => void
  onDelete: () => void
  dragProps?: HTMLAttributes<HTMLElement>
}) {
  return (
    <section className={`panel widget ${SPAN[w.size]}${editing ? ' editing' : ''}`} {...dragProps}>
      <div className="panel-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="ellipsis">{w.title}</h2>
          <div className="sub ellipsis">{scopeLabel(w, state)}</div>
        </div>
        {editing ? (
          <div className="row" style={{ gap: 2, flexWrap: 'nowrap' }}>
            <span className="drag-handle" title="Drag to reorder">
              <GripVertical size={16} />
            </span>
            <button className="btn btn-ghost btn-icon" aria-label={`Edit ${w.title}`} onClick={onEdit}>
              <Pencil size={15} />
            </button>
            <button className="btn btn-ghost btn-icon btn-danger" aria-label={`Remove ${w.title}`} onClick={onDelete}>
              <Trash2 size={15} />
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost btn-icon widget-edit" aria-label={`Edit ${w.title}`} onClick={onEdit}>
            <Pencil size={14} />
          </button>
        )}
      </div>
      <WidgetBody w={w} state={state} />
    </section>
  )
}
