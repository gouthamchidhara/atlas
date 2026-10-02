import { Bell, CalendarCheck2, CreditCard, LayoutDashboard, Lightbulb, ListOrdered, PiggyBank, Settings as Cog, Wallet } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertForm } from './alerts/AlertForm'
import { evaluate } from './alerts/engine'
import type { AlertRule, Card, Transaction, WidgetConfig } from './domain/types'
import { Alerts } from './views/Alerts'
import { Insights } from './views/Insights'
import { Payments } from './views/Payments'
import { mirrorState, notify, setupBackgroundChecks, takePending } from './lib/pwa'
import { WidgetBuilder } from './widgets/WidgetBuilder'
import { CardForm } from './forms/CardForm'
import { ImportDialog } from './forms/ImportDialog'
import { TransactionForm } from './forms/TransactionForm'
import { demoState } from './store/seed'
import { useStore } from './store/store'
import { Budgets } from './views/Budgets'
import { Cards } from './views/Cards'
import { Dashboard } from './views/Dashboard'
import { Settings } from './views/Settings'
import { Transactions } from './views/Transactions'
import { EMPTY_FILTER, type TxFilter } from './views/txFilter'
import { todayISO } from './lib/format'

type View = 'dashboard' | 'cards' | 'transactions' | 'payments' | 'insights' | 'alerts' | 'budgets' | 'settings'

const NAV: { id: View; label: string; icon: typeof Wallet }[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'cards', label: 'Cards', icon: CreditCard },
  { id: 'transactions', label: 'Activity', icon: ListOrdered },
  { id: 'payments', label: 'Payments', icon: CalendarCheck2 },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'budgets', label: 'Budgets', icon: PiggyBank },
  { id: 'settings', label: 'Settings', icon: Cog },
]

function viewFromHash(): View {
  const h = location.hash.slice(1) as View
  return NAV.some((n) => n.id === h) ? h : 'dashboard'
}

type ModalState =
  | { kind: 'card'; card?: Card }
  | { kind: 'tx'; tx?: Transaction; cardId?: string }
  | { kind: 'import' }
  | { kind: 'widget'; widget?: WidgetConfig }
  | { kind: 'alert'; alert?: AlertRule; cardId?: string }
  | null

