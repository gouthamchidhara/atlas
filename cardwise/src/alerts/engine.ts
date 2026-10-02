import { categoryLabel } from '../domain/categoryInfo'
import { isPoints, missedReward, rateLabel } from '../domain/rewards'
import type { AlertRule, AppNotification, AppState, Card, Severity } from '../domain/types'
import { money } from '../lib/format'
import { planCard } from '../lib/payments'
import { daysBetween, nextClose, parseISO, statementCycle } from '../lib/period'
import { cardBalance, isSpend } from '../lib/stats'
import { detectSubscriptions } from '../lib/subscriptions'

export type Candidate = Omit<AppNotification, 'id' | 'read' | 'createdAt'>

const MAX_PER_RULE = 12

function expiryDate(exp: string) {
  const m = exp.match(/^(\d{2})\/(\d{2})$/)
  if (!m) return null
  // cards expire at the end of the printed month
  const d = new Date(2000 + Number(m[2]), Number(m[1]), 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Pure: given state + today, which notifications should exist? Dedupe happens in the reducer via `key`. */
export function evaluate(state: AppState, today: string): Candidate[] {
  const out: Candidate[] = []
  const s = state.settings
  const cardName = (c?: Card) => (c ? `${c.nickname} ••${c.last4}` : 'a card')
  const cardMap = new Map(state.cards.map((c) => [c.id, c]))
  const month = today.slice(0, 7)
  const day = (iso: string) => parseISO(iso).toLocaleDateString(s.locale, { month: 'short', day: 'numeric' })

  for (const rule of state.alerts) {
    if (!rule.enabled) continue
    const since = rule.createdAt.slice(0, 10)
    const scopeCards = rule.cardId ? state.cards.filter((c) => c.id === rule.cardId) : state.cards
    const scopeIds = new Set(scopeCards.map((c) => c.id))
    const fresh = state.transactions.filter((t) => scopeIds.has(t.cardId) && t.date >= since && t.date <= today)
    const found: (Candidate & { when: string })[] = []
    const push = (key: string, title: string, body: string, severity: Severity, extra: Partial<Candidate> = {}) => {
      const when = (extra.txId && state.transactions.find((t) => t.id === extra.txId)?.date) || today
      found.push({ key: `${rule.id}:${key}`, ruleId: rule.id, title, body, severity, ...extra, when })
    }
    const tr = rule.trigger

    switch (tr.kind) {
      case 'large-tx':
        for (const t of fresh)
          if (isSpend(t) && t.amount >= tr.amount)
            push(t.id, `Large purchase · ${money(t.amount, s)}`, `${t.merchant} on ${cardName(cardMap.get(t.cardId))} · ${day(t.date)}.`, 'warn', { cardId: t.cardId, txId: t.id })
        break
      case 'merchant': {
        const q = tr.query.trim().toLowerCase()
        if (!q) break
        for (const t of fresh)
          if (t.merchant.toLowerCase().includes(q))
            push(t.id, `${t.merchant} · ${money(Math.abs(t.amount), s)}`, `${t.amount < 0 ? 'Credit' : 'Charge'} on ${cardName(cardMap.get(t.cardId))} · ${day(t.date)}.`, 'info', { cardId: t.cardId, txId: t.id })
        break
      }
      case 'new-merchant': {
        const first = new Map<string, string>()
        for (const t of [...state.transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
          const k = t.merchant.trim().toLowerCase()
          if (!first.has(k)) first.set(k, t.id)
        }
        for (const t of fresh)
          if (isSpend(t) && first.get(t.merchant.trim().toLowerCase()) === t.id)
            push(t.id, `New merchant · ${t.merchant}`, `First time you've paid ${t.merchant} — ${money(t.amount, s)} on ${cardName(cardMap.get(t.cardId))}.`, 'info', { cardId: t.cardId, txId: t.id })
        break
      }
      case 'category-spend': {
        const spent = state.transactions
          .filter((t) => scopeIds.has(t.cardId) && t.category === tr.category && t.date.startsWith(month) && isSpend(t))
          .reduce((a, t) => a + t.amount, 0)
        const budget = state.budgets[tr.category]
        const limit = tr.mode === 'amount' ? tr.value : budget ? (budget * tr.value) / 100 : null
        if (limit && spent >= limit) {
          const label = categoryLabel(tr.category)
          const detail = tr.mode === 'budget-percent' && budget ? `${Math.round((spent / budget) * 100)}% of your ${money(budget, s)} budget` : `past your ${money(tr.value, s)} limit`
          push(month, `${label} at ${money(spent, s)} this month`, `That's ${detail}${rule.cardId ? ` on ${cardName(scopeCards[0])}` : ''}.`, spent >= (budget ?? limit) ? 'critical' : 'warn')
        }
        break
      }
      case 'card-spend':
        for (const c of scopeCards) {
          const spent = state.transactions.filter((t) => t.cardId === c.id && t.date.startsWith(month) && isSpend(t)).reduce((a, t) => a + t.amount, 0)
          if (spent >= tr.amount) push(`${c.id}:${month}`, `${c.nickname} passed ${money(tr.amount, s)} this month`, `${money(spent, s)} spent on ${cardName(c)} so far.`, 'warn', { cardId: c.id })
        }
        break
      case 'utilization':
        for (const c of scopeCards) {
          if (c.kind !== 'credit' || !c.creditLimit) continue
          const bal = Math.max(0, cardBalance(state.transactions, c.id))
          const pct = (bal / c.creditLimit) * 100
          if (pct >= tr.percent)
            push(`${c.id}:${month}:${tr.percent}`, `${c.nickname} utilization ${pct.toFixed(0)}%`, `Balance ${money(bal, s)} of ${money(c.creditLimit, s)}. Utilization above 30% can dent your credit score — pay down before the statement closes.`, pct >= 70 ? 'critical' : 'warn', { cardId: c.id })
        }
        break
      case 'statement-soon':
        for (const c of scopeCards) {
          if (c.kind !== 'credit' || !c.statementDay) continue
          const close = nextClose(today, c.statementDay)
          const days = daysBetween(today, close)
          if (days > tr.days) continue
          const cyc = statementCycle(today, c.statementDay)
          const cycleSpend = state.transactions.filter((t) => t.cardId === c.id && t.date >= cyc.start && t.date <= today && isSpend(t)).reduce((a, t) => a + t.amount, 0)
          const bal = Math.max(0, cardBalance(state.transactions, c.id))
          const tip = c.creditLimit && bal > c.creditLimit * 0.1 ? ` Pay ${money(bal - c.creditLimit * 0.1, s)} before then to report under 10% utilization.` : ''
          push(`${c.id}:${close}`, `${c.nickname} statement closes ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}`, `${money(cycleSpend, s)} charged this cycle.${tip}`, 'info', { cardId: c.id })
        }
        break
      case 'expiring':
        for (const c of scopeCards) {
          const exp = expiryDate(c.expiry)
          if (!exp) continue
          const days = daysBetween(today, exp)
          if (days <= tr.days)
            push(`${c.id}:${exp}`, days < 0 ? `${c.nickname} has expired` : `${c.nickname} expires in ${days} days`, `Update subscriptions and autopays that use ${cardName(c)}.`, days < 14 ? 'critical' : 'warn', { cardId: c.id })
        }
        break
      case 'subscription-change':
        for (const sub of detectSubscriptions(state.transactions, today)) {
          if (!scopeIds.has(sub.cardId) || sub.change === null || sub.last < since) continue
          const up = sub.change > 0
          push(`${sub.merchant}:${sub.last}`, `${sub.merchant} ${up ? 'raised' : 'lowered'} its price`, `${money(sub.previousAmount ?? 0, s)} → ${money(sub.amount, s)} (${up ? '+' : ''}${money(sub.change * 12, s)}/yr) on ${cardName(cardMap.get(sub.cardId))}.`, up ? 'warn' : 'info', { cardId: sub.cardId, txId: sub.charges[sub.charges.length - 1].id })
        }
        break
      case 'better-card':
        for (const t of fresh) {
          const m = missedReward(t, state.cards)
          if (m && m.missed >= tr.minMissed)
            push(t.id, `Use ${m.best.nickname} for ${categoryLabel(t.category)}`, `${t.merchant} (${money(t.amount, s)}) earned ${m.usedRate}% — ${m.best.nickname} pays ${isPoints(m.best) ? `${rateLabel(m.best, t.category)} (≈${m.rate}%)` : `${m.rate}%`}. Left ${money(m.missed, s)} on the table.`, 'info', { cardId: t.cardId, txId: t.id })
        }
        break
      case 'payment-due':
        for (const c of scopeCards) {
          const p = planCard(c, state.transactions, today, state.settings.targetUtilization ?? 10)
          if (!p || p.statementRemaining <= 0.005 || p.daysToDue > tr.days) continue
          const overdue = p.daysToDue < 0
          const when = overdue ? `was due ${-p.daysToDue} day${p.daysToDue === -1 ? '' : 's'} ago` : p.daysToDue === 0 ? 'is due today' : `is due in ${p.daysToDue} day${p.daysToDue === 1 ? '' : 's'}`
          push(
            `${c.id}:${p.dueDate}`,
            `${c.nickname} payment ${when}`,
            `Pay ${money(p.statementRemaining, s)} by ${day(p.dueDate)}${p.dueEstimated ? ' (estimated)' : ''} to avoid interest on ${cardName(c)}.`,
            overdue || p.daysToDue <= 1 ? 'critical' : 'warn',
            { cardId: c.id },
          )
        }
        break
    }
    // newest first, capped so a new rule can't flood the inbox
    found.sort((a, b) => b.when.localeCompare(a.when))
    out.push(...found.slice(0, MAX_PER_RULE).map(({ when: _when, ...c }) => c))
  }
  return out
}

export function describeTrigger(r: AlertRule, state: AppState): string {
  const s = state.settings
  const t = r.trigger
  switch (t.kind) {
    case 'large-tx':
      return `Any purchase of ${money(t.amount, s)} or more`
    case 'merchant':
      return `Any charge at a merchant containing “${t.query}”`
    case 'new-merchant':
      return 'First purchase at a merchant you’ve never paid before'
    case 'category-spend':
      return t.mode === 'amount'
        ? `${categoryLabel(t.category)} spend passes ${money(t.value, s)} in a month`
        : `${categoryLabel(t.category)} reaches ${t.value}% of its monthly budget`
    case 'card-spend':
      return `Monthly spend on the card passes ${money(t.amount, s)}`
    case 'utilization':
      return `Credit utilization at or above ${t.percent}%`
    case 'statement-soon':
      return `Statement closes within ${t.days} day${t.days === 1 ? '' : 's'}`
    case 'expiring':
      return `Card expires within ${t.days} days`
    case 'subscription-change':
      return 'A recurring charge changes price'
    case 'better-card':
      return `Another card would have earned ${money(t.minMissed, s)}+ more`
    case 'payment-due':
      return `Statement payment due within ${t.days} day${t.days === 1 ? '' : 's'}`
  }
}

export const sinceLabel = (iso: string, locale: string) => parseISO(iso.slice(0, 10)).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
