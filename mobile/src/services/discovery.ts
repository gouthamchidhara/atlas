// Keyless real-place discovery via OpenStreetMap.
// Nominatim geocodes a typed location; Overpass returns real nearby POIs.
// Attraction-focused, with notability ranking (wikidata/wikipedia = genuinely notable).

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
  notable: boolean
  wikipedia?: string
  wikidata?: string
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

/** Turn a typed location ("Dallas") into real coordinates, preferring the city. */
export async function geocode(query: string): Promise<GeoPlace | null> {
  const trimmed = query.trim()
  if (!trimmed) return null
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(trimmed)}`
  try {
    const response = await fetchWithTimeout(url, 8000, {
      headers: { Accept: 'application/json', 'User-Agent': 'AtlasTravel/1.0' },
    })
    if (!response.ok) return null
    const data = (await response.json()) as Array<{ display_name: string; lat: string; lon: string; addresstype?: string }>
    // Prefer an actual populated place over a county/state/region centroid.
    const preferred =
      data.find((d) => d.addresstype && ['city', 'town', 'village', 'municipality', 'suburb'].includes(d.addresstype)) ??
      data[0]
    if (!preferred) return null
    return {
      name: preferred.display_name.split(',')[0].trim(),
      lat: Number.parseFloat(preferred.lat),
      lng: Number.parseFloat(preferred.lon),
    }
  } catch {
    return null
  }
}

type Filter = { selector: string; category: string }

// Sights people actually travel to see. No fast food, no generic amenities by default.
const INTEREST_FILTERS: Record<string, Filter[]> = {
  Views: [
    { selector: '["tourism"="viewpoint"]', category: 'Viewpoint' },
    { selector: '["natural"="peak"]', category: 'Viewpoint' },
    { selector: '["natural"="beach"]', category: 'Beach' },
    { selector: '["man_made"="tower"]["tourism"]', category: 'Landmark' },
  ],
  Food: [
    { selector: '["amenity"="restaurant"]["cuisine"]', category: 'Restaurant' },
    { selector: '["amenity"="cafe"]', category: 'Cafe' },
  ],
  History: [
    { selector: '["tourism"="museum"]', category: 'Museum' },
    { selector: '["tourism"="gallery"]', category: 'Gallery' },
    { selector: '["tourism"="artwork"]', category: 'Public art' },
    { selector: '["historic"]', category: 'Historic' },
  ],
  Family: [
    { selector: '["tourism"="theme_park"]', category: 'Family' },
    { selector: '["tourism"="zoo"]', category: 'Family' },
    { selector: '["tourism"="aquarium"]', category: 'Family' },
    { selector: '["leisure"="park"]', category: 'Park' },
  ],
  'Quiet spots': [
    { selector: '["leisure"="garden"]', category: 'Garden' },
    { selector: '["leisure"="nature_reserve"]', category: 'Nature' },
    { selector: '["leisure"="park"]', category: 'Park' },
  ],
}

// Default when no interests chosen: real attractions, culture, landmarks, parks — never restaurants.
const DEFAULT_FILTERS: Filter[] = [
  { selector: '["tourism"="attraction"]', category: 'Attraction' },
  { selector: '["tourism"="museum"]', category: 'Museum' },
  { selector: '["tourism"="viewpoint"]', category: 'Viewpoint' },
  { selector: '["tourism"="artwork"]', category: 'Public art' },
  { selector: '["tourism"="theme_park"]', category: 'Family' },
  { selector: '["historic"="monument"]', category: 'Historic' },
  { selector: '["historic"="memorial"]', category: 'Historic' },
  { selector: '["historic"="castle"]', category: 'Historic' },
  { selector: '["leisure"="park"]', category: 'Park' },
  { selector: '["natural"="beach"]', category: 'Beach' },
]

function filtersForInterests(interests: string[]): Filter[] {
  const chosen = interests.flatMap((interest) => INTEREST_FILTERS[interest] ?? [])
  return chosen.length > 0 ? chosen : DEFAULT_FILTERS
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
]

/** Query Overpass for real named POIs near a coordinate, with mirror fallback. */
export async function fetchPois(
  center: Coordinates,
  interests: string[],
  radiusMeters = 6000,
): Promise<Poi[]> {
  const filters = filtersForInterests(interests)
  // Node-only keeps the query light enough to stay fast even in dense cities (NYC etc.).
  const body = `[out:json][timeout:25];(${filters
    .map((filter) => `node${filter.selector}(around:${radiusMeters},${center.lat},${center.lng});`)
    .join('')});out 100;`

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(endpoint, 18000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'AtlasTravel/1.0' },
        body: `data=${encodeURIComponent(body)}`,
      })
      if (!response.ok) continue

      const data = (await response.json()) as {
        elements: Array<{
          id: number
          lat?: number
          lon?: number
          center?: { lat: number; lon: number }
          tags?: Record<string, string>
        }>
      }

      const seen = new Set<string>()
      const pois: Poi[] = []
      for (const element of data.elements) {
        const tags = element.tags ?? {}
        const name = tags.name
        const lat = element.lat ?? element.center?.lat
        const lon = element.lon ?? element.center?.lon
        if (!name || lat == null || lon == null) continue
        if (isJunk(tags)) continue
        const key = name.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        pois.push({
          id: String(element.id),
          name,
          category: categorize(tags),
          lat,
          lng: lon,
          notable: Boolean(tags.wikidata || tags.wikipedia || tags.heritage),
          wikipedia: tags.wikipedia,
          wikidata: tags.wikidata,
        })
      }

      if (pois.length > 0) return pois
    } catch {
      // try the next mirror
    }
  }
  return []
}

// Filter out low-value / fast-food-ish results that shouldn't show as attractions.
function isJunk(tags: Record<string, string>): boolean {
  if (tags.amenity === 'fast_food') return true
  const chains = /mcdonald|burger|taco|wing|fried|kfc|subway|domino|pizza hut|wendy|sonic|whataburger|dairy queen|dunkin|fowl|fuzzy/i
  if ((tags.amenity === 'restaurant' || tags.amenity === 'cafe') && chains.test(tags.name ?? '')) return true
  return false
}

function categorize(tags: Record<string, string>): string {
  if (tags.tourism === 'viewpoint' || tags.natural === 'peak') return 'Viewpoint'
  if (tags.natural === 'beach') return 'Beach'
  if (tags.tourism === 'museum') return 'Museum'
  if (tags.tourism === 'gallery') return 'Gallery'
  if (tags.tourism === 'artwork') return 'Public art'
  if (tags.tourism === 'theme_park' || tags.tourism === 'zoo' || tags.tourism === 'aquarium') return 'Family'
  if (tags.tourism === 'attraction') return 'Attraction'
  if (tags.historic) return 'Historic'
  if (tags.leisure === 'park') return 'Park'
  if (tags.leisure === 'garden') return 'Garden'
  if (tags.leisure === 'nature_reserve') return 'Nature'
  if (tags.man_made === 'tower') return 'Landmark'
  if (tags.amenity === 'restaurant') return 'Restaurant'
  if (tags.amenity === 'cafe') return 'Cafe'
  return 'Attraction'
}
