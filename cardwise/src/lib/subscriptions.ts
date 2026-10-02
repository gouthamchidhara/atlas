import type { CategoryId, Transaction } from '../domain/types'
import { addDays, daysBetween } from './period'
import { isSpend } from './stats'

export interface Subscription {
  merchant: string
  category: CategoryId
  cardId: string
  amount: number
  previousAmount: number | null
  /** latest charge minus previous, when it moved by more than 2% */
  change: number | null
  charges: Transaction[]
  last: string
  next: string
  annual: number
}

const norm = (m: string) => m.toLowerCase().replace(/[^a-z]/g, '')
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

/**
 * Recurring = 3+ charges at the same merchant roughly a month apart
 * with amounts within 25% of their median. Price moves on the latest charge are surfaced.
 */
export function detectSubscriptions(txs: Transaction[], today: string): Subscription[] {
  const groups = new Map<string, Transaction[]>()
  for (const t of txs) {
    if (!isSpend(t)) continue
    const k = norm(t.merchant)
    if (!k) continue
    const g = groups.get(k) ?? []
    g.push(t)
    groups.set(k, g)
  }
  const out: Subscription[] = []
  for (const g of groups.values()) {
    if (g.length < 3) continue
    const sorted = [...g].sort((a, b) => a.date.localeCompare(b.date))
    const gaps = sorted.slice(1).map((t, i) => daysBetween(sorted[i].date, t.date))
    const gap = median(gaps)
    if (gap < 25 || gap > 35 || gaps.some((x) => x < 20)) continue
    const amounts = sorted.map((t) => t.amount)
    const med = median(amounts)
    if (amounts.some((a) => Math.abs(a - med) / med > 0.25)) continue
    const last = sorted[sorted.length - 1]
    if (daysBetween(last.date, today) > 45) continue // lapsed
    const prev = sorted[sorted.length - 2]
    const moved = Math.abs(last.amount - prev.amount) / prev.amount > 0.02
    out.push({
      merchant: last.merchant,
      category: last.category,
      cardId: last.cardId,
      amount: last.amount,
      previousAmount: prev.amount,
      change: moved ? last.amount - prev.amount : null,
      charges: sorted,
      last: last.date,
      next: addDays(last.date, Math.round(gap)),
      annual: last.amount * 12,
    })
  }
  return out.sort((a, b) => b.amount - a.amount)
}
