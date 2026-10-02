import type { Settings } from '../domain/types'

export function money(value: number, s: Settings, opts: { compact?: boolean; sign?: boolean } = {}) {
  const f = new Intl.NumberFormat(s.locale, {
    style: 'currency',
    currency: s.currency,
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.compact ? 1 : 2,
    signDisplay: opts.sign ? 'exceptZero' : 'auto',
  })
  return f.format(value)
}

export const todayISO = () => toISO(new Date())

export function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const monthKey = (iso: string) => iso.slice(0, 7)

export function monthLabel(key: string, locale: string, style: 'short' | 'long' = 'short') {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: style, year: style === 'long' ? 'numeric' : undefined })
}

export function dayLabel(iso: string, locale: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date()
  const yest = new Date()
  yest.setDate(today.getDate() - 1)
  if (toISO(date) === toISO(today)) return 'Today'
  if (toISO(date) === toISO(yest)) return 'Yesterday'
  return date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
