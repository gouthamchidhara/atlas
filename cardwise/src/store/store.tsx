import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react'
import { categorize } from '../domain/categories'
import type { AppState, Card, CategoryId, CategoryRule, Settings, Transaction } from '../domain/types'
import { uid } from '../lib/format'

const STORAGE_KEY = 'cardwise:v1'

/** Browsers can report tags Intl rejects (e.g. "en-US@posix"); fall back safely. */
function safeLocale(tag: string | undefined) {
  try {
    return tag ? Intl.getCanonicalLocales(tag)[0] : 'en-US'
  } catch {
    return 'en-US'
  }
}

export const EMPTY: AppState = {
  cards: [],
  transactions: [],
  budgets: {},
  rules: [],
  settings: { currency: 'USD', locale: safeLocale(navigator.language), theme: 'system' },
}

export type Action =
  | { type: 'card/upsert'; card: Card }
  | { type: 'card/delete'; id: string }
  | { type: 'tx/upsert'; tx: Transaction }
  | { type: 'tx/delete'; id: string }
  | { type: 'tx/import'; txs: Transaction[] }
  | { type: 'tx/recategorize'; id: string; category: CategoryId }
  | { type: 'budget/set'; category: CategoryId; amount: number | null }
  | { type: 'rule/add'; pattern: string; category: CategoryId; applyToExisting: boolean }
  | { type: 'rule/delete'; id: string }
  | { type: 'settings/set'; settings: Partial<Settings> }
  | { type: 'state/replace'; state: AppState }

const sortTxs = (txs: Transaction[]) => [...txs].sort((a, b) => b.date.localeCompare(a.date))

function reducer(state: AppState, a: Action): AppState {
  switch (a.type) {
    case 'card/upsert': {
      const exists = state.cards.some((c) => c.id === a.card.id)
      return { ...state, cards: exists ? state.cards.map((c) => (c.id === a.card.id ? a.card : c)) : [...state.cards, a.card] }
    }
    case 'card/delete':
      return {
        ...state,
        cards: state.cards.filter((c) => c.id !== a.id),
        transactions: state.transactions.filter((t) => t.cardId !== a.id),
      }
    case 'tx/upsert': {
      const exists = state.transactions.some((t) => t.id === a.tx.id)
      const txs = exists ? state.transactions.map((t) => (t.id === a.tx.id ? a.tx : t)) : [a.tx, ...state.transactions]
      return { ...state, transactions: sortTxs(txs) }
    }
    case 'tx/delete':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== a.id) }
    case 'tx/import':
      return { ...state, transactions: sortTxs([...a.txs, ...state.transactions]) }
    case 'tx/recategorize':
      return {
        ...state,
        transactions: state.transactions.map((t) => (t.id === a.id ? { ...t, category: a.category, manualCategory: true } : t)),
      }
    case 'budget/set': {
      const budgets = { ...state.budgets }
      if (a.amount && a.amount > 0) budgets[a.category] = a.amount
      else delete budgets[a.category]
      return { ...state, budgets }
    }
    case 'rule/add': {
      const rule: CategoryRule = { id: uid(), pattern: a.pattern.trim(), category: a.category }
      const rules = [rule, ...state.rules]
      const transactions = a.applyToExisting
        ? state.transactions.map((t) => (t.manualCategory ? t : { ...t, category: categorize(t.merchant, t.amount, rules) }))
        : state.transactions
      return { ...state, rules, transactions }
    }
    case 'rule/delete':
      return { ...state, rules: state.rules.filter((r) => r.id !== a.id) }
    case 'settings/set':
      return { ...state, settings: { ...state.settings, ...a.settings } }
    case 'state/replace':
      return a.state
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<AppState>
    const settings = { ...EMPTY.settings, ...parsed.settings }
    return { ...EMPTY, ...parsed, settings: { ...settings, locale: safeLocale(settings.locale) } }
  } catch {
    return EMPTY
  }
}

const Ctx = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage full or blocked — keep running in memory */
    }
  }, [state])
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore must be used inside <StoreProvider>')
  return v
}
