import type { AlertTrigger } from '../domain/types'

export interface AlertPreset {
  name: string
  blurb: string
  trigger: AlertTrigger
  creditOnly?: boolean
}

export const ALERT_PRESETS: AlertPreset[] = [
  { name: 'Big purchase', blurb: 'Any single charge over an amount', trigger: { kind: 'large-tx', amount: 200 } },
  { name: 'Budget heads-up', blurb: 'A category hits a % of its budget', trigger: { kind: 'category-spend', category: 'dining', mode: 'budget-percent', value: 80 } },
  { name: 'Statement closing', blurb: 'Pay before it reports to bureaus', trigger: { kind: 'statement-soon', days: 3 }, creditOnly: true },
  { name: 'Payment due', blurb: 'Unpaid statement balance coming due', trigger: { kind: 'payment-due', days: 5 }, creditOnly: true },
  { name: 'High utilization', blurb: 'Balance vs. limit crosses a %', trigger: { kind: 'utilization', percent: 30 }, creditOnly: true },
  { name: 'Wrong card used', blurb: 'Another card would have earned more', trigger: { kind: 'better-card', minMissed: 1 } },
  { name: 'Price hike', blurb: 'A subscription changes price', trigger: { kind: 'subscription-change' } },
  { name: 'New merchant', blurb: 'First time paying somewhere — fraud check', trigger: { kind: 'new-merchant' } },
  { name: 'Merchant watch', blurb: 'Every charge from a specific merchant', trigger: { kind: 'merchant', query: 'amazon' } },
  { name: 'Monthly card cap', blurb: 'Card spend passes an amount', trigger: { kind: 'card-spend', amount: 1000 } },
  { name: 'Card expiring', blurb: 'Time to update autopays', trigger: { kind: 'expiring', days: 60 } },
]

export const KIND_LABEL: Record<AlertTrigger['kind'], string> = {
  'large-tx': 'Large purchase',
  merchant: 'Merchant charge',
  'new-merchant': 'New merchant',
  'category-spend': 'Category spend',
  'card-spend': 'Card monthly spend',
  utilization: 'Credit utilization',
  'statement-soon': 'Statement closing',
  expiring: 'Card expiring',
  'subscription-change': 'Subscription price change',
  'better-card': 'Better card available',
  'payment-due': 'Payment due',
}
