import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { CardVisual } from '../components/CardVisual'
import { Modal } from '../components/Modal'
import { SPEND_CATEGORIES } from '../domain/categories'
import type { Card, CardTheme, CategoryId, Rewards } from '../domain/types'
import { uid } from '../lib/format'
import { useStore } from '../store/store'

const THEMES: CardTheme[] = ['aurora', 'midnight', 'sunset', 'ocean', 'graphite', 'rose']

export function CardForm({ card, onClose }: { card?: Card; onClose: () => void }) {
  const { dispatch } = useStore()
  const [c, setC] = useState<Card>(() =>
    card ?? {
      id: uid(),
      nickname: '',
      issuer: '',
      kind: 'credit',
      network: 'visa',
      last4: '',
      holder: '',
      expiry: '',
      theme: THEMES[Math.floor(Math.random() * THEMES.length)],
      creditLimit: undefined,
      statementDay: undefined,
      createdAt: new Date().toISOString(),
    },
  )
  const set = <K extends keyof Card>(k: K, v: Card[K]) => setC((p) => ({ ...p, [k]: v }))
  const valid = /^\d{4}$/.test(c.last4) && c.nickname.trim() !== ''
  const r: Rewards = c.rewards ?? { base: 0, rates: {} }
  const points = r.unit === 'points'
  const unit = points ? 'x' : '%'
  const setRewards = (patch: Partial<Rewards>) => set('rewards', { ...r, ...patch })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    const out: Card = c.kind === 'debit' ? { ...c, creditLimit: undefined, statementDay: undefined, dueDay: undefined, annualFee: undefined } : c
    dispatch({ type: 'card/upsert', card: out })
    onClose()
  }

  return (
    <Modal title={card ? 'Edit card' : 'Add a card'} onClose={onClose}>
      <form onSubmit={submit}>
        <div style={{ maxWidth: 340, margin: '0 auto 20px' }}>
          <CardVisual card={{ ...c, last4: c.last4.padEnd(4, '•') }} />
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Nickname *</span>
            <input className="input" value={c.nickname} onChange={(e) => set('nickname', e.target.value)} placeholder="Daily driver" autoFocus />
          </label>
          <label className="field">
            <span>Issuer / bank</span>
            <input className="input" value={c.issuer} onChange={(e) => set('issuer', e.target.value)} placeholder="Chase Sapphire" />
          </label>
          <label className="field">
            <span>Type</span>
            <select className="select" value={c.kind} onChange={(e) => set('kind', e.target.value as Card['kind'])}>
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
            </select>
          </label>
          <label className="field">
            <span>Network</span>
            <select className="select" value={c.network} onChange={(e) => set('network', e.target.value as Card['network'])}>
              <option value="visa">Visa</option>
              <option value="mastercard">Mastercard</option>
              <option value="amex">American Express</option>
              <option value="discover">Discover</option>
              <option value="rupay">RuPay</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="field">
            <span>Last 4 digits *</span>
            <input
              className="input num"
              inputMode="numeric"
              maxLength={4}
              value={c.last4}
              onChange={(e) => set('last4', e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
            />
          </label>
          <label className="field">
            <span>Expiry (MM/YY)</span>
            <input
              className="input num"
              maxLength={5}
              value={c.expiry}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, '').slice(0, 4)
                set('expiry', d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d)
              }}
              placeholder="08/29"
            />
          </label>
          <label className="field full">
            <span>Card holder</span>
            <input className="input" value={c.holder} onChange={(e) => set('holder', e.target.value)} placeholder="Name on card" />
          </label>
          {c.kind === 'credit' && (
            <>
              <label className="field">
                <span>Credit limit</span>
                <input
                  className="input num"
                  type="number"
                  min={0}
                  value={c.creditLimit ?? ''}
                  onChange={(e) => set('creditLimit', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="5000"
                />
              </label>
              <label className="field">
                <span>Statement day</span>
                <input
                  className="input num"
                  type="number"
                  min={1}
                  max={31}
                  value={c.statementDay ?? ''}
                  onChange={(e) => set('statementDay', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="15"
                />
              </label>
            </>
          )}
          {c.kind === 'credit' && (
            <>
              <label className="field">
                <span>Payment due day</span>
                <input
                  className="input num"
                  type="number"
                  min={1}
                  max={31}
                  value={c.dueDay ?? ''}
                  onChange={(e) => set('dueDay', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Est. 25 days after close"
                />
              </label>
              <label className="field">
                <span>Annual fee</span>
                <input
                  className="input num"
                  type="number"
                  min={0}
                  value={c.annualFee ?? ''}
                  onChange={(e) => set('annualFee', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="0"
                />
              </label>
            </>
          )}
          <div className="field full rewards-box">
            <span>Rewards</span>
            <div className="row" style={{ gap: 10 }}>
              <div className="segmented" role="group" aria-label="Reward type">
                <button type="button" aria-pressed={!points} onClick={() => setRewards({ unit: 'cashback' })}>
                  Cash back
                </button>
                <button type="button" aria-pressed={points} onClick={() => setRewards({ unit: 'points', pointValue: r.pointValue ?? 1 })}>
                  Points / miles
                </button>
              </div>
              {points && (
                <>
                  <input
                    className="input"
                    style={{ flex: 1, minWidth: 140 }}
                    value={r.program ?? ''}
                    onChange={(e) => setRewards({ program: e.target.value || undefined })}
                    placeholder="Program, e.g. Ultimate Rewards"
                    aria-label="Program name"
                  />
                  <label className="row" style={{ gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
                    1 pt =
                    <input
                      className="input num"
                      style={{ width: 76 }}
                      type="number"
                      min={0}
                      step={0.05}
                      value={r.pointValue ?? ''}
                      onChange={(e) => setRewards({ pointValue: e.target.value === '' ? undefined : Number(e.target.value) })}
                      aria-label="Cents per point"
                    />
                    ¢
                  </label>
                </>
              )}
            </div>
            {points && (
              <small className="faint">
                What a point is worth to you depends on how you redeem (cash out ≈1¢, travel transfers often more). Cardwise multiplies earn rate × this value so
                points and cash back compare fairly.
              </small>
            )}
            <div className="rate-grid" style={{ marginTop: 6 }}>
              <label className="rate-cell base">
                <i style={{ background: 'var(--text-3)' }} />
                <span>Everything else</span>
                <span className="unit-input">
                  <input
                    className="input num"
                    type="number"
                    min={0}
                    step={0.25}
                    value={c.rewards?.base ?? ''}
                    placeholder="0"
                    onChange={(e) => setRewards({ base: Number(e.target.value) || 0 })}
                  />
                  <em>{unit}</em>
                </span>
              </label>
              {SPEND_CATEGORIES.filter((x) => x.id !== 'other').map((x) => (
                <label key={x.id} className="rate-cell">
                  <i style={{ background: x.color }} />
                  <span>{x.label}</span>
                  <span className="unit-input">
                    <input
                      className="input num"
                      type="number"
                      min={0}
                      step={0.25}
                      value={c.rewards?.rates[x.id] ?? ''}
                      placeholder={String(c.rewards?.base ?? 0)}
                      onChange={(e) => {
                        const rates: Partial<Record<CategoryId, number>> = { ...r.rates }
                        if (e.target.value === '') delete rates[x.id]
                        else rates[x.id] = Number(e.target.value)
                        setRewards({ rates })
                      }}
                    />
                    <em>{unit}</em>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="field full">
            <span>Style</span>
            <div className="theme-swatches">
              {THEMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`swatch pcard ${t}`}
                  style={{ aspectRatio: 'auto', boxShadow: 'none' }}
                  aria-pressed={c.theme === t}
                  aria-label={t}
                  onClick={() => set('theme', t)}
                />
              ))}
            </div>
          </div>
        </div>
        <p className="faint" style={{ fontSize: 12, marginTop: 14 }}>
          Cardwise only stores the last 4 digits. Never enter a full card number or CVV.
        </p>
        <div className="modal-foot">
          {card && (
            <button
              type="button"
              className="btn btn-ghost btn-danger left"
              onClick={() => {
                if (confirm(`Delete ${card.nickname} and all its transactions?`)) {
                  dispatch({ type: 'card/delete', id: card.id })
                  onClose()
                }
              }}
            >
              <Trash2 size={15} /> Delete
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            {card ? 'Save' : 'Add card'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
