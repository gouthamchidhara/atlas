import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Modal } from '../components/Modal'
import { CATEGORIES, categorize } from '../domain/categories'
import type { CategoryId, Transaction } from '../domain/types'
import { todayISO, uid } from '../lib/format'
import { useStore } from '../store/store'

export function TransactionForm({ tx, defaultCardId, onClose }: { tx?: Transaction; defaultCardId?: string; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [direction, setDirection] = useState<'out' | 'in'>(tx && tx.amount < 0 ? 'in' : 'out')
  const [merchant, setMerchant] = useState(tx?.merchant ?? '')
  const [amount, setAmount] = useState(tx ? String(Math.abs(tx.amount)) : '')
  const [date, setDate] = useState(tx?.date ?? todayISO())
  const [cardId, setCardId] = useState(tx?.cardId ?? defaultCardId ?? state.cards[0]?.id ?? '')
  const [note, setNote] = useState(tx?.note ?? '')
  const [category, setCategory] = useState<CategoryId | 'auto'>(tx?.manualCategory ? tx.category : 'auto')

  const signed = (direction === 'out' ? 1 : -1) * Number(amount || 0)
  const guessed = categorize(merchant, signed, state.rules)
  const valid = merchant.trim() && Number(amount) > 0 && cardId && date

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    dispatch({
      type: 'tx/upsert',
      tx: {
        id: tx?.id ?? uid(),
        cardId,
        date,
        merchant: merchant.trim(),
        amount: signed,
        category: category === 'auto' ? guessed : category,
        manualCategory: category !== 'auto',
        note: note.trim() || undefined,
      },
    })
    onClose()
  }

  if (!state.cards.length)
    return (
      <Modal title="Add transaction" onClose={onClose}>
        <div className="empty">Add a card first, then log purchases against it.</div>
      </Modal>
    )

  return (
    <Modal title={tx ? 'Edit transaction' : 'Add transaction'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="row" style={{ marginBottom: 16 }}>
          <div className="segmented" role="group" aria-label="Direction">
            <button type="button" aria-pressed={direction === 'out'} onClick={() => setDirection('out')}>
              <ArrowUpRight size={13} style={{ verticalAlign: -2 }} /> Purchase
            </button>
            <button type="button" aria-pressed={direction === 'in'} onClick={() => setDirection('in')}>
              <ArrowDownLeft size={13} style={{ verticalAlign: -2 }} /> Refund / payment
            </button>
          </div>
        </div>
        <div className="form-grid">
          <label className="field full">
            <span>Merchant *</span>
            <input className="input" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Starbucks" autoFocus />
          </label>
          <label className="field">
            <span>Amount ({state.settings.currency}) *</span>
            <input className="input num" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </label>
          <label className="field">
            <span>Date *</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Card *</span>
            <select className="select" value={cardId} onChange={(e) => setCardId(e.target.value)}>
              {state.cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nickname} ••{c.last4}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Category</span>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value as CategoryId | 'auto')}>
              <option value="auto">Auto · {CATEGORIES.find((c) => c.id === guessed)?.label}</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field full">
            <span>Note</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </label>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            {tx ? 'Save' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
