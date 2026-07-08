import type { Coordinates, PlanStop, TravelPlan } from '../domain/trip'
import { fetchPois, geocode, type Poi } from './discovery'

export type BuildParams = {
  destinationText: string
  interests: string[]
  constraints: string[]
  timeBudget: string
  leaveBy: string
  flightStatus?: string
  origin?: Coordinates
}

export type BuildResult = { plan: TravelPlan } | { error: string }

const STAY_MINUTES: Record<string, number> = {
  Restaurant: 55,
  Cafe: 35,
  Museum: 60,
  Attraction: 45,
  Viewpoint: 25,
  Park: 35,
  Garden: 30,
  Historic: 30,
  Family: 50,
  Place: 40,
}

export async function buildItinerary(params: BuildParams): Promise<BuildResult> {
  // 1. Resolve a real base location.
  let base: Coordinates | null = null
  let area = params.destinationText.trim()

  if (area) {
    const geo = await geocode(area)
    if (geo) {
      base = { lat: geo.lat, lng: geo.lng }
      area = geo.name
    }
  }
  if (!base && params.origin) {
    base = params.origin
    area = area || 'Nearby'
  }
  if (!base) {
    return { error: `Couldn't find "${params.destinationText || 'that place'}". Try a city or area name.` }
  }

  // 2. Pull real nearby places.
  const pois = await fetchPois(base, params.interests)
  if (pois.length === 0) {
    return { error: `No notable places found near ${area}. Try a nearby town or different interests.` }
  }

  // 3. Choose up to 3 varied, nearby stops.
  const chosen = selectVaried(pois, base, 3)
  if (chosen.length === 0) {
    return { error: `No notable places found near ${area}.` }
  }

  // 4. Compose stops with dynamic times + real walking estimates.
  const stops = composeStops(chosen, base, params)
  const flightContext = params.flightStatus ? ` Flight watch: ${params.flightStatus}.` : ''

  return {
    plan: {
      id: slugify(area),
      title: `${params.timeBudget} in ${area}`,
      area,
      mode: 'walking',
      leaveBy: params.leaveBy,
      constraint: `Leave by ${params.leaveBy} to protect the full plan.${flightContext}`,
      stops,
    },
  }
}

function selectVaried(pois: Poi[], base: Coordinates, count: number): Poi[] {
  const byDistance = [...pois].sort((a, b) => distanceKm(base, a) - distanceKm(base, b))
  const chosen: Poi[] = []
  const usedCategories = new Set<string>()

  // First pass: nearest of each distinct category.
  for (const poi of byDistance) {
    if (chosen.length >= count) break
    if (!usedCategories.has(poi.category)) {
      chosen.push(poi)
      usedCategories.add(poi.category)
    }
  }
  // Fill remaining with the next nearest, regardless of category.
  for (const poi of byDistance) {
    if (chosen.length >= count) break
    if (!chosen.includes(poi)) chosen.push(poi)
  }

  // Order the final set nearest-first for a sensible walking route.
  return chosen.sort((a, b) => distanceKm(base, a) - distanceKm(base, b))
}

function composeStops(pois: Poi[], base: Coordinates, params: BuildParams): PlanStop[] {
  const interestText = params.interests.length > 0 ? params.interests.slice(0, 2).join(' and ') : 'your plan'
  const constraintText = params.constraints.length > 0 ? params.constraints.slice(0, 2).join(' and ') : 'your pace'

  let clock = new Date()
  clock = new Date(clock.getTime() + 15 * 60000)
  let previous = base

  return pois.map((poi, index) => {
    const travelMin = Math.max(3, Math.round((distanceKm(previous, poi) / 4.8) * 60))
    clock = new Date(clock.getTime() + travelMin * 60000)
    const arrival = formatTime(clock)
    const stayMin = STAY_MINUTES[poi.category] ?? 40
    clock = new Date(clock.getTime() + stayMin * 60000)
    previous = poi

    return {
      id: `${poi.id}-${index}`,
      time: arrival,
      title: poi.name,
      address: `${poi.name}, ${params.destinationText || 'nearby'}`,
      coordinates: { lat: poi.lat, lng: poi.lng },
      meta: `${poi.category} · ${stayMin} min`,
      travel: `${travelMin} min walk`,
      why: `Real ${poi.category.toLowerCase()} that fits ${interestText}.`,
      backup: `Flexible timing keeps ${constraintText} protected.`,
    }
  })
}

function distanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'plan'
}
