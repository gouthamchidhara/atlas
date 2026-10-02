import { categorize } from '../domain/categories'
import type { AlertRule, AppState, Card, Transaction } from '../domain/types'
import { toISO, uid } from '../lib/format'
import { DEFAULT_WIDGETS } from '../widgets/presets'

// merchant, typical amount, times per month
const DEMO: [string, number, number][] = [
  ['Whole Foods Market', 86, 4],
  ['Trader Joe\'s', 54, 3],
  ['Starbucks', 6.4, 8],
  ['Chipotle', 14.2, 3],
  ['DoorDash', 32, 3],
  ['Uber', 18, 4],
  ['Shell', 48, 2],
  ['Amazon', 42, 4],
  ['Target', 61, 1],
  ['AMC Theatres', 28, 1],
  ['Steam', 19.99, 0.5],
  ['CVS Pharmacy', 23, 1],
  ['Delta Air Lines', 342, 0.25],
  ['Marriott Hotels', 228, 0.25],
  ['Local Farmers Stand', 17, 1],
]

// merchant, price, day of month, card index, price in the latest month (a hike)
const RECURRING: [string, number, number, number, number?][] = [
  ['Netflix', 15.49, 4, 0],
  ['Spotify', 11.99, 9, 1, 12.99],
  ['Verizon Wireless', 72, 12, 1],
  ['Equinox Fitness', 65, 1, 0],
  ['iCloud+', 2.99, 18, 0],
]

function rand(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

export function demoState(base: AppState): AppState {
  const now = new Date()
  const created = new Date(now.getFullYear(), now.getMonth() - 8, 1).toISOString()
  const cards: Card[] = [
    {
      id: uid(), nickname: 'Daily Driver', issuer: 'Chase Sapphire', kind: 'credit', network: 'visa', last4: '4821', holder: 'Alex Morgan',
      expiry: '08/29', theme: 'aurora', creditLimit: 8000, statementDay: 15, annualFee: 95,
      rewards: { base: 1, rates: { dining: 3, travel: 2, transport: 2 } }, createdAt: created,
    },
    {
      id: uid(), nickname: 'Checking', issuer: 'Bank of Nowhere', kind: 'debit', network: 'mastercard', last4: '1907', holder: 'Alex Morgan',
      expiry: toISO(new Date(now.getFullYear(), now.getMonth() + 1, 1)).replace(/^\d{2}(\d{2})-(\d{2}).*/, '$2/$1'), theme: 'midnight', createdAt: created,
    },
    {
      id: uid(), nickname: 'Gold', issuer: 'Amex Gold', kind: 'credit', network: 'amex', last4: '3005', holder: 'Alex Morgan',
      expiry: '02/28', theme: 'sunset', creditLimit: 2500, statementDay: Math.min(28, now.getDate() + 2), annualFee: 250,
      rewards: { base: 1, rates: { dining: 4, groceries: 4, travel: 3 } }, createdAt: created,
    },
  ]
  const r = rand(42)
  const txs: Transaction[] = []
  const add = (cardId: string, d: Date, merchant: string, amount: number) =>
    txs.push({ id: uid(), cardId, date: toISO(d), merchant, amount, category: categorize(merchant, amount, []) })

  for (let mo = 5; mo >= 0; mo--) {
    const full = new Date(now.getFullYear(), now.getMonth() - mo + 1, 0).getDate()
    const daysInMonth = mo === 0 ? now.getDate() : full
    for (const [merchant, amt, freq] of DEMO) {
      // current month is partial: scale expected visits by how much of it has elapsed
      const f = mo === 0 ? (freq * daysInMonth) / full : freq
      const count = Math.floor(f) + (r() < f % 1 ? 1 : 0)
      for (let i = 0; i < count; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - mo, 1 + Math.floor(r() * daysInMonth))
        const amount = Math.round(amt * (0.7 + r() * 0.6) * 100) / 100
        const card = merchant.match(/Delta|Marriott/) ? cards[2] : r() < 0.6 ? cards[0] : r() < 0.6 ? cards[1] : cards[2]
        add(card.id, d, merchant, amount)
      }
    }
    for (const [merchant, price, day, ci, hiked] of RECURRING) {
      const d = new Date(now.getFullYear(), now.getMonth() - mo, day)
      if (d > now) continue
      const isLatest = mo === 0 || (mo === 1 && day > now.getDate())
      add(cards[ci].id, d, merchant, isLatest && hiked ? hiked : price)
    }
    const pay = new Date(now.getFullYear(), now.getMonth() - mo, Math.min(20, daysInMonth))
    if (pay <= now) add(cards[0].id, pay, 'Payment - Thank You', -700)
    if (pay <= now) add(cards[2].id, pay, 'Payment - Thank You', -200)
  }
  txs.sort((a, b) => b.date.localeCompare(a.date))

  // rules "created" 40 days ago so the inbox shows a realistic history
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 40).toISOString()
  const rule = (name: string, cardId: string, trigger: AlertRule['trigger'], push = false): AlertRule => ({ id: uid(), name, cardId, trigger, enabled: true, push, createdAt: since })
  const alerts: AlertRule[] = [
    rule('Big purchase', '', { kind: 'large-tx', amount: 200 }, true),
    rule('Dining budget heads-up', '', { kind: 'category-spend', category: 'dining', mode: 'budget-percent', value: 50 }),
    rule('Amex statement closing', cards[2].id, { kind: 'statement-soon', days: 3 }, true),
    rule('Amex utilization', cards[2].id, { kind: 'utilization', percent: 30 }),
    rule('Wrong card used', '', { kind: 'better-card', minMissed: 2 }),
    rule('Price hikes', '', { kind: 'subscription-change' }, true),
    rule('Debit card expiring', cards[1].id, { kind: 'expiring', days: 60 }),
  ]

  return {
    ...base,
    cards,
    transactions: txs,
    budgets: { groceries: 600, dining: 300, transport: 250, shopping: 300, entertainment: 100 },
    widgets: [
      { id: uid(), title: 'Rewards earned this year', viz: 'stat', metric: 'rewards', period: 'this-year', cardIds: [], categories: [], size: 's' },
      { id: uid(), title: 'Coffee tracker', viz: 'stat', metric: 'spend', period: 'this-month', cardIds: [], categories: [], merchant: 'starbucks', size: 's' },
      { id: uid(), title: 'Amex Gold cycle', viz: 'card', metric: 'spend', period: 'statement', cardIds: [cards[2].id], categories: [], size: 's' },
      ...DEFAULT_WIDGETS.map((w) => ({ ...w, id: uid() })),
      { id: uid(), title: 'Dining cap', viz: 'goal', metric: 'spend', period: 'this-month', cardIds: [], categories: ['dining'], target: 300, size: 's' },
      { id: uid(), title: 'Spend by card', viz: 'breakdown', metric: 'spend', period: 'this-month', cardIds: [], categories: [], groupBy: 'card', size: 's' },
      { id: uid(), title: 'Weekly trend', viz: 'trend', metric: 'spend', period: 'last-90', cardIds: [], categories: [], size: 's' },
    ],
    alerts,
    notifications: [],
    firedKeys: [],
  }
}
