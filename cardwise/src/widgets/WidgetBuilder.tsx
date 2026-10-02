import { BarChart3, CreditCard, Gauge, Hash, LayoutList, ListOrdered, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '../components/Modal'
import { SPEND_CATEGORIES } from '../domain/categories'
import type { CategoryId, GroupBy, Period, WidgetConfig, WidgetMetric, WidgetSize, WidgetViz } from '../domain/types'
import { uid } from '../lib/format'
import { PERIOD_LABEL } from '../lib/period'
import { useStore } from '../store/store'
import { WIDGET_PRESETS } from './presets'
import { scopeLabel, WidgetBody } from './Widget'

const VIZ: { id: WidgetViz; label: string; icon: typeof Hash }[] = [
  { id: 'stat', label: 'Number', icon: Hash },
  { id: 'trend', label: 'Trend', icon: BarChart3 },
  { id: 'breakdown', label: 'Breakdown', icon: LayoutList },
  { id: 'goal', label: 'Goal', icon: Gauge },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'activity', label: 'Activity', icon: ListOrdered },
]

const METRICS: { id: WidgetMetric; label: string }[] = [
  { id: 'spend', label: 'Total spend' },
  { id: 'count', label: '# of purchases' },
  { id: 'avg', label: 'Avg purchase' },
  { id: 'rewards', label: 'Rewards earned' },
]

const BLANK: Omit<WidgetConfig, 'id'> = { title: 'New widget', viz: 'stat', metric: 'spend', period: 'this-month', cardIds: [], categories: [], size: 's' }

export function WidgetBuilder({ widget, onClose }: { widget?: WidgetConfig; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [w, setW] = useState<WidgetConfig>(() => widget ?? { ...BLANK, id: uid() })
  const set = <K extends keyof WidgetConfig>(k: K, v: WidgetConfig[K]) => setW((p) => ({ ...p, [k]: v }))
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const applyPreset = (i: number) => {
    const { blurb: _b, ...p } = WIDGET_PRESETS[i]
    const cardIds = p.viz === 'card' ? [state.cards.find((c) => c.kind === 'credit')?.id ?? state.cards[0]?.id].filter(Boolean) as string[] : p.cardIds
    setW({ ...p, cardIds, id: w.id })
  }

  const save = () => {
    dispatch({ type: 'widget/upsert', widget: { ...w, title: w.title.trim() || 'Widget', merchant: w.merchant?.trim() || undefined } })
    onClose()
  }

  return (
    <Modal title={widget ? 'Edit widget' : 'Build a widget'} onClose={onClose} wide>
      {!widget && (
        <div className="preset-strip" role="list" aria-label="Start from a template">
          {WIDGET_PRESETS.map((p, i) => (
            <button key={p.title} type="button" className="preset" onClick={() => applyPreset(i)} role="listitem">
              <b>{p.title}</b>
              <span>{p.blurb}</span>
            </button>
          ))}
        </div>
      )}
      <div className="builder">
        <div className="builder-form">
          <label className="field">
            <span>Title</span>
            <input className="input" value={w.title} onChange={(e) => set('title', e.target.value)} />
          </label>
          <div className="field">
            <span>Display</span>
            <div className="viz-grid">
              {VIZ.map((v) => (
                <button key={v.id} type="button" className="viz-opt" aria-pressed={w.viz === v.id} onClick={() => set('viz', v.id)}>
                  <v.icon size={16} />
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-grid">
            {w.viz !== 'activity' && w.viz !== 'card' && (
              <label className="field">
                <span>Measure</span>
                <select className="select" value={w.metric} onChange={(e) => set('metric', e.target.value as WidgetMetric)}>
                  {METRICS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>Period</span>
              <select className="select" value={w.period} onChange={(e) => set('period', e.target.value as Period)}>
                {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_LABEL[p]}
                    {p === 'statement' ? ' (1 credit card)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {w.viz === 'breakdown' && (
              <label className="field">
                <span>Group by</span>
                <select className="select" value={w.groupBy ?? 'category'} onChange={(e) => set('groupBy', e.target.value as GroupBy)}>
                  <option value="category">Category</option>
                  <option value="merchant">Merchant</option>
                  <option value="card">Card</option>
                </select>
              </label>
            )}
            {w.viz === 'goal' && (
              <label className="field">
                <span>Target</span>
                <input className="input num" type="number" min={0} value={w.target ?? ''} onChange={(e) => set('target', e.target.value ? Number(e.target.value) : undefined)} placeholder="300" />
              </label>
            )}
            <label className="field">
              <span>Merchant contains</span>
              <input className="input" value={w.merchant ?? ''} onChange={(e) => set('merchant', e.target.value)} placeholder="e.g. starbucks" />
            </label>
            <div className="field">
              <span>Size</span>
              <div className="segmented" role="group" aria-label="Size">
                {(['s', 'm', 'l'] as WidgetSize[]).map((z) => (
                  <button key={z} type="button" aria-pressed={w.size === z} onClick={() => set('size', z)}>
                    {z === 's' ? 'Small' : z === 'm' ? 'Half' : 'Full'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="field">
            <span>Cards {w.cardIds.length ? '' : '· all'}</span>
            <div className="chip-picker">
              {state.cards.map((c) => (
                <button key={c.id} type="button" className="pick" aria-pressed={w.cardIds.includes(c.id)} onClick={() => set('cardIds', w.viz === 'card' ? [c.id] : toggle(w.cardIds, c.id))}>
                  <i className={`pcard ${c.theme}`} />
                  {c.nickname} ••{c.last4}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Categories {w.categories.length ? '' : '· all'}</span>
            <div className="chip-picker">
              {SPEND_CATEGORIES.map((c) => (
                <button key={c.id} type="button" className="pick" aria-pressed={w.categories.includes(c.id)} onClick={() => set('categories', toggle<CategoryId>(w.categories, c.id))}>
                  <i style={{ background: c.color }} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="builder-preview">
          <div className="hero-label" style={{ marginBottom: 8 }}>
            Live preview
          </div>
          <section className="panel widget">
            <div className="panel-head">
              <div style={{ minWidth: 0 }}>
                <h2 className="ellipsis">{w.title || 'Widget'}</h2>
                <div className="sub ellipsis">{scopeLabel(w, state)}</div>
              </div>
            </div>
            <WidgetBody w={w} state={state} />
          </section>
        </div>
      </div>
      <div className="modal-foot">
        {widget && (
          <button
            type="button"
            className="btn btn-ghost btn-danger left"
            onClick={() => {
              dispatch({ type: 'widget/delete', id: widget.id })
              onClose()
            }}
          >
            <Trash2 size={15} /> Remove
          </button>
        )}
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={save}>
          {widget ? 'Save' : 'Add to dashboard'}
        </button>
      </div>
    </Modal>
  )
}
