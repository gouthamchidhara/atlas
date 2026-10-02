import type { CategoryId, Transaction } from '../domain/types'
import { monthKey } from './format'

export const isSpend = (t: Transaction) => t.amount > 0 && t.category !== 'income'

export function spendByCategory(txs: Transaction[]) {
  const map = new Map<CategoryId, number>()
  for (const t of txs) if (isSpend(t)) map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
  return map
}

export function totalSpend(txs: Transaction[]) {
  return txs.reduce((s, t) => (isSpend(t) ? s + t.amount : s), 0)
}

/** Last `n` month keys ending at `endKey`, oldest first. */
export function lastMonths(endKey: string, n: number) {
  const [y, m] = endKey.split('-').map(Number)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function spendByMonth(txs: Transaction[], keys: string[]) {
  const map = new Map(keys.map((k) => [k, 0]))
  for (const t of txs) {
    const k = monthKey(t.date)
    if (isSpend(t) && map.has(k)) map.set(k, map.get(k)! + t.amount)
  }
  return keys.map((k) => ({ key: k, value: map.get(k)! }))
}

export const inMonth = (txs: Transaction[], key: string) => txs.filter((t) => monthKey(t.date) === key)

/** Outstanding balance for a credit card = purchases − payments/refunds (all time). */
export function cardBalance(txs: Transaction[], cardId: string) {
  return txs.reduce((s, t) => (t.cardId === cardId ? s + t.amount : s), 0)
}

export function topMerchants(txs: Transaction[], n = 5) {
  const map = new Map<string, { total: number; count: number; category: CategoryId }>()
  for (const t of txs) {
    if (!isSpend(t)) continue
    const k = t.merchant.trim()
    const cur = map.get(k) ?? { total: 0, count: 0, category: t.category }
    cur.total += t.amount
    cur.count += 1
    map.set(k, cur)
  }
  return [...map.entries()]
    .map(([merchant, v]) => ({ merchant, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n)
}
