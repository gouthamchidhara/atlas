import { BellRing, History, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import { CATEGORIES } from '../domain/categories'
import type { AlertKind, AlertRule, AlertTrigger, CategoryId } from '../domain/types'
import { todayISO, uid } from '../lib/format'
import { addDays } from '../lib/period'
import { useStore } from '../store/store'
import { describeTrigger, evaluate } from './engine'
import { ALERT_PRESETS, KIND_LABEL } from './presets'

const DEFAULTS: Record<AlertKind, AlertTrigger> = {
  'large-tx': { kind: 'large-tx', amount: 200 },
  merchant: { kind: 'merchant', query: '' },
  'new-merchant': { kind: 'new-merchant' },
  'category-spend': { kind: 'category-spend', category: 'dining', mode: 'budget-percent', value: 80 },
  'card-spend': { kind: 'card-spend', amount: 1000 },
  utilization: { kind: 'utilization', percent: 30 },
  'statement-soon': { kind: 'statement-soon', days: 3 },
  expiring: { kind: 'expiring', days: 60 },
  'subscription-change': { kind: 'subscription-change' },
  'better-card': { kind: 'better-card', minMissed: 1 },
}

const CREDIT_ONLY: AlertKind[] = ['utilization', 'statement-soon']

export function AlertForm({ alert, defaultCardId, onClose }: { alert?: AlertRule; defaultCardId?: string; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const today = todayISO()
  const [r, setR] = useState<AlertRule>(
    () =>
      alert ?? {
        id: uid(),
        name: '',
        cardId: defaultCardId ?? '',
        trigger: DEFAULTS['large-tx'],
        enabled: true,
        push: false,
        createdAt: new Date().toISOString(),
      },
  )
  const [backfill, setBackfill] = useState(false)
  const t = r.trigger
  const setT = (patch: Partial<AlertTrigger>) => setR((p) => ({ ...p, trigger: { ...p.trigger, ...patch } as AlertTrigger }))
  const card = state.cards.find((c) => c.id === r.cardId)
  const creditMismatch = CREDIT_ONLY.includes(t.kind) && card && card.kind !== 'credit'

  // Backtest: what would this rule have said over the last 30 days?
  const backtest = useMemo(() => {
    const probe: AlertRule = { ...r, enabled: true, createdAt: addDays(today, -30) }
    return evaluate({ ...state, alerts: [probe] }, today)
  }, [r, state, today])

  const save = () => {
    const name = r.name.trim() || KIND_LABEL[t.kind]
    const createdAt = backfill && !alert ? addDays(today, -30) : r.createdAt
    dispatch({ type: 'alert/upsert', alert: { ...r, name, createdAt } })
    if (r.push && 'Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
    onClose()
  }

  const num = (label: string, value: number, onChange: (n: number) => void, suffix?: string) => (
    <label className="field">
      <span>
        {label}
        {suffix ? ` (${suffix})` : ''}
      </span>
      <input className="input num" type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )

  return (
    <Modal title={alert ? 'Edit alert' : 'Create an alert'} onClose={onClose} wide>
      {!alert && (
        <div className="preset-strip">
          {ALERT_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="preset"
              aria-pressed={r.name === p.name}
              onClick={() => {
                const cardId = p.creditOnly && card?.kind !== 'credit' ? (state.cards.find((c) => c.kind === 'credit')?.id ?? '') : r.cardId
                setR({ ...r, name: p.name, trigger: p.trigger, cardId })
              }}
            >
              <b>{p.name}</b>
              <span>{p.blurb}</span>
            </button>
          ))}
        </div>
      )}
      <div className="builder">
        <div className="builder-form">
          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input className="input" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} placeholder={KIND_LABEL[t.kind]} />
            </label>
            <label className="field">
              <span>Card</span>
              <select className="select" value={r.cardId} onChange={(e) => setR({ ...r, cardId: e.target.value })}>
                <option value="">Any card</option>
                {state.cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nickname} ••{c.last4}
                  </option>
                ))}
              </select>
            </label>
            <label className="field full">
              <span>When</span>
              <select className="select" value={t.kind} onChange={(e) => setR({ ...r, trigger: DEFAULTS[e.target.value as AlertKind] })}>
                {(Object.keys(KIND_LABEL) as AlertKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            {t.kind === 'large-tx' && num('Amount at least', t.amount, (amount) => setT({ amount }), state.settings.currency)}
            {t.kind === 'card-spend' && num('Monthly spend passes', t.amount, (amount) => setT({ amount }), state.settings.currency)}
            {t.kind === 'utilization' && num('Utilization at least', t.percent, (percent) => setT({ percent }), '%')}
            {t.kind === 'statement-soon' && num('Days before close', t.days, (days) => setT({ days }))}
            {t.kind === 'expiring' && num('Days before expiry', t.days, (days) => setT({ days }))}
            {t.kind === 'better-card' && num('Missed reward at least', t.minMissed, (minMissed) => setT({ minMissed }), state.settings.currency)}
            {t.kind === 'merchant' && (
              <label className="field">
                <span>Merchant contains</span>
                <input className="input" value={t.query} onChange={(e) => setT({ query: e.target.value })} placeholder="amazon" />
              </label>
            )}
            {t.kind === 'category-spend' && (
              <>
                <label className="field">
                  <span>Category</span>
                  <select className="select" value={t.category} onChange={(e) => setT({ category: e.target.value as CategoryId })}>
                    {CATEGORIES.filter((c) => c.id !== 'income').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Threshold</span>
                  <select className="select" value={t.mode} onChange={(e) => setT({ mode: e.target.value as 'amount' | 'budget-percent' })}>
                    <option value="budget-percent">% of budget</option>
                    <option value="amount">Fixed amount</option>
                  </select>
                </label>
                {num(t.mode === 'amount' ? 'Amount' : 'Percent of budget', t.value, (value) => setT({ value }), t.mode === 'amount' ? state.settings.currency : '%')}
                {t.mode === 'budget-percent' && !state.budgets[t.category] && <p className="warn-note full">No budget set for this category yet — set one on the Budgets page.</p>}
              </>
            )}
          </div>
          {creditMismatch && <p className="warn-note">This trigger only applies to credit cards.</p>}
          <div className="toggles">
            <label className="toggle">
              <input type="checkbox" checked={r.push} onChange={(e) => setR({ ...r, push: e.target.checked })} />
              <span />
              <div>
                <b>Push notification</b>
                <small>Also show a system notification (asks browser permission)</small>
              </div>
            </label>
            {!alert && (
              <label className="toggle">
                <input type="checkbox" checked={backfill} onChange={(e) => setBackfill(e.target.checked)} />
                <span />
                <div>
                  <b>Include the last 30 days</b>
                  <small>Otherwise only purchases from now on are checked</small>
                </div>
              </label>
            )}
          </div>
        </div>
        <div className="builder-preview">
          <div className="hero-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <History size={13} /> Backtest · last 30 days
          </div>
          <div className="panel" style={{ padding: 16 }}>
            <p className="muted" style={{ marginTop: 0 }}>
              <BellRing size={14} style={{ verticalAlign: -2 }} /> {describeTrigger(r, state)}
              {card ? ` on ${card.nickname}` : ' on any card'}.
            </p>
            <div className="backtest-count">
              <b className="num">{backtest.length}</b> {backtest.length === 1 ? 'alert' : 'alerts'} would have fired
            </div>
            <div className="notif-list compact">
              {backtest.slice(0, 3).map((n) => (
                <div key={n.key} className={`notif sev-${n.severity}`}>
                  <div>
                    <b>{n.title}</b>
                    <p>{n.body}</p>
                  </div>
                </div>
              ))}
            </div>
            {backtest.length === 0 && <p className="faint" style={{ fontSize: 12 }}>Quiet rule — nothing recent matches. Good for rare events.</p>}
            {backtest.length > 8 && <p className="warn-note">Noisy: consider a higher threshold.</p>}
          </div>
        </div>
      </div>
      <div className="modal-foot">
        {alert && (
          <button
            type="button"
            className="btn btn-ghost btn-danger left"
            onClick={() => {
              dispatch({ type: 'alert/delete', id: alert.id })
              onClose()
            }}
          >
            <Trash2 size={15} /> Delete
          </button>
        )}
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={t.kind === 'merchant' && !t.query.trim()}>
          {alert ? 'Save' : 'Create alert'}
        </button>
      </div>
    </Modal>
  )
}
