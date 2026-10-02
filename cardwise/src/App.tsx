import { CreditCard, LayoutDashboard, ListOrdered, PiggyBank, Settings as Cog, Wallet } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Card, CategoryId, Transaction } from './domain/types'
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
import { monthKey, todayISO } from './lib/format'

type View = 'dashboard' | 'cards' | 'transactions' | 'budgets' | 'settings'

const NAV: { id: View; label: string; icon: typeof Wallet }[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'cards', label: 'Cards', icon: CreditCard },
  { id: 'transactions', label: 'Activity', icon: ListOrdered },
  { id: 'budgets', label: 'Budgets', icon: PiggyBank },
  { id: 'settings', label: 'Settings', icon: Cog },
]

type ModalState =
  | { kind: 'card'; card?: Card }
  | { kind: 'tx'; tx?: Transaction; cardId?: string }
  | { kind: 'import' }
  | null

export default function App() {
  const { state, dispatch } = useStore()
  const [view, setView] = useState<View>(() => {
    const h = location.hash.slice(1) as View
    return NAV.some((n) => n.id === h) ? h : 'dashboard'
  })
  const [modal, setModal] = useState<ModalState>(null)
  const [filter, setFilter] = useState<TxFilter>(EMPTY_FILTER)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  useEffect(() => {
    history.replaceState(null, '', `#${view}`)
    window.scrollTo({ top: 0 })
  }, [view])

  useEffect(() => {
    const t = state.settings.theme
    if (t === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', t)
  }, [state.settings.theme])

  const toast = useCallback((m: string) => {
    setToastMsg(m)
    window.setTimeout(() => setToastMsg(null), 2400)
  }, [])

  const loadDemo = () => {
    if (state.transactions.length && !confirm('Replace your current data with demo data?')) return
    dispatch({ type: 'state/replace', state: demoState({ ...state, rules: [] }) })
    setView('dashboard')
    toast('Demo data loaded')
  }

  const openCategory = (category: CategoryId) => {
    setFilter({ ...EMPTY_FILTER, category, month: monthKey(todayISO()) })
    setView('transactions')
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
          <n.icon size={18} />
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
            onOpenCategory={openCategory}
            onSeeAll={() => {
              setFilter(EMPTY_FILTER)
              setView('transactions')
            }}
            onLoadDemo={loadDemo}
          />
        )}
        {view === 'cards' && (
          <Cards
            onAdd={() => setModal({ kind: 'card' })}
            onEdit={(card) => setModal({ kind: 'card', card })}
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
        {view === 'budgets' && <Budgets />}
        {view === 'settings' && <Settings onLoadDemo={loadDemo} toast={toast} />}
      </main>
      {nav('tabbar')}

      {modal?.kind === 'card' && <CardForm card={modal.card} onClose={closeModal} />}
      {modal?.kind === 'tx' && <TransactionForm tx={modal.tx} defaultCardId={modal.cardId} onClose={closeModal} />}
      {modal?.kind === 'import' && <ImportDialog onClose={closeModal} onDone={(n) => toast(`Imported ${n} transactions`)} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  )
}
