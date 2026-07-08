// Keyless real-place discovery via OpenStreetMap.
// Nominatim geocodes a typed location; Overpass returns real nearby POIs.
// No API key required.

export type Coordinates = { lat: number; lng: number }

export type GeoPlace = {
  name: string
  lat: number
  lng: number
}

export type Poi = {
  id: string
  name: string
  category: string
  lat: number
  lng: number
}

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Turn a typed location ("Denton, Texas") into real coordinates. */
export async function geocode(query: string): Promise<GeoPlace | null> {
  const trimmed = query.trim()
  if (!trimmed) return null
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(trimmed)}`
  try {
    const response = await fetchWithTimeout(url, 8000, { headers: { Accept: 'application/json' } })
    if (!response.ok) return null
    const data = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>
    const first = data[0]
    if (!first) return null
    return {
      name: first.display_name.split(',')[0].trim(),
      lat: Number.parseFloat(first.lat),
      lng: Number.parseFloat(first.lon),
    }
  } catch {
    return null
  }
}

type Filter = { selector: string; category: string }

const INTEREST_FILTERS: Record<string, Filter[]> = {
  Views: [
    { selector: '["tourism"="viewpoint"]', category: 'Viewpoint' },
    { selector: '["tourism"="attraction"]', category: 'Attraction' },
  ],
  Food: [
    { selector: '["amenity"="restaurant"]', category: 'Restaurant' },
    { selector: '["amenity"="cafe"]', category: 'Cafe' },
  ],
  History: [
    { selector: '["tourism"="museum"]', category: 'Museum' },
    { selector: '["historic"="monument"]', category: 'Historic' },
    { selector: '["historic"="memorial"]', category: 'Historic' },
  ],
  Family: [
    { selector: '["leisure"="park"]', category: 'Park' },
    { selector: '["tourism"="zoo"]', category: 'Family' },
  ],
  'Quiet spots': [
    { selector: '["leisure"="garden"]', category: 'Garden' },
    { selector: '["leisure"="park"]', category: 'Park' },
  ],
}

const DEFAULT_FILTERS: Filter[] = [
  { selector: '["tourism"="attraction"]', category: 'Attraction' },
  { selector: '["amenity"="restaurant"]', category: 'Restaurant' },
  { selector: '["leisure"="park"]', category: 'Park' },
]

function filtersForInterests(interests: string[]): Filter[] {
  const chosen = interests.flatMap((interest) => INTEREST_FILTERS[interest] ?? [])
  return chosen.length > 0 ? chosen : DEFAULT_FILTERS
}

/** Query Overpass for real named POIs near a coordinate. */
export async function fetchPois(
  center: Coordinates,
  interests: string[],
  radiusMeters = 5000,
): Promise<Poi[]> {
  const filters = filtersForInterests(interests)
  const body = `[out:json][timeout:20];(${filters
    .map((filter) => `node${filter.selector}(around:${radiusMeters},${center.lat},${center.lng});`)
    .join('')});out center 60;`

  try {
    const response = await fetchWithTimeout('https://overpass-api.de/api/interpreter', 16000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(body)}`,
    })
    if (!response.ok) return []
    const data = (await response.json()) as {
      elements: Array<{ id: number; lat?: number; lon?: number; tags?: Record<string, string> }>
    }

    const seen = new Set<string>()
    const pois: Poi[] = []
    for (const element of data.elements) {
      const name = element.tags?.name
      if (!name || element.lat == null || element.lon == null) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      pois.push({
        id: String(element.id),
        name,
        category: categorize(element.tags ?? {}),
        lat: element.lat,
        lng: element.lon,
      })
    }
    return pois
  } catch {
    return []
  }
}

function categorize(tags: Record<string, string>): string {
  if (tags.tourism === 'viewpoint') return 'Viewpoint'
  if (tags.tourism === 'museum') return 'Museum'
  if (tags.tourism === 'attraction') return 'Attraction'
  if (tags.tourism === 'zoo') return 'Family'
  if (tags.amenity === 'restaurant') return 'Restaurant'
  if (tags.amenity === 'cafe') return 'Cafe'
  if (tags.leisure === 'park') return 'Park'
  if (tags.leisure === 'garden') return 'Garden'
  if (tags.historic) return 'Historic'
  return 'Place'
}
