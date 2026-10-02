import { category } from '../domain/categories'
import { rewardFor } from '../domain/rewards'
import type { AppState, Card, Transaction, WidgetConfig, WidgetMetric } from '../domain/types'
import { buckets, inRange, resolvePeriod, type Range } from './period'
import { isSpend } from './stats'

export function widgetCard(w: WidgetConfig, cards: Card[]) {
  return w.cardIds.length === 1 ? cards.find((c) => c.id === w.cardIds[0]) : undefined
}

export function widgetRanges(w: WidgetConfig, cards: Card[], today: string) {
  return resolvePeriod(w.period, today, widgetCard(w, cards)?.statementDay)
}

/** Transactions in scope (cards / categories / merchant) — any date. */
export function scopeTxs(w: WidgetConfig, state: AppState) {
  const q = w.merchant?.trim().toLowerCase()
  return state.transactions.filter(
    (t) =>
      (!w.cardIds.length || w.cardIds.includes(t.cardId)) &&
      (!w.categories.length || w.categories.includes(t.category)) &&
      (!q || t.merchant.toLowerCase().includes(q)),
  )
}

export function measure(metric: WidgetMetric, txs: Transaction[], cards: Map<string, Card>) {
  const spend = txs.filter(isSpend)
  switch (metric) {
    case 'spend':
      return spend.reduce((a, t) => a + t.amount, 0)
    case 'count':
      return spend.length
    case 'avg':
      return spend.length ? spend.reduce((a, t) => a + t.amount, 0) / spend.length : 0
    case 'rewards':
      return spend.reduce((a, t) => a + rewardFor(t, cards.get(t.cardId)), 0)
  }
}

export function computeWidget(w: WidgetConfig, state: AppState, today: string) {
  const cardMap = new Map(state.cards.map((c) => [c.id, c]))
  const { cur, prev } = widgetRanges(w, state.cards, today)
  const scoped = scopeTxs(w, state)
  const curTxs = scoped.filter((t) => inRange(t.date, cur))
  const prevTxs = scoped.filter((t) => inRange(t.date, prev))
  const value = measure(w.metric, curTxs, cardMap)
  const prevValue = measure(w.metric, prevTxs, cardMap)
  const series = buckets(cur, state.settings.locale).map((b) => ({ ...b, value: measure(w.metric, curTxs.filter((t) => inRange(t.date, b)), cardMap) }))

  const groups = new Map<string, { label: string; value: number; categoryId?: Transaction['category'] }>()
  for (const t of curTxs) {
    if (!isSpend(t)) continue
    const by = w.groupBy ?? 'category'
    const k = by === 'category' ? t.category : by === 'card' ? t.cardId : t.merchant.trim()
    const label = by === 'category' ? category(t.category).label : by === 'card' ? (cardMap.get(t.cardId)?.nickname ?? 'Card') : t.merchant.trim()
    const g = groups.get(k) ?? { label, value: 0, categoryId: by === 'category' ? t.category : undefined }
    // avg has no meaningful per-group sum; groups show spend instead
    g.value += w.metric === 'avg' ? t.amount : measure(w.metric, [t], cardMap)
    groups.set(k, g)
  }
  const breakdown = [...groups.entries()].map(([key, g]) => ({ key, ...g })).sort((a, b) => b.value - a.value)

  return { cur, prev, value, prevValue, series, breakdown, txs: curTxs }
}

export const rangeDays = (r: Range) => (new Date(r.end).getTime() - new Date(r.start).getTime()) / 86_400_000 + 1
