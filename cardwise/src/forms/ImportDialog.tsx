import { FileUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CategoryIcon } from '../components/CategoryIcon'
import { Modal } from '../components/Modal'
import { categorize } from '../domain/categories'
import type { Transaction } from '../domain/types'
import { normalizeDate, parseAmount, parseCSV } from '../lib/csv'
import { money, uid } from '../lib/format'
import { useStore } from '../store/store'

type Col = number | -1

const guess = (headers: string[], words: string[]): Col =>
  headers.findIndex((h) => words.some((w) => h.toLowerCase().includes(w)))

/**
 * Import a bank/card CSV export. Columns are auto-detected and can be remapped.
 * Positive amounts are treated as purchases unless "flip sign" is on (some banks export spend as negative).
 */
export function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: (n: number) => void }) {
  const { state, dispatch } = useStore()
  const [rows, setRows] = useState<string[][] | null>(null)
  const [fileName, setFileName] = useState('')
  const [cardId, setCardId] = useState(state.cards[0]?.id ?? '')
  const [cols, setCols] = useState<{ date: Col; merchant: Col; amount: Col; debit: Col; credit: Col }>({ date: -1, merchant: -1, amount: -1, debit: -1, credit: -1 })
  const [flip, setFlip] = useState(false)
  const [skipDupes, setSkipDupes] = useState(true)

  const headers = rows?.[0] ?? []

  const onFile = async (f: File) => {
    const parsed = parseCSV(await f.text())
    setFileName(f.name)
    setRows(parsed)
    const h = parsed[0] ?? []
    setCols({
      date: guess(h, ['date', 'posted']),
      merchant: guess(h, ['description', 'merchant', 'payee', 'name', 'details']),
      amount: guess(h, ['amount', 'value']),
      debit: guess(h, ['debit', 'withdrawal']),
      credit: guess(h, ['credit', 'deposit']),
    })
  }

  const preview = useMemo<Transaction[]>(() => {
    if (!rows || cols.date < 0 || cols.merchant < 0) return []
    const out: Transaction[] = []
    for (const r of rows.slice(1)) {
      const date = normalizeDate(r[cols.date] ?? '')
      const merchant = (r[cols.merchant] ?? '').trim()
      let amount: number | null = null
      if (cols.amount >= 0) amount = parseAmount(r[cols.amount] ?? '')
      else {
        const d = cols.debit >= 0 ? parseAmount(r[cols.debit] ?? '') : null
        const c = cols.credit >= 0 ? parseAmount(r[cols.credit] ?? '') : null
        amount = d ? Math.abs(d) : c ? -Math.abs(c) : null
      }
      if (!date || !merchant || amount === null || amount === 0) continue
      if (flip) amount = -amount
      out.push({ id: uid(), cardId, date, merchant, amount, category: categorize(merchant, amount, state.rules) })
    }
    if (!skipDupes) return out
    const seen = new Set(state.transactions.map((t) => `${t.cardId}|${t.date}|${t.merchant}|${t.amount}`))
    return out.filter((t) => !seen.has(`${t.cardId}|${t.date}|${t.merchant}|${t.amount}`))
  }, [rows, cols, flip, cardId, skipDupes, state.rules, state.transactions])

  const colSelect = (key: keyof typeof cols, label: string) => (
    <label className="field">
      <span>{label}</span>
      <select className="select" value={cols[key]} onChange={(e) => setCols({ ...cols, [key]: Number(e.target.value) })}>
        <option value={-1}>—</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h || `Column ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <Modal title="Import CSV statement" onClose={onClose}>
      {!state.cards.length ? (
        <div className="empty">Add a card first so imported rows have a home.</div>
      ) : !rows ? (
        <label className="add-card" style={{ aspectRatio: 'auto', padding: 36, cursor: 'pointer' }}>
          <FileUp size={28} />
          <span>Choose a .csv export from your bank</span>
          <span className="faint" style={{ fontWeight: 400, fontSize: 12 }}>
            Parsed locally in your browser — nothing is uploaded.
          </span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            <b>{fileName}</b> · {rows.length - 1} rows
          </p>
          <div className="form-grid">
            <label className="field full">
              <span>Import into card</span>
              <select className="select" value={cardId} onChange={(e) => setCardId(e.target.value)}>
                {state.cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nickname} ••{c.last4}
                  </option>
                ))}
              </select>
            </label>
            {colSelect('date', 'Date column')}
            {colSelect('merchant', 'Description column')}
            {colSelect('amount', 'Amount column')}
            {cols.amount < 0 && colSelect('debit', 'Debit column')}
            {cols.amount < 0 && colSelect('credit', 'Credit column')}
          </div>
          <div className="row" style={{ margin: '14px 0' }}>
            <label className="chip">
              <input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} /> Flip sign (bank shows spend as negative)
            </label>
            <label className="chip">
              <input type="checkbox" checked={skipDupes} onChange={(e) => setSkipDupes(e.target.checked)} /> Skip duplicates
            </label>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((t) => (
                  <tr key={t.id}>
                    <td className="num">{t.date}</td>
                    <td>{t.merchant}</td>
                    <td>
                      <span className="row" style={{ gap: 6 }}>
                        <span style={{ transform: 'scale(0.7)', display: 'inline-flex' }}>
                          <CategoryIcon id={t.category} />
                        </span>
                        {t.category}
                      </span>
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {money(t.amount, state.settings)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="faint" style={{ fontSize: 12 }}>
            {preview.length} transactions ready{preview.length > 50 ? ' (showing first 50)' : ''}.
          </p>
        </>
      )}
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          disabled={!preview.length}
          onClick={() => {
            dispatch({ type: 'tx/import', txs: preview })
            onDone(preview.length)
            onClose()
          }}
        >
          Import {preview.length || ''}
        </button>
      </div>
    </Modal>
  )
}
