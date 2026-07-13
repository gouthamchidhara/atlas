// Keyless enrichment: real photo, description, and 30-day popularity from Wikipedia
// for POIs that carry an OSM `wikipedia` tag (e.g. "en:Dealey Plaza").

export type Enrichment = { extract?: string; image?: string; views: number }

async function fetchTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'AtlasTravel/1.0' } })
  } finally {
    clearTimeout(timer)
  }
}

function pageviewRange(): [string, string] {
  const end = new Date(Date.now() - 2 * 864e5) // pageviews lag ~1-2 days
  const start = new Date(end.getTime() - 30 * 864e5)
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
  return [fmt(start), fmt(end)]
}

export async function enrichWikipedia(tag?: string): Promise<Enrichment> {
  if (!tag) return { views: 0 }
  const idx = tag.indexOf(':')
  const lang = idx > 0 && /^[a-z]{2,3}$/.test(tag.slice(0, idx)) ? tag.slice(0, idx) : 'en'
  const title = idx > 0 ? tag.slice(idx + 1) : tag
  try {
    const [summary, views] = await Promise.all([fetchSummary(lang, title), fetchViews(lang, title)])
    return { extract: summary?.extract, image: summary?.image, views }
  } catch {
    return { views: 0 }
  }
}

async function fetchSummary(lang: string, title: string): Promise<{ extract?: string; image?: string } | null> {
  try {
    const r = await fetchTimeout(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, 6000)
    if (!r.ok) return null
    const d = (await r.json()) as { extract?: string; thumbnail?: { source?: string } }
    return { extract: d.extract, image: d.thumbnail?.source }
  } catch {
    return null
  }
}

async function fetchViews(lang: string, title: string): Promise<number> {
  try {
    const [start, end] = pageviewRange()
    const t = encodeURIComponent(title.replace(/ /g, '_'))
    const r = await fetchTimeout(
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/user/${t}/daily/${start}/${end}`,
      6000,
    )
    if (!r.ok) return 0
    const d = (await r.json()) as { items?: Array<{ views: number }> }
    return (d.items ?? []).reduce((sum, item) => sum + item.views, 0)
  } catch {
    return 0
  }
}

export function firstSentence(text?: string, max = 160): string | undefined {
  if (!text) return undefined
  const dot = text.indexOf('. ')
  const slice = dot > 40 && dot < max ? text.slice(0, dot + 1) : text.slice(0, max)
  return slice.trim()
}
