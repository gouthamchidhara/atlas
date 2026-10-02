import { categorize } from '../domain/categories'
import type { AppState, Card, Transaction } from '../domain/types'
import { toISO, uid } from '../lib/format'

const DEMO: [string, number, number][] = [
  // merchant, typical amount, times per month
  ['Whole Foods Market', 86, 4],
  ['Trader Joe\'s', 54, 3],
  ['Starbucks', 6.4, 8],
  ['Chipotle', 14.2, 3],
  ['DoorDash', 32, 3],
  ['Uber', 18, 4],
  ['Shell', 48, 2],
  ['Amazon', 42, 4],
  ['Target', 61, 1],
  ['Netflix', 15.49, 1],
  ['Spotify', 11.99, 1],
  ['Verizon Wireless', 72, 1],
  ['AMC Theatres', 28, 1],
  ['Steam', 19.99, 0.5],
  ['CVS Pharmacy', 23, 1],
  ['Equinox Fitness', 65, 1],
  ['Delta Air Lines', 342, 0.25],
  ['Marriott Hotels', 228, 0.25],
  ['Local Farmers Stand', 17, 1],
]

function rand(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

export function demoState(base: AppState): AppState {
  const cards: Card[] = [
    { id: uid(), nickname: 'Daily Driver', issuer: 'Chase Sapphire', kind: 'credit', network: 'visa', last4: '4821', holder: 'Alex Morgan', expiry: '08/29', theme: 'aurora', creditLimit: 8000, statementDay: 15, createdAt: new Date().toISOString() },
    { id: uid(), nickname: 'Checking', issuer: 'Bank of Nowhere', kind: 'debit', network: 'mastercard', last4: '1907', holder: 'Alex Morgan', expiry: '11/27', theme: 'midnight', createdAt: new Date().toISOString() },
    { id: uid(), nickname: 'Travel', issuer: 'Amex Gold', kind: 'credit', network: 'amex', last4: '3005', holder: 'Alex Morgan', expiry: '02/28', theme: 'sunset', creditLimit: 12000, statementDay: 3, createdAt: new Date().toISOString() },
  ]
  const r = rand(42)
  const txs: Transaction[] = []
  const now = new Date()
  for (let mo = 5; mo >= 0; mo--) {
    const daysInMonth = mo === 0 ? now.getDate() : new Date(now.getFullYear(), now.getMonth() - mo + 1, 0).getDate()
    for (const [merchant, amt, freq] of DEMO) {
      // current month is partial: scale expected visits by how much of it has elapsed
      const f = mo === 0 ? (freq * daysInMonth) / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() : freq
      const count = Math.floor(f) + (r() < f % 1 ? 1 : 0)
      for (let i = 0; i < count; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - mo, 1 + Math.floor(r() * daysInMonth))
        const amount = Math.round(amt * (0.7 + r() * 0.6) * 100) / 100
        const card = merchant.match(/Delta|Marriott/) ? cards[2] : r() < 0.7 ? cards[0] : cards[1]
        txs.push({ id: uid(), cardId: card.id, date: toISO(d), merchant, amount, category: categorize(merchant, amount, []) })
      }
    }
    const pay = new Date(now.getFullYear(), now.getMonth() - mo, Math.min(20, daysInMonth))
    if (pay <= now) txs.push({ id: uid(), cardId: cards[0].id, date: toISO(pay), merchant: 'Payment - Thank You', amount: -650, category: 'income' })
  }
  txs.sort((a, b) => b.date.localeCompare(a.date))
  return {
    ...base,
    cards,
    transactions: txs,
    budgets: { groceries: 600, dining: 300, transport: 250, shopping: 300, entertainment: 100 },
  }
}
