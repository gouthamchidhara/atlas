import { CalendarCheck2, CheckCircle2, CircleDollarSign, Clock, OctagonAlert, Settings2, TrendingDown } from 'lucide-react'
import { useState } from 'react'
import type { Card } from '../domain/types'
import { money, todayISO, uid } from '../lib/format'
import { dueAfter, planAll, POST_BUFFER_DAYS, type CardPlan } from '../lib/payments'
import { addDays, daysBetween, nextClose, parseISO } from '../lib/period'
import { useStore } from '../store/store'

const TIMELINE_DAYS = 35

export function Payments({ onEditCard, toast }: { onEditCard: (c: Card) => void; toast: (m: string) => void }) {
  const { state, dispatch } = useStore()
  const s = state.settings
  const today = todayISO()
  const target = s.targetUtilization ?? 10
  const { plans, actions } = planAll(state.cards, state.transactions, today, target)
  const credit = state.cards.filter((c) => c.kind === 'credit')
  const missingSetup = credit.filter((c) => !c.statementDay)
  const fmtDay = (iso: string) => parseISO(iso).toLocaleDateString(s.locale, { weekday: 'short', month: 'short', day: 'numeric' })

  const next30 = actions.filter((a) => a.date <= addDays(today, 30))
  const dueTotal = next30.reduce((a, x) => a + x.amount, 0)
  const totalLimit = plans.reduce((a, p) => a + p.limit, 0)
  const utilNow = totalLimit ? (plans.reduce((a, p) => a + p.balance, 0) / totalLimit) * 100 : 0
  const utilAfter = totalLimit ? plans.reduce((a, p) => a + (p.reportedUtil * p.limit) / 100, 0) / totalLimit * 100 : 0

  const logPayment = (cardId: string, amount: number) => {
    dispatch({
      type: 'tx/upsert',
      tx: { id: uid(), cardId, date: today, merchant: 'Payment - Thank You', amount: -Math.abs(amount), category: 'income', manualCategory: true, note: 'Logged from payment plan' },
    })
    toast(`Logged ${money(amount, s)} payment`)
  }

  if (!credit.length)
    return (
      <>
        <Head target={target} />
        <div className="panel empty">
          <CalendarCheck2 size={28} />
          <div>Add a credit card to plan statement payments.</div>
        </div>
      </>
    )

  return (
    <>
      <Head target={target} />

      <div className="grid grid-dash">
        <section className="panel span-4">
          <div className="hero-label">Due in the next 30 days</div>
          <div className="hero-value num" style={{ fontSize: 36, marginTop: 6 }}>
            {money(dueTotal, s)}
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
            across {next30.length} payment{next30.length === 1 ? '' : 's'}
          </div>
        </section>
        <section className="panel span-4">
          <div className="hero-label">Overall utilization</div>
          <div className="row" style={{ alignItems: 'baseline', gap: 10, marginTop: 6 }}>
            <span className="hero-value num" style={{ fontSize: 36 }}>
              {utilNow.toFixed(0)}%
            </span>
            {utilAfter < utilNow - 0.5 && (
              <span className="status good">
                <TrendingDown size={12} /> {utilAfter.toFixed(0)}% reported with plan
              </span>
            )}
          </div>
          <div className={`meter ${utilNow >= 30 ? 'warn' : ''}`} style={{ marginTop: 10, position: 'relative', overflow: 'visible' }}>
            <i style={{ width: `${Math.min(100, utilNow)}%` }} />
            <b className="pace" style={{ left: `${target}%` }} title={`Target ${target}%`} />
          </div>
        </section>
        <section className="panel span-4">
          <div className="hero-label">Next step</div>
          {actions[0] ? (
            (() => {
              const a = actions[0]
              const c = state.cards.find((x) => x.id === a.cardId)!
              return (
                <>
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    <span className={`card-dot pcard ${c.theme}`} />
                    <b>{c.nickname}</b>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }} className="num">
                    Pay {money(a.amount, s)}
                  </div>
                  <div className={a.overdue ? 'status bad' : 'faint'} style={{ fontSize: 12 }}>
                    {a.overdue ? 'Overdue — ' : 'by '}
                    {fmtDay(a.date)} · {a.kind === 'statement' ? 'statement balance' : `to report ≤${target}%`}
                  </div>
                </>
              )
            })()
          ) : (
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              <CheckCircle2 size={18} color="var(--good)" /> Nothing to pay right now.
            </div>
          )}
        </section>

        <section className="panel span-12">
          <div className="panel-head">
            <h2>Next {TIMELINE_DAYS} days</h2>
            <div className="legend">
              <span>
                <i className="mk close" /> Statement closes
              </span>
              <span>
                <i className="mk due" /> Payment due
              </span>
              <span>
                <i className="mk pay" /> Pay by (utilization)
              </span>
            </div>
          </div>
          <Timeline plans={plans} today={today} />
        </section>

        {missingSetup.length > 0 && (
          <section className="panel span-12 banner" style={{ margin: 0 }}>
            <Settings2 size={18} />
            <div style={{ flex: 1 }}>
              <b>{missingSetup.map((c) => c.nickname).join(', ')}</b> need{missingSetup.length === 1 ? 's' : ''} a statement day before it can be planned.
            </div>
            <button className="btn" onClick={() => onEditCard(missingSetup[0])}>
              Set up
            </button>
          </section>
        )}

        {plans.map((p) => (
          <PlanCard key={p.card.id} p={p} target={target} fmtDay={fmtDay} onLog={logPayment} onEdit={() => onEditCard(p.card)} />
        ))}
      </div>
    </>
  )
}

