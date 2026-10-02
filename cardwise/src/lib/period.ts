import type { Period } from '../domain/types'
import { toISO } from './format'

export interface Range {
  start: string
  end: string
}

export const parseISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (iso: string, n: number) => {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
export const daysBetween = (a: string, b: string) => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000)
export const inRange = (iso: string, r: Range) => iso >= r.start && iso <= r.end

function clampDay(y: number, m: number, d: number) {
  const last = new Date(y, m + 1, 0).getDate()
  return new Date(y, m, Math.min(d, last))
}

/** Next statement close on or after `today`. */
export function nextClose(today: string, statementDay: number) {
  const t = parseISO(today)
  let d = clampDay(t.getFullYear(), t.getMonth(), statementDay)
  if (toISO(d) < today) d = clampDay(t.getFullYear(), t.getMonth() + 1, statementDay)
  return toISO(d)
}

export function statementCycle(today: string, statementDay: number, back = 0): Range {
  const close = parseISO(nextClose(today, statementDay))
  const end = clampDay(close.getFullYear(), close.getMonth() - back, statementDay)
  const prevClose = clampDay(end.getFullYear(), end.getMonth() - 1, statementDay)
  return { start: addDays(toISO(prevClose), 1), end: toISO(end) }
}

export const PERIOD_LABEL: Record<Period, string> = {
  'this-week': 'This week',
  'this-month': 'This month',
  'last-month': 'Last month',
  'last-30': 'Last 30 days',
  'last-90': 'Last 90 days',
  'this-year': 'This year',
  statement: 'Current statement',
}

/** Current range plus the comparable previous range (same elapsed length). */
export function resolvePeriod(p: Period, today: string, statementDay?: number): { cur: Range; prev: Range } {
  const t = parseISO(today)
  const y = t.getFullYear()
  const m = t.getMonth()
  switch (p) {
    case 'this-week': {
      const start = addDays(today, -((t.getDay() + 6) % 7))
      return { cur: { start, end: today }, prev: { start: addDays(start, -7), end: addDays(today, -7) } }
    }
    case 'this-month': {
      const start = toISO(new Date(y, m, 1))
      return { cur: { start, end: today }, prev: { start: toISO(new Date(y, m - 1, 1)), end: toISO(clampDay(y, m - 1, t.getDate())) } }
    }
    case 'last-month':
      return {
        cur: { start: toISO(new Date(y, m - 1, 1)), end: toISO(new Date(y, m, 0)) },
        prev: { start: toISO(new Date(y, m - 2, 1)), end: toISO(new Date(y, m - 1, 0)) },
      }
    case 'last-30':
    case 'last-90': {
      const n = p === 'last-30' ? 30 : 90
      return { cur: { start: addDays(today, -(n - 1)), end: today }, prev: { start: addDays(today, -(2 * n - 1)), end: addDays(today, -n) } }
    }
    case 'this-year':
      return { cur: { start: `${y}-01-01`, end: today }, prev: { start: `${y - 1}-01-01`, end: toISO(clampDay(y - 1, m, t.getDate())) } }
    case 'statement': {
      if (!statementDay) return resolvePeriod('this-month', today)
      const cur = statementCycle(today, statementDay)
      const prev = statementCycle(today, statementDay, 1)
      return { cur: { start: cur.start, end: today < cur.end ? today : cur.end }, prev: { start: prev.start, end: addDays(prev.start, daysBetween(cur.start, today)) } }
    }
  }
}

export interface Bucket extends Range {
  key: string
  label: string
  long: string
}

/** Daily up to a month, weekly up to ~4 months, otherwise monthly. */
export function buckets(r: Range, locale: string): Bucket[] {
  const days = daysBetween(r.start, r.end) + 1
  const out: Bucket[] = []
  if (days <= 31) {
    for (let i = 0; i < days; i++) {
      const d = addDays(r.start, i)
      const dt = parseISO(d)
      out.push({ key: d, start: d, end: d, label: String(dt.getDate()), long: dt.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' }) })
    }
  } else if (days <= 120) {
    for (let s = r.start; s <= r.end; s = addDays(s, 7)) {
      const e = addDays(s, 6) > r.end ? r.end : addDays(s, 6)
      const dt = parseISO(s)
      out.push({ key: s, start: s, end: e, label: dt.toLocaleDateString(locale, { month: 'short', day: 'numeric' }), long: `Week of ${dt.toLocaleDateString(locale, { month: 'long', day: 'numeric' })}` })
    }
  } else {
    const s = parseISO(r.start)
    for (let d = new Date(s.getFullYear(), s.getMonth(), 1); toISO(d) <= r.end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const start = toISO(d) < r.start ? r.start : toISO(d)
      const endD = toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))
      out.push({ key: start, start, end: endD > r.end ? r.end : endD, label: d.toLocaleDateString(locale, { month: 'short' }), long: d.toLocaleDateString(locale, { month: 'long', year: 'numeric' }) })
    }
  }
  return out
}
