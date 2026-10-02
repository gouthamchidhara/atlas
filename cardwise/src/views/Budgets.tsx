import { AlertTriangle, CheckCircle2, OctagonAlert } from 'lucide-react'
import { CategoryIcon } from '../components/CategoryIcon'
import { SPEND_CATEGORIES } from '../domain/categories'
import { money, monthKey, monthLabel, todayISO } from '../lib/format'
import { inMonth, spendByCategory } from '../lib/stats'
import { useStore } from '../store/store'

export function Budgets() {
  const { state, dispatch } = useStore()
  const s = state.settings
  const cur = monthKey(todayISO())
  const spent = spendByCategory(inMonth(state.transactions, cur))
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const pace = now.getDate() / daysInMonth

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Budgets</h1>
          <p>
            {monthLabel(cur, s.locale, 'long')} · {Math.round(pace * 100)}% of the month gone
          </p>
        </div>
      </div>
      <div className="budget-grid">
        {SPEND_CATEGORIES.map((c) => {
          const used = spent.get(c.id) ?? 0
          const limit = state.budgets[c.id]
          const pct = limit ? used / limit : 0
          const level = !limit ? null : pct > 1 ? 'bad' : pct > pace + 0.1 ? 'warn' : 'good'
          const StatusIcon = level === 'bad' ? OctagonAlert : level === 'warn' ? AlertTriangle : CheckCircle2
          return (
            <div className="panel budget" key={c.id}>
              <div className="budget-top">
                <CategoryIcon id={c.id} />
                <div className="grow">
                  <b>{c.label}</b>
                </div>
                {level && (
                  <span className={`status ${level}`}>
                    <StatusIcon size={12} />
                    {level === 'bad' ? 'Over' : level === 'warn' ? 'Ahead of pace' : 'On track'}
                  </span>
                )}
              </div>
              <div className="budget-amount">
                <span className="big num">{money(used, s)}</span>
                <span className="faint num">{limit ? `of ${money(limit, s)}` : 'no budget'}</span>
              </div>
              {limit ? (
                <div className={`meter ${level === 'good' ? '' : level}`}>
                  <i style={{ width: `${Math.min(100, pct * 100)}%` }} />
                </div>
              ) : null}
              <label className="field">
                <span>Monthly limit</span>
                <input
                  className="input num"
                  type="number"
                  min={0}
                  step={10}
                  placeholder="Set a limit"
                  key={limit ?? "none"}
                  defaultValue={limit ?? ''}
                  onBlur={(e) => dispatch({ type: 'budget/set', category: c.id, amount: e.target.value ? Number(e.target.value) : null })}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
              </label>
            </div>
          )
        })}
      </div>
    </>
  )
}
