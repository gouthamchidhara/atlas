import type { Card, CategoryId, Transaction } from './types'
import { isSpend } from '../lib/stats'

export const rateFor = (card: Card | undefined, cat: CategoryId) => {
  if (!card?.rewards) return 0
  return card.rewards.rates[cat] ?? card.rewards.base
}

export const rewardFor = (t: Transaction, card: Card | undefined) => (isSpend(t) ? (t.amount * rateFor(card, t.category)) / 100 : 0)

/** Highest-earning card for a category; ties keep the earlier card. */
export function bestCard(cards: Card[], cat: CategoryId): { card: Card; rate: number } | null {
  let best: { card: Card; rate: number } | null = null
  for (const c of cards) {
    const r = rateFor(c, cat)
    if (!best || r > best.rate) best = { card: c, rate: r }
  }
  return best
}

/** What the purchase would have earned on the best card minus what it earned. */
export function missedReward(t: Transaction, cards: Card[]) {
  if (!isSpend(t)) return null
  const used = cards.find((c) => c.id === t.cardId)
  const best = bestCard(cards, t.category)
  if (!best || best.card.id === t.cardId) return null
  const diff = (t.amount * (best.rate - rateFor(used, t.category))) / 100
  return diff > 0 ? { best: best.card, rate: best.rate, usedRate: rateFor(used, t.category), missed: diff } : null
}
