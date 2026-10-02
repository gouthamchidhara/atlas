import type { Card, CategoryId, Transaction } from './types'
import { isSpend } from '../lib/stats'

export const isPoints = (card: Card | undefined) => card?.rewards?.unit === 'points'

/** The card's own number: % for cash back, multiplier for points. */
export const rawRate = (card: Card | undefined, cat: CategoryId) => {
  if (!card?.rewards) return 0
  return card.rewards.rates[cat] ?? card.rewards.base
}

/** Effective cash-equivalent % — what the optimizer compares across cards. */
export const rateFor = (card: Card | undefined, cat: CategoryId) => {
  const r = rawRate(card, cat)
  return isPoints(card) ? round2(r * (card!.rewards!.pointValue ?? 1)) : r
}

/** "3x" for points, "3%" for cash back. */
export const rateLabel = (card: Card | undefined, cat: CategoryId) => {
  const r = rawRate(card, cat)
  return isPoints(card) ? `${r}x` : `${r}%`
}

export const rewardFor = (t: Transaction, card: Card | undefined) => (isSpend(t) ? (t.amount * rateFor(card, t.category)) / 100 : 0)

/** Points earned on a purchase (0 for cash-back cards). */
export const pointsFor = (t: Transaction, card: Card | undefined) => (isSpend(t) && isPoints(card) ? Math.round(t.amount * rawRate(card, t.category)) : 0)

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

function round2(n: number) {
  return Math.round(n * 100) / 100
}
