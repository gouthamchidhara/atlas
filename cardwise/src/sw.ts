/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { evaluate, type Candidate } from './alerts/engine'
import type { AppState } from './domain/types'
import { todayISO } from './lib/format'
import { KV, kvGet, kvSet } from './lib/idb'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] }

interface PeriodicSyncEvent extends ExtendableEvent {
  tag: string
}

const SYNC_TAG = 'cardwise-alerts'

// Offline: precache the built app shell and serve index.html for navigations.
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

self.addEventListener('install', () => void self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

/**
 * Run the same alert engine the app runs, against the snapshot the app mirrored to IndexedDB.
 * New events are queued for the app's inbox; rules with push on also get a system notification.
 */
async function check(): Promise<number> {
  const state = await kvGet<AppState>(KV.state)
  if (!state) return 0
  const bgFired = (await kvGet<string[]>(KV.bgFired)) ?? []
  const known = new Set([...state.firedKeys, ...bgFired])
  const fresh = evaluate(state, todayISO()).filter((c) => !known.has(c.key))
  await kvSet(KV.lastCheck, new Date().toISOString())
  if (!fresh.length) return 0

  const canShow = Notification.permission === 'granted'
  const pushRules = new Set(state.alerts.filter((a) => a.push).map((a) => a.id))
  const toShow = canShow ? fresh.filter((c) => pushRules.has(c.ruleId)) : []
  const shownKeys = new Set(toShow.map((c) => c.key))
  const queued: Candidate[] = fresh.map((c) => ({ ...c, delivered: shownKeys.has(c.key) }))

  const pending = (await kvGet<Candidate[]>(KV.pending)) ?? []
  await kvSet(KV.pending, [...pending, ...queued].slice(-200))
  await kvSet(KV.bgFired, [...bgFired, ...fresh.map((c) => c.key)].slice(-2000))

  if (toShow.length) {
    if (toShow.length > 3) {
      await self.registration.showNotification(`${toShow.length} new Cardwise alerts`, {
        body: toShow.slice(0, 3).map((c) => c.title).join(' · '),
        icon: 'icons/icon-192.png',
        badge: 'icons/badge-96.png',
        tag: 'cardwise-batch',
        data: { url: './#alerts' },
      })
    } else {
      for (const c of toShow)
        await self.registration.showNotification(c.title, { body: c.body, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', tag: c.key, data: { url: './#alerts' } })
    }
  }
  return fresh.length
}

self.addEventListener('periodicsync', (e) => {
  const ev = e as PeriodicSyncEvent
  if (ev.tag === SYNC_TAG) ev.waitUntil(check())
})

// Lets the app trigger the background path on demand ("Run background check now").
self.addEventListener('message', (e) => {
  if (e.data?.type === 'check') e.waitUntil(check().then((n) => e.source?.postMessage({ type: 'checked', found: n })))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL((e.notification.data?.url as string) ?? './', self.registration.scope).href
  e.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = wins.find((w) => w.url.startsWith(self.registration.scope))
      if (open) {
        await open.focus()
        open.postMessage({ type: 'navigate', hash: 'alerts' })
      } else await self.clients.openWindow(url)
    })(),
  )
})
