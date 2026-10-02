import { BellRing, Download, MonitorSmartphone, Plus, RefreshCw, Trash2, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CategoryIcon } from '../components/CategoryIcon'
import { CATEGORIES, category } from '../domain/categories'
import type { AppState, CategoryId, Settings as S } from '../domain/types'
import { EMPTY, useStore } from '../store/store'
import {
  canInstall,
  isIOS,
  isStandalone,
  lastBackgroundCheck,
  onPwaChange,
  promptInstall,
  runBackgroundCheckNow,
  setupBackgroundChecks,
  takePending,
  type BackgroundStatus,
} from '../lib/pwa'

const BG_TEXT: Record<BackgroundStatus, string> = {
  active: 'On — your browser runs alert checks a few times a day, even with Cardwise closed.',
  'install-needed': 'Install Cardwise as an app to allow checks while it’s closed. Until then, alerts run whenever it’s open.',
  'permission-needed': 'The browser hasn’t granted background sync yet (it decides based on how often you use the app). Alerts run whenever it’s open.',
  unsupported: 'This browser doesn’t support background checks (only Chromium-based browsers do). Alerts run whenever Cardwise is open.',
  'no-worker': 'Background worker not running (it’s disabled in dev mode). Alerts run whenever Cardwise is open.',
}

function AppPanel({ toast }: { toast: (m: string) => void }) {
  const { state, dispatch } = useStore()
  const [, force] = useState(0)
  const [bg, setBg] = useState<BackgroundStatus | null>(null)
  const [last, setLast] = useState<string | undefined>()
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  useEffect(() => onPwaChange(() => force((n) => n + 1)), [])
  useEffect(() => {
    void setupBackgroundChecks().then(setBg)
    void lastBackgroundCheck().then(setLast)
  }, [])
  const installed = isStandalone()

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>App & background alerts</h2>
          <div className="sub">Install on your phone or desktop; works offline.</div>
        </div>
      </div>
      <div className="setting-row">
        <MonitorSmartphone size={18} />
        <div style={{ flex: 1 }}>
          <b>Install</b>
          <div className="faint">
            {installed
              ? 'Running as an installed app.'
              : canInstall()
                ? 'Add Cardwise to your home screen or dock.'
                : isIOS()
                  ? 'In Safari: Share → Add to Home Screen.'
                  : 'Use your browser’s “Install app” menu item (not offered on every browser).'}
          </div>
        </div>
        {!installed && canInstall() && (
          <button className="btn btn-primary" onClick={() => void promptInstall()}>
            Install
          </button>
        )}
      </div>
      <div className="setting-row">
        <BellRing size={18} />
        <div style={{ flex: 1 }}>
          <b>System notifications</b>
          <div className="faint">
            {perm === 'granted'
              ? 'Allowed. Rules with “Push” on will notify you.'
              : perm === 'denied'
                ? 'Blocked in browser settings — re-enable them there.'
                : perm === 'unsupported'
                  ? 'Not supported here. On iPhone, install the app first (iOS 16.4+).'
                  : 'Not enabled yet.'}
          </div>
        </div>
        {perm === 'default' && (
          <button className="btn" onClick={() => void Notification.requestPermission().then(setPerm)}>
            Allow
          </button>
        )}
      </div>
      <div className="setting-row">
        <RefreshCw size={18} />
        <div style={{ flex: 1 }}>
          <b>Background checks</b>
          <div className="faint">{bg ? BG_TEXT[bg] : 'Checking…'}</div>
          {last && <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>Last background run: {new Date(last).toLocaleString(state.settings.locale)}</div>}
        </div>
        {bg !== 'no-worker' && bg !== null && (
          <button
            className="btn"
            onClick={async () => {
              const n = await runBackgroundCheckNow()
              const pending = await takePending()
              if (pending.length) dispatch({ type: 'notif/fire', candidates: pending, now: new Date().toISOString() })
              void lastBackgroundCheck().then(setLast)
              toast(n === null ? 'Background worker didn’t respond' : n ? `Background check found ${n} new` : 'Background check: nothing new')
            }}
          >
            Run now
          </button>
        )}
      </div>
    </section>
  )
}

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

        <AppPanel toast={toast} />

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
