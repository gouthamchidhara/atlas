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
  createdAt: string
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
}

export interface AppState {
  cards: Card[]
  transactions: Transaction[]
  budgets: Partial<Record<CategoryId, number>>
  rules: CategoryRule[]
  settings: Settings
}
