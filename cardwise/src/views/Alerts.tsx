import { AlertTriangle, Bell, BellOff, BellRing, CheckCheck, Info, OctagonAlert, Pencil, Plus, Smartphone, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { describeTrigger } from '../alerts/engine'
import type { AlertRule, AppNotification, Severity } from '../domain/types'
import { useStore } from '../store/store'

const SEV_ICON: Record<Severity, typeof Info> = { info: Info, warn: AlertTriangle, critical: OctagonAlert }
const SEV_LABEL: Record<Severity, string> = { info: 'Info', warn: 'Heads-up', critical: 'Urgent' }

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function NotificationItem({ n, onOpen }: { n: AppNotification; onOpen?: () => void }) {
  const { state, dispatch } = useStore()
  const Icon = SEV_ICON[n.severity]
  const card = state.cards.find((c) => c.id === n.cardId)
  return (
    <div
      className={`notif sev-${n.severity}${n.read ? '' : ' unread'}`}
      role="button"
      tabIndex={0}
      onClick={() => (dispatch({ type: 'notif/read', id: n.id }), onOpen?.())}
      onKeyDown={(e) => e.key === 'Enter' && (dispatch({ type: 'notif/read', id: n.id }), onOpen?.())}
    >
      <span className="notif-icon" aria-label={SEV_LABEL[n.severity]}>
        <Icon size={16} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <b>{n.title}</b>
          <span className="faint" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
            {ago(n.createdAt)}
          </span>
        </div>
        <p>{n.body}</p>
        <div className="row" style={{ gap: 6 }}>
          {card && <span className={`card-dot pcard ${card.theme}`} />}
          <span className="faint" style={{ fontSize: 11 }}>
            {state.alerts.find((r) => r.id === n.ruleId)?.name ?? 'Alert'}
            {card ? ` · ${card.nickname}` : ''}
          </span>
        </div>
      </div>
      <button
        className="btn btn-ghost btn-icon notif-del"
        aria-label="Dismiss"
        onClick={(e) => {
          e.stopPropagation()
          dispatch({ type: 'notif/delete', id: n.id })
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export function Alerts({ onNew, onEdit }: { onNew: () => void; onEdit: (r: AlertRule) => void }) {
  const { state, dispatch } = useStore()
  const [tab, setTab] = useState<'unread' | 'all'>('all')
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  const list = state.notifications.filter((n) => tab === 'all' || !n.read)
  const unread = state.notifications.filter((n) => !n.read).length
  const counts = new Map<string, number>()
  for (const n of state.notifications) counts.set(n.ruleId, (counts.get(n.ruleId) ?? 0) + 1)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Alerts</h1>
          <p>
            {state.alerts.filter((a) => a.enabled).length} active rules · {unread} unread
          </p>
        </div>
        <button className="btn btn-primary" onClick={onNew}>
          <Plus size={16} /> New alert
        </button>
      </div>

      {perm === 'default' && state.alerts.some((a) => a.push) && (
        <div className="banner">
          <Smartphone size={18} />
          <div style={{ flex: 1 }}>
            <b>Turn on push notifications</b>
            <div className="muted" style={{ fontSize: 13 }}>
              Some rules want to reach you outside the app.
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => Notification.requestPermission().then(setPerm)}>
            Allow
          </button>
        </div>
      )}

      <div className="grid grid-dash">
        <section className="panel span-7">
          <div className="panel-head">
            <div className="segmented" role="group" aria-label="Filter">
              <button aria-pressed={tab === 'all'} onClick={() => setTab('all')}>
                All
              </button>
              <button aria-pressed={tab === 'unread'} onClick={() => setTab('unread')}>
                Unread {unread ? `(${unread})` : ''}
              </button>
            </div>
            <div className="row" style={{ gap: 4 }}>
              <button className="btn btn-ghost" onClick={() => dispatch({ type: 'notif/read', id: 'all' })} disabled={!unread}>
                <CheckCheck size={15} /> Mark all read
              </button>
              <button className="btn btn-ghost btn-danger" onClick={() => dispatch({ type: 'notif/delete', id: 'all' })} disabled={!state.notifications.length}>
                Clear
              </button>
            </div>
          </div>
          {list.length ? (
            <div className="notif-list">
              {list.map((n) => (
                <NotificationItem key={n.id} n={n} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <Bell size={28} />
              <div>{tab === 'unread' ? 'All caught up.' : 'No notifications yet. Rules fire as new purchases come in.'}</div>
            </div>
          )}
        </section>

        <section className="panel span-5">
          <div className="panel-head">
            <h2>Rules</h2>
            <span className="sub">Checked on every change</span>
          </div>
          {state.alerts.length ? (
            <div className="rule-list">
              {state.alerts.map((r) => {
                const card = state.cards.find((c) => c.id === r.cardId)
                return (
                  <div key={r.id} className={`rule${r.enabled ? '' : ' off'}`}>
                    <label className="toggle bare" title={r.enabled ? 'Disable' : 'Enable'}>
                      <input type="checkbox" checked={r.enabled} onChange={() => dispatch({ type: 'alert/toggle', id: r.id })} aria-label={`Enable ${r.name}`} />
                      <span />
                    </label>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="row" style={{ gap: 6 }}>
                        <b className="ellipsis">{r.name}</b>
                        {r.push ? <BellRing size={13} className="faint" aria-label="push on" /> : <BellOff size={13} className="faint" aria-label="in-app only" />}
                      </div>
                      <div className="faint" style={{ fontSize: 12 }}>
                        {describeTrigger(r, state)} · {card ? `${card.nickname} ••${card.last4}` : 'any card'}
                      </div>
                      {counts.get(r.id) ? (
                        <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>
                          Fired {counts.get(r.id)}×
                        </div>
                      ) : null}
                    </div>
                    <button className="btn btn-ghost btn-icon" aria-label={`Edit ${r.name}`} onClick={() => onEdit(r)}>
                      <Pencil size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty">
              <BellRing size={28} />
              <div>No rules yet.</div>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={onNew}>
                Create your first alert
              </button>
            </div>
          )}
          {perm === 'granted' && (
            <button
              className="btn btn-ghost"
              style={{ marginTop: 12 }}
              onClick={() => new Notification('Cardwise test', { body: 'Push notifications are working.', icon: '/favicon.svg' })}
            >
              <Smartphone size={15} /> Send test push
            </button>
          )}
        </section>
      </div>
    </>
  )
}