export default function App() {
  const { state, dispatch } = useStore()
  const [view, setView] = useState<View>(viewFromHash)
  const [modal, setModal] = useState<ModalState>(null)
  const [filter, setFilter] = useState<TxFilter>(EMPTY_FILTER)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  useEffect(() => {
    if (location.hash.slice(1) !== view) history.pushState(null, '', `#${view}`)
    window.scrollTo({ top: 0 })
  }, [view])

  // back/forward buttons and hand-edited URLs
  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [])

  useEffect(() => {
    const t = state.settings.theme
    if (t === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', t)
  }, [state.settings.theme])

  const toast = useCallback((m: string) => {
    setToastMsg(m)
    window.setTimeout(() => setToastMsg(null), 2400)
  }, [])

  // Alert engine: re-evaluate on every data change and hourly (date-based triggers).
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    const candidates = evaluate(state, todayISO())
    if (candidates.length) dispatch({ type: 'notif/fire', candidates, now: new Date().toISOString() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.transactions, state.cards, state.alerts, state.budgets, tick])

  // Surface newly-fired notifications: toast + system push for rules that ask for it.
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(state.notifications.map((n) => n.id))
      return
    }
    const fresh = state.notifications.filter((n) => !seen.current!.has(n.id))
    for (const n of fresh) seen.current.add(n.id)
    if (!fresh.length) return
    toast(fresh.length === 1 ? `🔔 ${fresh[0].title}` : `🔔 ${fresh.length} new alerts`)
    const pushRules = new Set(state.alerts.filter((a) => a.push).map((a) => a.id))
    // skip ones the background worker already showed
    for (const n of fresh.filter((x) => pushRules.has(x.ruleId) && !x.delivered).slice(0, 3)) void notify(n.title, n.body, n.key)
  }, [state.notifications, state.alerts, toast])

  // Background checks: keep a snapshot in IndexedDB for the service worker,
  // and pull in anything it found while the app was closed.
  useEffect(() => {
    const t = window.setTimeout(() => void mirrorState(state), 400)
    return () => window.clearTimeout(t)
  }, [state])
  useEffect(() => {
    const pull = () =>
      void takePending().then((candidates) => {
        if (candidates.length) dispatch({ type: 'notif/fire', candidates, now: new Date().toISOString() })
      })
    pull()
    void setupBackgroundChecks()
    const onVisible = () => document.visibilityState === 'visible' && pull()
    const onMsg = (e: MessageEvent) => e.data?.type === 'navigate' && setView(e.data.hash as View)
    document.addEventListener('visibilitychange', onVisible)
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      navigator.serviceWorker?.removeEventListener('message', onMsg)
    }
  }, [dispatch])

  const unread = state.notifications.filter((n) => !n.read).length

  const loadDemo = () => {
    if (state.transactions.length && !confirm('Replace your current data with demo data?')) return
    dispatch({ type: 'state/replace', state: demoState({ ...state, rules: [] }) })
    setView('dashboard')
    toast('Demo data loaded')
  }

  const closeModal = useCallback(() => setModal(null), [])

  const nav = (cls: string) => (
    <nav className={cls} aria-label="Main">
      {cls === 'sidebar' && (
        <div className="brand">
          <span className="brand-mark">
            <Wallet size={16} />
          </span>
          Cardwise
        </div>
      )}
      {NAV.map((n) => (
        <button key={n.id} className="nav-btn" aria-current={view === n.id ? 'page' : undefined} onClick={() => setView(n.id)}>
          <span className="nav-icon">
            <n.icon size={18} />
            {n.id === 'alerts' && unread > 0 && <i className="badge">{unread > 99 ? '99+' : unread}</i>}
          </span>
          {n.label}
        </button>
      ))}
      {cls === 'sidebar' && <div className="sidebar-foot">Local-first · your data never leaves this device.</div>}
    </nav>
  )

  return (
    <div className="app">
      {nav('sidebar')}
      <main className="main">
        {view === 'dashboard' && (
          <Dashboard
            onAddCard={() => setModal({ kind: 'card' })}
            onEditCard={(card) => setModal({ kind: 'card', card })}
            onAddTx={() => setModal({ kind: 'tx' })}
            onLoadDemo={loadDemo}
            onWidget={(widget) => setModal({ kind: 'widget', widget })}
            onOpenAlerts={() => setView('alerts')}
          />
        )}
        {view === 'cards' && (
          <Cards
            onAdd={() => setModal({ kind: 'card' })}
            onEdit={(card) => setModal({ kind: 'card', card })}
            onAlert={(c) => setModal({ kind: 'alert', cardId: c.id })}
            onOpen={(c) => {
              setFilter({ ...EMPTY_FILTER, cardId: c.id })
              setView('transactions')
            }}
          />
        )}
        {view === 'transactions' && (
          <Transactions
            filter={filter}
            setFilter={setFilter}
            onAdd={() => setModal({ kind: 'tx', cardId: filter.cardId || undefined })}
            onEdit={(tx) => setModal({ kind: 'tx', tx })}
            onImport={() => setModal({ kind: 'import' })}
          />
        )}
        {view === 'payments' && <Payments onEditCard={(card) => setModal({ kind: 'card', card })} toast={toast} />}
        {view === 'insights' && (
          <Insights
            onEditCard={(id) => {
              const card = state.cards.find((c) => c.id === id)
              if (card) setModal({ kind: 'card', card })
            }}
          />
        )}
        {view === 'alerts' && <Alerts onNew={() => setModal({ kind: 'alert' })} onEdit={(alert) => setModal({ kind: 'alert', alert })} />}
        {view === 'budgets' && <Budgets />}
        {view === 'settings' && <Settings onLoadDemo={loadDemo} toast={toast} />}
      </main>
      {nav('tabbar')}

      {modal?.kind === 'card' && <CardForm card={modal.card} onClose={closeModal} />}
      {modal?.kind === 'tx' && <TransactionForm tx={modal.tx} defaultCardId={modal.cardId} onClose={closeModal} />}
      {modal?.kind === 'widget' && <WidgetBuilder widget={modal.widget} onClose={closeModal} />}
      {modal?.kind === 'alert' && <AlertForm alert={modal.alert} defaultCardId={modal.cardId} onClose={closeModal} />}
      {modal?.kind === 'import' && <ImportDialog onClose={closeModal} onDone={(n) => toast(`Imported ${n} transactions`)} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  )
}
