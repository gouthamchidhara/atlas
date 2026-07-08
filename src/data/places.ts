import type { PlanStop } from '../domain/trip'

// Neutral initial camera used only until the device reports real geolocation.
// Not demo content — just where the map opens before permission resolves.
export const FALLBACK_CENTER = { lat: 37.7793, lng: -122.4193 }

// A place card shown in the app is always derived from real state
// (the user's generated itinerary), never seeded demo content.
export type PlaceCard = {
  id: string
  index: number
  title: string
  time: string
  meta: string
  travel: string
  lat: number
  lng: number
}

export function stopToCard(stop: PlanStop, index: number): PlaceCard {
  return {
    id: stop.id,
    index: index + 1,
    title: stop.title,
    time: stop.time,
    meta: stop.meta,
    travel: stop.travel,
    lat: stop.coordinates.lat,
    lng: stop.coordinates.lng,
  }
}

/**
 * Keyless map-snapshot thumbnail for a coordinate, built from the same
 * CARTO basemap tiles the live map uses (light/dark aware). Uses the
 * standard slippy-tile projection to pick the tile containing the point.
 */
export function mapThumbUrl(lat: number, lng: number, theme: 'light' | 'dark', zoom = 15): string {
  const n = 2 ** zoom
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n)
  const style = theme === 'dark' ? 'dark_all' : 'light_all'
  return `https://a.basemaps.cartocdn.com/${style}/${zoom}/${x}/${y}@2x.png`
}

