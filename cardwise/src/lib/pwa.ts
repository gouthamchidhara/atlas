import type { Candidate } from '../alerts/engine'
import type { AppState } from '../domain/types'
import { KV, kvGet, kvSet } from './idb'

const SYNC_TAG = 'cardwise-alerts'
const SIX_HOURS = 6 * 60 * 60 * 1000

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
type PeriodicSyncReg = ServiceWorkerRegistration & {
  periodicSync?: { register: (tag: string, o: { minInterval: number }) => Promise<void>; getTags: () => Promise<string[]> }
}

let installEvent: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installEvent = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installEvent = null
    emit()
  })
}

export const onPwaChange = (fn: () => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}
export const canInstall = () => !!installEvent
export async function promptInstall() {
  if (!installEvent) return false
  await installEvent.prompt()
  const { outcome } = await installEvent.userChoice
  installEvent = null
  emit()
  return outcome === 'accepted'
}
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

export async function swRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

/** System notification, via the service worker when possible (required on Android). */
export async function notify(title: string, body: string, tag: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const reg = await swRegistration()
  if (reg) await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', data: { url: './#alerts' } })
  else new Notification(title, { body, tag, icon: 'icons/icon-192.png' })
}

export type BackgroundStatus = 'active' | 'install-needed' | 'permission-needed' | 'unsupported' | 'no-worker'

/** Try to (re)register periodic background checks and report what the browser allows. */
export async function setupBackgroundChecks(): Promise<BackgroundStatus> {
  const reg = (await swRegistration()) as PeriodicSyncReg | null
  if (!reg) return 'no-worker'
  if (!reg.periodicSync) return 'unsupported'
  try {
    const perm = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName })
    if (perm.state !== 'granted') return isStandalone() ? 'permission-needed' : 'install-needed'
    await reg.periodicSync.register(SYNC_TAG, { minInterval: SIX_HOURS })
    return 'active'
  } catch {
    return isStandalone() ? 'permission-needed' : 'install-needed'
  }
}

/** Ask the worker to run its check now; resolves with how many new events it found. */
export async function runBackgroundCheckNow(): Promise<number | null> {
  const reg = await swRegistration()
  const worker = reg?.active
  if (!worker) return null
  return new Promise((resolve) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== 'checked') return
      navigator.serviceWorker.removeEventListener('message', onMsg)
      resolve(e.data.found as number)
    }
    navigator.serviceWorker.addEventListener('message', onMsg)
    worker.postMessage({ type: 'check' })
    setTimeout(() => resolve(null), 10_000)
  })
}

export const mirrorState = (state: AppState) => kvSet(KV.state, state).catch(() => undefined)

/** Pull events the worker found while the app was closed. */
export async function takePending(): Promise<Candidate[]> {
  try {
    const pending = (await kvGet<Candidate[]>(KV.pending)) ?? []
    if (pending.length) await kvSet(KV.pending, [])
    return pending
  } catch {
    return []
  }
}

export const lastBackgroundCheck = () => kvGet<string>(KV.lastCheck).catch(() => undefined)
