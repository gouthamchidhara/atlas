/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f.trim() !== '')) rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim() !== '')) rows.push(row)
  return rows
}

export function toCSV(rows: (string | number)[][]) {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = String(v)
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(','),
    )
    .join('\n')
}

/** Accepts YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY (when day > 12), and Date-parsable strings. */
export function normalizeDate(raw: string): string | null {
  const s = raw.trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) {
    let [a, b] = [Number(m[1]), Number(m[2])]
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    // default MM/DD; flip when first part can't be a month
    if (a > 12) [a, b] = [b, a]
    return `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseAmount(raw: string): number | null {
  const s = raw.trim()
  if (!s) return null
  const negative = /^\(.*\)$/.test(s) || s.includes('-')
  const n = Number(s.replace(/[^0-9.]/g, ''))
  if (Number.isNaN(n)) return null
  return negative ? -n : n
}