function Head({ target }: { target: number }) {
  const { dispatch } = useStore()
  return (
    <div className="page-head">
      <div>
        <h1>Payments</h1>
        <p>Avoid interest, and pay down before the statement closes so a low balance gets reported.</p>
      </div>
      <div className="field" style={{ minWidth: 0 }}>
        <span>Target utilization</span>
        <div className="segmented" role="group" aria-label="Target utilization">
          {[1, 5, 10, 30].map((t) => (
            <button key={t} aria-pressed={target === t} onClick={() => dispatch({ type: 'settings/set', settings: { targetUtilization: t } })}>
              ≤{t}%
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Timeline({ plans, today }: { plans: CardPlan[]; today: string }) {
  const { state } = useStore()
  const days = Array.from({ length: TIMELINE_DAYS }, (_, i) => addDays(today, i))
  const pos = (iso: string) => daysBetween(today, iso)
  return (
    <div className="timeline" style={{ ['--n' as string]: TIMELINE_DAYS }}>
      <div className="tl-row tl-head">
        <span />
        <div className="tl-track">
          {days.map((d, i) => {
            const dt = parseISO(d)
            const show = i === 0 || dt.getDate() === 1 || i % 7 === 0
            return (
              <span key={d} className={`tl-day${dt.getDay() === 0 || dt.getDay() === 6 ? ' wk' : ''}`}>
                {show ? (i === 0 ? 'Today' : dt.toLocaleDateString(state.settings.locale, { month: 'short', day: 'numeric' })) : ''}
              </span>
            )
          })}
        </div>
      </div>
      {plans.map((p) => {
        const marks: { at: number; kind: 'close' | 'due' | 'pay'; label: string }[] = []
        const inView = (iso: string) => pos(iso) >= 0 && pos(iso) < TIMELINE_DAYS
        const following = nextClose(addDays(p.close, 1), p.card.statementDay!)
        for (const c of [p.close, following]) if (inView(c)) marks.push({ at: pos(c), kind: 'close', label: `Statement closes ${c}` })
        // the open statement's due date (if unpaid) and the due date of the statement about to close
        const dues = [p.statementRemaining > 0.005 ? p.dueDate : null, dueAfter(p.close, p.card).date]
        for (const d of dues) if (d && inView(d)) marks.push({ at: pos(d), kind: 'due', label: `Payment due ${d}` })
        if (p.payForTarget > 0) marks.push({ at: pos(p.payForTargetBy), kind: 'pay', label: `Pay by ${p.payForTargetBy}` })
        const uniq = marks.filter((m, i) => marks.findIndex((x) => x.at === m.at && x.kind === m.kind) === i)
        return (
          <div className="tl-row" key={p.card.id}>
            <span className="tl-label">
              <span className={`card-dot pcard ${p.card.theme}`} /> <span className="ellipsis">{p.card.nickname}</span>
            </span>
            <div className="tl-track">
              {days.map((d) => (
                <span key={d} className="tl-cell" />
              ))}
              {uniq.map((m) => (
                <i key={m.kind + m.at} className={`mk ${m.kind}`} style={{ left: `calc(${(m.at + 0.5) / TIMELINE_DAYS} * 100%)` }} title={m.label} aria-label={m.label} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PlanCard({
  p,
  target,
  fmtDay,
  onLog,
  onEdit,
}: {
  p: CardPlan
  target: number
  fmtDay: (iso: string) => string
  onLog: (cardId: string, amount: number) => void
  onEdit: () => void
}) {
  const { state } = useStore()
  const s = state.settings
  const [custom, setCustom] = useState('')
  const stmtState = p.statementRemaining <= 0.005 ? 'paid' : p.daysToDue < 0 ? 'overdue' : p.daysToDue <= 5 ? 'soon' : 'later'
  const utilLevel = p.util >= 70 ? 'bad' : p.util >= 30 ? 'warn' : 'good'

  return (
    <section className="panel span-6 plan">
      <div className="panel-head">
        <div className="row" style={{ gap: 10 }}>
          <span className={`mini-card pcard ${p.card.theme}`} style={{ padding: '6px 10px', fontSize: 12 }}>
            •• {p.card.last4}
          </span>
          <div>
            <h2>{p.card.nickname}</h2>
            <div className="sub">
              Balance {money(p.balance, s)}
              {p.limit ? ` of ${money(p.limit, s, { compact: true })}` : ''}
            </div>
          </div>
        </div>
        <span className={`status ${utilLevel}`}>{p.util.toFixed(0)}% used</span>
      </div>

      <div className="step">
        <span className={`step-icon ${stmtState}`}>
          {stmtState === 'paid' ? <CheckCircle2 size={16} /> : stmtState === 'overdue' ? <OctagonAlert size={16} /> : <Clock size={16} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>Statement · closed {fmtDay(p.lastClose)}</b>
          <p className="muted">
            {money(p.statementBalance, s)} billed{p.paidSinceClose > 0 ? `, ${money(p.paidSinceClose, s)} paid since` : ''}.{' '}
            {stmtState === 'paid' ? (
              'Paid in full — no interest.'
            ) : (
              <>
                Pay <b className="num">{money(p.statementRemaining, s)}</b> by <b>{fmtDay(p.dueDate)}</b>
                {p.dueEstimated && (
                  <button className="linklike" onClick={onEdit} title="Set the real due day on the card">
                    {' '}
                    (estimated)
                  </button>
                )}{' '}
                to avoid interest.
              </>
            )}
          </p>
          {stmtState !== 'paid' && (
            <span className={`status ${stmtState === 'overdue' ? 'bad' : stmtState === 'soon' ? 'warn' : 'good'}`}>
              {stmtState === 'overdue' ? `Overdue by ${-p.daysToDue}d` : p.daysToDue === 0 ? 'Due today' : `Due in ${p.daysToDue}d`}
            </span>
          )}
        </div>
        {stmtState !== 'paid' && (
          <button className="btn" onClick={() => onLog(p.card.id, p.statementRemaining)}>
            Log {money(p.statementRemaining, s, { compact: p.statementRemaining >= 10000 })}
          </button>
        )}
      </div>

      <div className="step">
        <span className={`step-icon ${p.payForTarget > 0 ? 'soon' : 'paid'}`}>{p.payForTarget > 0 ? <CircleDollarSign size={16} /> : <CheckCircle2 size={16} />}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>
            Next close · {fmtDay(p.close)} ({p.daysToClose}d)
          </b>
          <p className="muted">
            Projected {money(p.projectedAtClose, s)} at close
            {p.upcoming.length ? ` incl. ${p.upcoming.map((u) => `${u.merchant} ${money(u.amount, s)}`).join(', ')}` : ''}.{' '}
            {p.limit ? (
              p.payForTarget > 0 ? (
                <>
                  Pay <b className="num">{money(p.payForTarget, s)}</b>
                  {p.daysToDue >= 0 && p.dueDate <= p.close && p.statementRemaining > 0 ? ' more' : ''} by <b>{fmtDay(p.payForTargetBy)}</b> to report ≤{target}% (
                  {money(p.targetBalance, s)}). Allow {POST_BUFFER_DAYS} days to post.
                </>
              ) : (
                <>Will report about {p.reportedUtil.toFixed(0)}% — at or under your {target}% target.</>
              )
            ) : (
              <button className="linklike" onClick={onEdit}>
                Add a credit limit to plan utilization.
              </button>
            )}
          </p>
        </div>
        {p.payForTarget > 0 && (
          <button className="btn" onClick={() => onLog(p.card.id, p.payForTarget)}>
            Log {money(p.payForTarget, s)}
          </button>
        )}
      </div>

      <form
        className="row plan-custom"
        onSubmit={(e) => {
          e.preventDefault()
          const n = Number(custom)
          if (n > 0) {
            onLog(p.card.id, n)
            setCustom('')
          }
        }}
      >
        <input className="input num" type="number" min={0} step="0.01" placeholder="Other amount" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label={`Payment amount for ${p.card.nickname}`} />
        <button className="btn" type="submit" disabled={!(Number(custom) > 0)}>
          Log payment
        </button>
      </form>
    </section>
  )
}
