import { ArrowRight, BadgeDollarSign, Flame, Repeat, Sparkles, Trophy } from 'lucide-react'
import { CategoryIcon } from '../components/CategoryIcon'
import { category, SPEND_CATEGORIES } from '../domain/categories'
import { bestCard, missedReward, rateFor, rewardFor } from '../domain/rewards'
import { money, todayISO } from '../lib/format'
import { addDays, daysBetween, parseISO } from '../lib/period'
import { isSpend, spendByCategory } from '../lib/stats'
import { detectSubscriptions } from '../lib/subscriptions'
import { useStore } from '../store/store'

export function Insights({ onEditCard }: { onEditCard: (id: string) => void }) {
  const { state } = useStore()
  const s = state.settings
  const today = todayISO()
  const cardMap = new Map(state.cards.map((c) => [c.id, c]))
  const hasRewards = state.cards.some((c) => c.rewards && (c.rewards.base || Object.keys(c.rewards.rates).length))

  // rewards: last 90 days
  const since90 = addDays(today, -89)
  const recent = state.transactions.filter((t) => t.date >= since90 && isSpend(t))
  const earned = recent.reduce((a, t) => a + rewardFor(t, cardMap.get(t.cardId)), 0)
  const misses = recent.map((t) => ({ t, m: missedReward(t, state.cards) })).filter((x) => x.m) as { t: (typeof recent)[number]; m: NonNullable<ReturnType<typeof missedReward>> }[]
  const missedTotal = misses.reduce((a, x) => a + x.m.missed, 0)
  const missByCat = new Map<string, number>()
  for (const x of misses) missByCat.set(x.t.category, (missByCat.get(x.t.category) ?? 0) + x.m.missed)

  // subscriptions
  const subs = detectSubscriptions(state.transactions, today)
  const subMonthly = subs.reduce((a, x) => a + x.amount, 0)

  // annual fee worth-it: last 365 days
  const since365 = addDays(today, -364)
  const feeCards = state.cards.filter((c) => c.annualFee)

  // spikes: last 30 days vs the 30-day average of the 90 days before that
  const sum = (from: string, to: string) => spendByCategory(state.transactions.filter((x) => x.date >= from && x.date <= to))
  const last30 = sum(addDays(today, -29), today)
  const before = sum(addDays(today, -119), addDays(today, -30))
  const hasHistory = state.transactions.some((x) => x.date <= addDays(today, -90))
  const spikes = SPEND_CATEGORIES.map((c) => {
    const recentV = last30.get(c.id) ?? 0
    const avg = (before.get(c.id) ?? 0) / 3
    return { c, recent: recentV, avg, pct: avg ? (recentV - avg) / avg : 0 }
  })
    .filter((x) => hasHistory && x.avg > 20 && x.pct > 0.2)
    .sort((a, b) => b.pct - a.pct)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Insights</h1>
          <p>What your statements won't tell you.</p>
        </div>
      </div>

      <div className="grid grid-dash">
        <section className="panel span-5 insight-hero">
          <div className="hero-label">
            <Sparkles size={13} style={{ verticalAlign: -2 }} /> Rewards · last 90 days
          </div>
          {hasRewards ? (
            <>
              <div className="row" style={{ alignItems: 'baseline', gap: 10, marginTop: 6 }}>
                <span className="hero-value num">{money(earned, s)}</span>
                <span className="muted">earned</span>
              </div>
              <div className="missed">
                <b className="num">{money(missedTotal, s)}</b> left on the table across {misses.length} purchases by using the wrong card.
              </div>
              {[...missByCat.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([cat, v]) => {
                  const best = bestCard(state.cards, cat as never)!
                  return (
                    <div key={cat} className="tip">
                      <CategoryIcon id={cat as never} />
                      <div style={{ flex: 1 }}>
                        <b>{category(cat as never).label}</b> → use <b>{best.card.nickname}</b> ({best.rate}%)
                      </div>
                      <span className="num muted">+{money(v, s)}</span>
                    </div>
                  )
                })}
            </>
          ) : (
            <div className="empty">
              Add reward rates to your cards to see earnings and missed rewards.
              {state.cards[0] && (
                <div>
                  <button className="btn" style={{ marginTop: 12 }} onClick={() => onEditCard(state.cards[0].id)}>
                    Set up rewards
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="panel span-7">
          <div className="panel-head">
            <h2>
              <Trophy size={15} style={{ verticalAlign: -2 }} /> Which card to swipe
            </h2>
            <span className="sub">Best reward rate per category</span>
          </div>
          <div className="swipe-grid">
            {SPEND_CATEGORIES.filter((c) => c.id !== 'other').map((c) => {
              const best = bestCard(state.cards, c.id)
              const card = best?.card
              return (
                <div key={c.id} className="swipe">
                  <CategoryIcon id={c.id} />
                  <div style={{ minWidth: 0 }}>
                    <div className="faint" style={{ fontSize: 11 }}>
                      {c.label}
                    </div>
                    <b className="ellipsis" style={{ display: 'block' }}>
                      {card && best.rate > 0 ? card.nickname : '—'}
                    </b>
                  </div>
                  {card && best.rate > 0 && <span className={`rate pcard ${card.theme}`}>{rateFor(card, c.id)}%</span>}
                </div>
              )
            })}
          </div>
        </section>

        <section className="panel span-7">
          <div className="panel-head">
            <h2>
              <Repeat size={15} style={{ verticalAlign: -2 }} /> Subscriptions & recurring
            </h2>
            <span className="sub num">
              {money(subMonthly, s)}/mo · {money(subMonthly * 12, s)}/yr
            </span>
          </div>
          {subs.length ? (
            <div className="cat-list">
              {subs.map((x) => {
                const c = cardMap.get(x.cardId)
                return (
                  <div className="cat-item" key={x.merchant} style={{ cursor: 'default' }}>
                    <CategoryIcon id={x.category} />
                    <div style={{ minWidth: 0 }}>
                      <div className="name" style={{ marginBottom: 0 }}>
                        <span className="ellipsis">{x.merchant}</span>
                        {x.change !== null && (
                          <span className={`status ${x.change > 0 ? 'warn' : 'good'}`}>
                            {x.change > 0 ? '▲' : '▼'} {money(Math.abs(x.change), s)}
                          </span>
                        )}
                      </div>
                      <div className="faint" style={{ fontSize: 12 }}>
                        Next ~{parseISO(x.next).toLocaleDateString(s.locale, { month: 'short', day: 'numeric' })} · {c?.nickname} ••{c?.last4} · {x.charges.length} charges
                      </div>
                    </div>
                    <div className="amt num">{money(x.amount, s)}</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty">No recurring charges detected yet — needs ~3 months of history.</div>
          )}
        </section>

        <section className="panel span-5">
          <div className="panel-head">
            <h2>
              <BadgeDollarSign size={15} style={{ verticalAlign: -2 }} /> Is the annual fee worth it?
            </h2>
            <span className="sub">Rewards vs. fee, per year</span>
          </div>
          {feeCards.length ? (
            feeCards.map((c) => {
              const own = state.transactions.filter((x) => x.cardId === c.id && x.date >= since365)
              const first = own.reduce((m, x) => (x.date < m ? x.date : m), today)
              // annualize when there's less than a year of history so the fee comparison is fair
              const days = Math.max(30, daysBetween(first, today) + 1)
              const r = (own.reduce((a, x) => a + rewardFor(x, c), 0) * 365) / days
              const months = Math.round(days / 30.4)
              const net = r - (c.annualFee ?? 0)
              const pct = Math.min(100, (r / (c.annualFee || 1)) * 100)
              return (
                <div key={c.id} className="worth">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="row" style={{ gap: 8 }}>
                      <span className={`card-dot pcard ${c.theme}`} /> <b>{c.nickname}</b>
                    </span>
                    <span className={`status ${net >= 0 ? 'good' : 'bad'}`}>
                      {net >= 0 ? '+' : '−'}
                      {money(Math.abs(net), s)} {net >= 0 ? 'ahead' : 'behind'}
                    </span>
                  </div>
                  <div className={`meter ${net >= 0 ? '' : 'bad'}`} style={{ margin: '8px 0 4px' }}>
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <div className="faint num" style={{ fontSize: 12 }}>
                    ≈{money(r, s)}/yr earned vs {money(c.annualFee ?? 0, s)} fee{months < 12 ? ` · projected from ${months} mo` : ''}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="empty">Add an annual fee to a card to track whether it pays for itself.</div>
          )}
        </section>

        <section className="panel span-12">
          <div className="panel-head">
            <h2>
              <Flame size={15} style={{ verticalAlign: -2 }} /> Running hot
            </h2>
            <span className="sub">Last 30 days vs. your usual month</span>
          </div>
          {spikes.length ? (
            <div className="spike-grid">
              {spikes.map((x) => (
                <div key={x.c.id} className="spike">
                  <CategoryIcon id={x.c.id} />
                  <div style={{ flex: 1 }}>
                    <b>{x.c.label}</b>
                    <div className="faint num" style={{ fontSize: 12 }}>
                      {money(x.avg, s)} <ArrowRight size={11} style={{ verticalAlign: -1 }} /> {money(x.recent, s)}
                    </div>
                  </div>
                  <span className="status warn">+{Math.round(x.pct * 100)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">{hasHistory ? 'Nothing unusual — every category is tracking near its average.' : 'Needs ~3 months of history to spot changes.'}</div>
          )}
        </section>
      </div>
    </>
  )
}
