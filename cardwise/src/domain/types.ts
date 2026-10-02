export type CardKind = 'credit' | 'debit'
export type Network = 'visa' | 'mastercard' | 'amex' | 'discover' | 'rupay' | 'other'
export type CardTheme = 'aurora' | 'midnight' | 'sunset' | 'ocean' | 'graphite' | 'rose'

export type CategoryId =
  | 'groceries'
  | 'dining'
  | 'transport'
  | 'shopping'
  | 'bills'
  | 'entertainment'
  | 'travel'
  | 'health'
  | 'other'
  | 'income'

/** Never stores a full card number — only the last 4 digits. */
export interface Card {
  id: string
  nickname: string
  issuer: string
  kind: CardKind
  network: Network
  last4: string
  holder: string
  expiry: string // MM/YY
  theme: CardTheme
  /** Credit cards only. */
  creditLimit?: number
  /** Day of month the statement closes (credit only). */
  statementDay?: number
  /** Day of month payment is due (credit only). Unset = estimated 25 days after close. */
  dueDay?: number
  /** Cash-back-equivalent reward rates in percent. */
  rewards?: Rewards
  annualFee?: number
  createdAt: string
}

/**
 * Cash back: rates are percentages.
 * Points: rates are multipliers (points per currency unit) and `pointValue`
 * is what one point is worth to the user, in cents — so 3x at 1.5¢ = 4.5% effective.
 */
export interface Rewards {
  unit?: 'cashback' | 'points'
  /** e.g. "Ultimate Rewards" — display only */
  program?: string
  /** cents per point (points only) */
  pointValue?: number
  /** rate earned on everything without a specific rate */
  base: number
  rates: Partial<Record<CategoryId, number>>
}

export interface Transaction {
  id: string
  cardId: string
  /** ISO date YYYY-MM-DD */
  date: string
  merchant: string
  /** Positive = money out (purchase), negative = money in (refund/payment/income). */
  amount: number
  category: CategoryId
  note?: string
  /** true when the user picked the category by hand (auto-rules won't overwrite it). */
  manualCategory?: boolean
}

export interface CategoryRule {
  id: string
  /** Case-insensitive substring matched against the merchant. */
  pattern: string
  category: CategoryId
}

export interface Settings {
  currency: string
  locale: string
  theme: 'system' | 'light' | 'dark'
  /** utilization % the payment planner aims to report (default 10) */
  targetUtilization?: number
}

/* ---------- Widgets ---------- */

export type Period = 'this-week' | 'this-month' | 'last-month' | 'last-30' | 'last-90' | 'this-year' | 'statement'
export type WidgetViz = 'stat' | 'trend' | 'breakdown' | 'goal' | 'card' | 'activity'
export type WidgetMetric = 'spend' | 'count' | 'avg' | 'rewards'
export type GroupBy = 'category' | 'merchant' | 'card'
export type WidgetSize = 's' | 'm' | 'l'

export interface WidgetConfig {
  id: string
  title: string
  viz: WidgetViz
  metric: WidgetMetric
  period: Period
  /** empty = all cards */
  cardIds: string[]
  /** empty = all spend categories */
  categories: CategoryId[]
  /** optional case-insensitive merchant contains-filter */
  merchant?: string
  groupBy?: GroupBy
  /** goal widgets: spend ceiling for the period */
  target?: number
  size: WidgetSize
}

/* ---------- Alerts & notifications ---------- */

export type AlertTrigger =
  | { kind: 'large-tx'; amount: number }
  | { kind: 'merchant'; query: string }
  | { kind: 'new-merchant' }
  | { kind: 'category-spend'; category: CategoryId; mode: 'budget-percent' | 'amount'; value: number }
  | { kind: 'card-spend'; amount: number }
  | { kind: 'utilization'; percent: number }
  | { kind: 'statement-soon'; days: number }
  | { kind: 'expiring'; days: number }
  | { kind: 'subscription-change' }
  | { kind: 'better-card'; minMissed: number }
  | { kind: 'payment-due'; days: number }

export type AlertKind = AlertTrigger['kind']

export interface AlertRule {
  id: string
  name: string
  /** '' = any card */
  cardId: string
  trigger: AlertTrigger
  enabled: boolean
  /** also send a browser/system notification */
  push: boolean
  /** transaction-based triggers only consider purchases dated on/after this */
  createdAt: string
}

export type Severity = 'info' | 'warn' | 'critical'

export interface AppNotification {
  id: string
  /** dedupe key — a key fires at most once */
  key: string
  ruleId: string
  title: string
  body: string
  severity: Severity
  createdAt: string
  read: boolean
  cardId?: string
  txId?: string
  /** already shown as a system notification (e.g. by the background worker) */
  delivered?: boolean
}

export interface AppState {
  cards: Card[]
  transactions: Transaction[]
  budgets: Partial<Record<CategoryId, number>>
  rules: CategoryRule[]
  settings: Settings
  widgets: WidgetConfig[]
  alerts: AlertRule[]
  notifications: AppNotification[]
  firedKeys: string[]
}
