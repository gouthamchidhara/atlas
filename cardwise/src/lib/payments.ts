import type { Card, Transaction } from '../domain/types'
import { toISO } from './format'
import { addDays, daysBetween, nextClose, parseISO, statementCycle } from './period'
import { detectSubscriptions } from './subscriptions'

/** Typical gap between statement close and due date when the user hasn't set a due day. */
export const DEFAULT_GRACE_DAYS = 25
/** Pay this many days before close so the payment posts before the balance is reported. */
export const POST_BUFFER_DAYS = 2

export interface PlanAction {
  date: string
  cardId: string
  amount: number
  kind: 'statement' | 'utilization'
  overdue: boolean
}

export interface CardPlan {
  card: Card
  limit: number
  balance: number
  util: number
  close: string
  daysToClose: number
  lastClose: string
  statementBalance: number
  paidSinceClose: number
  statementRemaining: number
  dueDate: string
  dueEstimated: boolean
  daysToDue: number
  upcoming: { merchant: string; amount: number; date: string }[]
  projectedAtClose: number
  targetBalance: number
  /** extra payment (beyond the statement payment) to report at or under target */
  payForTarget: number
  payForTargetBy: string
  /** utilization reported at close if the plan is followed */
  reportedUtil: number
  actions: PlanAction[]
}

function clampDay(y: number, m: number, d: number) {
  return new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()))
}

/** First due date after a statement close. */
export function dueAfter(close: string, card: Card): { date: string; estimated: boolean } {
  if (!card.dueDay) return { date: addDays(close, DEFAULT_GRACE_DAYS), estimated: true }
  const c = parseISO(close)
  let d = clampDay(c.getFullYear(), c.getMonth(), card.dueDay)
  if (toISO(d) <= close) d = clampDay(c.getFullYear(), c.getMonth() + 1, card.dueDay)
  return { date: toISO(d), estimated: false }
}

export function planCard(card: Card, txs: Transaction[], today: string, targetPct: number): CardPlan | null {
  if (card.kind !== 'credit' || !card.statementDay) return null
  const own = txs.filter((t) => t.cardId === card.id && t.date <= today)
  const limit = card.creditLimit ?? 0
  const balance = Math.max(0, own.reduce((a, t) => a + t.amount, 0))
  const close = nextClose(today, card.statementDay)
  const lastClose = addDays(statementCycle(today, card.statementDay).start, -1)
  const statementBalance = Math.max(0, own.filter((t) => t.date <= lastClose).reduce((a, t) => a + t.amount, 0))
  const paidSinceClose = -own.filter((t) => t.date > lastClose && t.amount < 0).reduce((a, t) => a + t.amount, 0)
  const statementRemaining = Math.max(0, statementBalance - paidSinceClose)
  const due = dueAfter(lastClose, card)

  const upcoming = detectSubscriptions(txs, today)
    .filter((s) => s.cardId === card.id && s.next > today && s.next <= close)
    .map((s) => ({ merchant: s.merchant, amount: s.amount, date: s.next }))
  const projectedAtClose = balance + upcoming.reduce((a, u) => a + u.amount, 0)
  const targetBalance = (limit * targetPct) / 100
  const statementPaidBeforeClose = due.date <= close ? statementRemaining : 0
  const payForTarget = limit ? Math.max(0, round(projectedAtClose - statementPaidBeforeClose - targetBalance)) : 0
  const by = addDays(close, -POST_BUFFER_DAYS)
  const payForTargetBy = by < today ? today : by
  const reportedBalance = Math.max(0, projectedAtClose - statementPaidBeforeClose - payForTarget)

  const actions: PlanAction[] = []
  if (statementRemaining > 0.005)
    actions.push({ date: due.date, cardId: card.id, amount: round(statementRemaining), kind: 'statement', overdue: due.date < today })
  if (payForTarget > 0.005) actions.push({ date: payForTargetBy, cardId: card.id, amount: payForTarget, kind: 'utilization', overdue: false })

  return {
    card,
    limit,
    balance,
    util: limit ? (balance / limit) * 100 : 0,
    close,
    daysToClose: daysBetween(today, close),
    lastClose,
    statementBalance,
    paidSinceClose,
    statementRemaining,
    dueDate: due.date,
    dueEstimated: due.estimated,
    daysToDue: daysBetween(today, due.date),
    upcoming,
    projectedAtClose,
    targetBalance,
    payForTarget,
    payForTargetBy,
    reportedUtil: limit ? (reportedBalance / limit) * 100 : 0,
    actions,
  }
}

export function planAll(cards: Card[], txs: Transaction[], today: string, targetPct: number) {
  const plans = cards.map((c) => planCard(c, txs, today, targetPct)).filter((p): p is CardPlan => !!p)
  const actions = plans.flatMap((p) => p.actions).sort((a, b) => a.date.localeCompare(b.date))
  return { plans, actions }
}

const round = (n: number) => Math.ceil(n * 100) / 100
