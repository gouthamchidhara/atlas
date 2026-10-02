import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react'
import { categorize } from '../domain/categories'
import type { AlertRule, AppNotification, AppState, Card, CategoryId, CategoryRule, Settings, Transaction, WidgetConfig } from '../domain/types'
import type { Candidate } from '../alerts/engine'
import { DEFAULT_WIDGETS } from '../widgets/presets'
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
  widgets: DEFAULT_WIDGETS,
  alerts: [],
  notifications: [],
  firedKeys: [],
}

const MAX_NOTIFICATIONS = 200

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
  | { type: 'widget/upsert'; widget: WidgetConfig }
  | { type: 'widget/delete'; id: string }
  | { type: 'widget/move'; id: string; to: number }
  | { type: 'alert/upsert'; alert: AlertRule }
  | { type: 'alert/delete'; id: string }
  | { type: 'alert/toggle'; id: string }
  | { type: 'notif/fire'; candidates: Candidate[]; now: string }
  | { type: 'notif/read'; id: string | 'all' }
  | { type: 'notif/delete'; id: string | 'all' }

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
        alerts: state.alerts.filter((r) => r.cardId !== a.id),
        widgets: state.widgets.map((w) => ({ ...w, cardIds: w.cardIds.filter((id) => id !== a.id) })),
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
    case 'widget/upsert': {
      const exists = state.widgets.some((w) => w.id === a.widget.id)
      return { ...state, widgets: exists ? state.widgets.map((w) => (w.id === a.widget.id ? a.widget : w)) : [...state.widgets, a.widget] }
    }
    case 'widget/delete':
      return { ...state, widgets: state.widgets.filter((w) => w.id !== a.id) }
    case 'widget/move': {
      const from = state.widgets.findIndex((w) => w.id === a.id)
      if (from < 0) return state
      const widgets = [...state.widgets]
      const [w] = widgets.splice(from, 1)
      widgets.splice(Math.max(0, Math.min(a.to, widgets.length)), 0, w)
      return { ...state, widgets }
    }
    case 'alert/upsert': {
      const exists = state.alerts.some((r) => r.id === a.alert.id)
      return { ...state, alerts: exists ? state.alerts.map((r) => (r.id === a.alert.id ? a.alert : r)) : [a.alert, ...state.alerts] }
    }
    case 'alert/delete':
      return { ...state, alerts: state.alerts.filter((r) => r.id !== a.id), notifications: state.notifications.filter((n) => n.ruleId !== a.id) }
    case 'alert/toggle':
      return { ...state, alerts: state.alerts.map((r) => (r.id === a.id ? { ...r, enabled: !r.enabled } : r)) }
    case 'notif/fire': {
      const fired = new Set(state.firedKeys)
      const fresh: AppNotification[] = []
      for (const c of a.candidates) {
        if (fired.has(c.key)) continue
        fired.add(c.key)
        fresh.push({ ...c, id: uid(), createdAt: a.now, read: false })
      }
      if (!fresh.length) return state
      return { ...state, firedKeys: [...fired].slice(-2000), notifications: [...fresh, ...state.notifications].slice(0, MAX_NOTIFICATIONS) }
    }
    case 'notif/read':
      return { ...state, notifications: state.notifications.map((n) => (a.id === 'all' || n.id === a.id ? { ...n, read: true } : n)) }
    case 'notif/delete':
      return { ...state, notifications: a.id === 'all' ? [] : state.notifications.filter((n) => n.id !== a.id) }
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
