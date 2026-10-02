import type { WidgetConfig } from '../domain/types'

type Preset = Omit<WidgetConfig, 'id'> & { blurb: string }

export const WIDGET_PRESETS: Preset[] = [
  { blurb: 'Big number with change vs. same point last month', title: 'Spent this month', viz: 'stat', metric: 'spend', period: 'this-month', cardIds: [], categories: [], size: 's' },
  { blurb: 'Daily bars for the last 30 days', title: 'Last 30 days', viz: 'trend', metric: 'spend', period: 'last-30', cardIds: [], categories: [], size: 'm' },
  { blurb: 'Where the money went, by category', title: 'Where it went', viz: 'breakdown', metric: 'spend', period: 'this-month', cardIds: [], categories: [], groupBy: 'category', size: 'm' },
  { blurb: 'Your most-paid merchants', title: 'Top merchants', viz: 'breakdown', metric: 'spend', period: 'last-90', cardIds: [], categories: [], groupBy: 'merchant', size: 'm' },
  { blurb: 'Latest purchases', title: 'Recent activity', viz: 'activity', metric: 'spend', period: 'last-30', cardIds: [], categories: [], size: 'm' },
  { blurb: 'Cap a category and watch the pace', title: 'Dining budget', viz: 'goal', metric: 'spend', period: 'this-month', cardIds: [], categories: ['dining'], target: 300, size: 's' },
  { blurb: 'Track one habit, e.g. coffee', title: 'Coffee tracker', viz: 'stat', metric: 'spend', period: 'this-month', cardIds: [], categories: [], merchant: 'starbucks', size: 's' },
  { blurb: 'Estimated cash-back earned', title: 'Rewards this year', viz: 'stat', metric: 'rewards', period: 'this-year', cardIds: [], categories: [], size: 's' },
  { blurb: 'One card: cycle spend, utilization, close date', title: 'Card cycle', viz: 'card', metric: 'spend', period: 'statement', cardIds: [], categories: [], size: 's' },
  { blurb: 'Spend split across your cards', title: 'By card', viz: 'breakdown', metric: 'spend', period: 'this-month', cardIds: [], categories: [], groupBy: 'card', size: 's' },
  { blurb: 'Weekly bars across a quarter', title: 'Weekly trend', viz: 'trend', metric: 'spend', period: 'last-90', cardIds: [], categories: [], size: 'l' },
]

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'w-trend', title: 'Last 30 days', viz: 'trend', metric: 'spend', period: 'last-30', cardIds: [], categories: [], size: 'm' },
  { id: 'w-cats', title: 'Where it went', viz: 'breakdown', metric: 'spend', period: 'this-month', cardIds: [], categories: [], groupBy: 'category', size: 'm' },
  { id: 'w-recent', title: 'Recent activity', viz: 'activity', metric: 'spend', period: 'last-30', cardIds: [], categories: [], size: 'm' },
  { id: 'w-merch', title: 'Top merchants', viz: 'breakdown', metric: 'spend', period: 'last-90', cardIds: [], categories: [], groupBy: 'merchant', size: 'm' },
]
