import { describe, expect, it } from 'vitest'
import { evaluate } from '../alerts/engine'
import { bestCard, rateFor, rateLabel, pointsFor } from '../domain/rewards'
import type { AlertRule, AppState, Card, Transaction } from '../domain/types'
import { planCard, dueAfter } from '../lib/payments'
import { nextClose, statementCycle, resolvePeriod } from '../lib/period'
import { detectSubscriptions } from '../lib/subscriptions'

const card = (over: Partial<Card> = {}): Card => ({
  id: 'c1', nickname: 'Test', issuer: 'Bank', kind: 'credit', network: 'visa', last4: '1234', holder: '', expiry: '12/30', theme: 'aurora', createdAt: '2026-01-01T00:00:00Z', ...over,
})
let n = 0
const tx = (date: string, amount: number, merchant = 'Shop', over: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`, cardId: 'c1', date, merchant, amount, category: amount < 0 ? 'income' : 'shopping', ...over,
})

describe('period', () => {
  it('finds the next close on or after today', () => {
    expect(nextClose('2026-10-02', 15)).toBe('2026-10-15')
    expect(nextClose('2026-10-15', 15)).toBe('2026-10-15')
    expect(nextClose('2026-10-16', 15)).toBe('2026-11-15')
  })
  it('clamps day 31 to short months', () => {
    expect(nextClose('2026-02-10', 31)).toBe('2026-02-28')
    expect(statementCycle('2026-03-05', 31)).toEqual({ start: '2026-03-01', end: '2026-03-31' })
  })
  it('compares this month to the same elapsed days last month', () => {
    expect(resolvePeriod('this-month', '2026-03-31')).toEqual({
      cur: { start: '2026-03-01', end: '2026-03-31' },
      prev: { start: '2026-02-01', end: '2026-02-28' },
    })
  })
})

describe('rewards', () => {
  const cash = card({ id: 'cash', rewards: { base: 1, rates: { dining: 3 } } })
  const pts = card({ id: 'pts', rewards: { unit: 'points', pointValue: 1.5, base: 1, rates: { dining: 3 } } })
  it('values points at the user’s cents-per-point', () => {
    expect(rateFor(pts, 'dining')).toBe(4.5)
    expect(rateFor(pts, 'groceries')).toBe(1.5)
    expect(rateLabel(pts, 'dining')).toBe('3x')
    expect(rateLabel(cash, 'dining')).toBe('3%')
  })
  it('picks the best card on effective value', () => {
    expect(bestCard([cash, pts], 'dining')?.card.id).toBe('pts')
    expect(bestCard([cash, card({ id: 'p2', rewards: { unit: 'points', pointValue: 0.8, base: 1, rates: { dining: 3 } } })], 'dining')?.card.id).toBe('cash')
  })
  it('counts points per purchase, none for refunds', () => {
    expect(pointsFor(tx('2026-10-01', 20, 'Cafe', { category: 'dining' }), pts)).toBe(60)
    expect(pointsFor(tx('2026-10-01', -20), pts)).toBe(0)
  })
})

describe('payment planner', () => {
  const c = card({ creditLimit: 1000, statementDay: 15, dueDay: 10 })
  const txs = [tx('2026-09-10', 500), tx('2026-09-20', -100, 'Payment'), tx('2026-09-25', 200)]
  const p = planCard(c, txs, '2026-10-02', 10)!

  it('works out what is still owed on the last statement', () => {
    expect(p.lastClose).toBe('2026-09-15')
    expect(p.statementBalance).toBe(500)
    expect(p.paidSinceClose).toBe(100)
    expect(p.statementRemaining).toBe(400)
    expect(p.dueDate).toBe('2026-10-10')
    expect(p.dueEstimated).toBe(false)
  })
  it('adds only the extra needed to report at target after the statement payment', () => {
    expect(p.balance).toBe(600)
    expect(p.close).toBe('2026-10-15')
    // 600 balance − 400 statement payment (due before close) − 100 target = 100
    expect(p.payForTarget).toBe(100)
    expect(p.payForTargetBy).toBe('2026-10-13')
    expect(p.reportedUtil).toBeCloseTo(10)
  })
  it('estimates the due date when the card has none', () => {
    expect(dueAfter('2026-09-15', card())).toEqual({ date: '2026-10-10', estimated: true })
  })
  it('reports paid-in-full statements as nothing owed', () => {
    const paid = planCard(c, [...txs, tx('2026-09-30', -400, 'Payment')], '2026-10-02', 10)!
    expect(paid.statementRemaining).toBe(0)
    expect(paid.actions.find((a) => a.kind === 'statement')).toBeUndefined()
  })
  it('ignores debit cards', () => {
    expect(planCard(card({ kind: 'debit' }), txs, '2026-10-02', 10)).toBeNull()
  })
})

describe('subscriptions', () => {
  it('detects a monthly charge and its price change', () => {
    const t = ['2026-06-09', '2026-07-09', '2026-08-09'].map((d) => tx(d, 11.99, 'Spotify')).concat(tx('2026-09-09', 12.99, 'Spotify'))
    const [s] = detectSubscriptions(t, '2026-10-02')
    expect(s.merchant).toBe('Spotify')
    expect(s.change).toBeCloseTo(1)
    expect(s.next).toBe('2026-10-09')
  })
  it('ignores irregular merchants', () => {
    const t = ['2026-06-01', '2026-06-03', '2026-08-20', '2026-09-01'].map((d) => tx(d, 40, 'Amazon'))
    expect(detectSubscriptions(t, '2026-10-02')).toHaveLength(0)
  })
})

describe('alert engine', () => {
  const base = (alerts: AlertRule[], transactions: Transaction[], cards = [card({ creditLimit: 1000, statementDay: 15, dueDay: 10 })]): AppState => ({
    cards, transactions, alerts, budgets: {}, rules: [], widgets: [], notifications: [], firedKeys: [],
    settings: { currency: 'USD', locale: 'en-US', theme: 'system' },
  })
  const rule = (trigger: AlertRule['trigger'], createdAt = '2026-09-01T00:00:00Z'): AlertRule => ({ id: 'r', name: 'r', cardId: '', trigger, enabled: true, push: false, createdAt })

  it('large purchase only looks at purchases since the rule was created', () => {
    const out = evaluate(base([rule({ kind: 'large-tx', amount: 100 })], [tx('2026-08-20', 300), tx('2026-09-05', 300), tx('2026-09-06', 50)]), '2026-10-02')
    expect(out).toHaveLength(1)
    expect(out[0].title).toContain('$300.00')
  })
  it('payment due fires with the amount and a stable key', () => {
    const txs = [tx('2026-09-10', 500)]
    const a = evaluate(base([rule({ kind: 'payment-due', days: 10 })], txs), '2026-10-02')
    expect(a).toHaveLength(1)
    expect(a[0].body).toContain('$500.00')
    expect(a[0].key).toBe('r:c1:2026-10-10')
    // a week earlier it's not within 5 days
    expect(evaluate(base([rule({ kind: 'payment-due', days: 5 })], txs), '2026-10-02')).toHaveLength(0)
  })
  it('disabled rules never fire', () => {
    const r = { ...rule({ kind: 'large-tx', amount: 1 }), enabled: false }
    expect(evaluate(base([r], [tx('2026-09-05', 300)]), '2026-10-02')).toHaveLength(0)
  })
})
