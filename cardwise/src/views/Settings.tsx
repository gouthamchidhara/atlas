import { Download, Plus, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { CategoryIcon } from '../components/CategoryIcon'
import { CATEGORIES, category } from '../domain/categories'
import type { AppState, CategoryId, Settings as S } from '../domain/types'
import { EMPTY, useStore } from '../store/store'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'SGD', 'AED', 'CHF']

export function Settings({ onLoadDemo, toast }: { onLoadDemo: () => void; toast: (m: string) => void }) {
  const { state, dispatch } = useStore()
  const [pattern, setPattern] = useState('')
  const [cat, setCat] = useState<CategoryId>('dining')
  const [apply, setApply] = useState(true)

  const backup = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }))
    a.download = `cardwise-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const restore = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as AppState
      if (!Array.isArray(data.cards) || !Array.isArray(data.transactions)) throw new Error('bad file')
      dispatch({ type: 'state/replace', state: { ...EMPTY, ...data, settings: { ...EMPTY.settings, ...data.settings } } })
      toast('Backup restored')
    } catch {
      toast('That file is not a Cardwise backup')
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Everything is stored locally in this browser.</p>
        </div>
      </div>
      <div className="grid" style={{ maxWidth: 760 }}>
        <section className="panel">
          <div className="panel-head">
            <h2>Preferences</h2>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Currency</span>
              <select className="select" value={state.settings.currency} onChange={(e) => dispatch({ type: 'settings/set', settings: { currency: e.target.value } })}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <div className="field">
              <span>Appearance</span>
              <div className="segmented" role="group" aria-label="Theme">
                {(['system', 'light', 'dark'] as S['theme'][]).map((t) => (
                  <button key={t} aria-pressed={state.settings.theme === t} onClick={() => dispatch({ type: 'settings/set', settings: { theme: t } })}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Categorization rules</h2>
              <div className="sub">If the merchant contains the text, use this category. Rules beat built-in guesses.</div>
            </div>
          </div>
          <form
            className="row"
            style={{ marginBottom: 14 }}
            onSubmit={(e) => {
              e.preventDefault()
              if (!pattern.trim()) return
              dispatch({ type: 'rule/add', pattern, category: cat, applyToExisting: apply })
              setPattern('')
              toast('Rule added')
            }}
          >
            <input className="input" style={{ flex: 2, minWidth: 160 }} placeholder='Merchant contains… e.g. "joe’s deli"' value={pattern} onChange={(e) => setPattern(e.target.value)} />
            <select className="select" style={{ flex: 1, minWidth: 140 }} value={cat} onChange={(e) => setCat(e.target.value as CategoryId)}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" type="submit" disabled={!pattern.trim()}>
              <Plus size={15} /> Add rule
            </button>
            <label className="chip">
              <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} /> Re-categorize existing
            </label>
          </form>
          {state.rules.length ? (
            <table className="table">
              <tbody>
                {state.rules.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code>{r.pattern}</code>
                    </td>
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <span style={{ transform: 'scale(0.75)', display: 'inline-flex' }}>
                          <CategoryIcon id={r.category} />
                        </span>
                        {category(r.category).label}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-icon btn-danger" aria-label="Delete rule" onClick={() => dispatch({ type: 'rule/delete', id: r.id })}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="faint">No custom rules yet.</div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Data</h2>
          </div>
          <div className="row">
            <button className="btn" onClick={backup}>
              <Download size={15} /> Backup (JSON)
            </button>
            <label className="btn">
              <Upload size={15} /> Restore
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
            </label>
            <button className="btn" onClick={onLoadDemo}>
              Load demo data
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm('Erase all cards, transactions, budgets and rules? This cannot be undone.')) {
                  dispatch({ type: 'state/replace', state: { ...EMPTY, settings: state.settings } })
                  toast('All data erased')
                }
              }}
            >
              <Trash2 size={15} /> Erase everything
            </button>
          </div>
        </section>
      </div>
    </>
  )
}
