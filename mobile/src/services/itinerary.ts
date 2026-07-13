import type { Coordinates, PlanStop, TravelPlan } from '../domain/trip'
import { fetchPois, geocode, type Poi } from './discovery'
import { enrichWikipedia, firstSentence, type Enrichment } from './enrich'

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

type Ranked = { poi: Poi; enr: Enrichment; dist: number }

const STAY_MINUTES: Record<string, number> = {
  Restaurant: 55,
  Cafe: 35,
  Museum: 70,
  Gallery: 45,
  'Public art': 15,
  Attraction: 45,
  Viewpoint: 25,
  Beach: 60,
  Landmark: 30,
  Park: 40,
  Garden: 30,
  Nature: 45,
  Historic: 35,
  Family: 70,
  Place: 40,
}

export async function buildItinerary(params: BuildParams): Promise<BuildResult> {
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

  const pois = await fetchPois(base, params.interests)
  if (pois.length === 0) {
    return { error: `No notable places found near ${area}. Try a nearby town or different interests.` }
  }

  // Enrich the most promising candidates (notable + nearest) with real
  // Wikipedia popularity/description/photo, then rank by popularity.
  const candidates = [...pois]
    .sort((a, b) => (a.notable !== b.notable ? (a.notable ? -1 : 1) : distanceKm(base!, a) - distanceKm(base!, b)))
    .slice(0, 16)

  const ranked: Ranked[] = await Promise.all(
    candidates.map(async (poi) => ({ poi, enr: await enrichWikipedia(poi.wikipedia), dist: distanceKm(base!, poi) })),
  )

  ranked.sort((a, b) => b.enr.views - a.enr.views || Number(b.poi.notable) - Number(a.poi.notable) || a.dist - b.dist)

  const chosen = pickVaried(ranked, 3)
  if (chosen.length === 0) {
    return { error: `No notable places found near ${area}.` }
  }

  // Order nearest-first for a sensible walking route.
  chosen.sort((a, b) => a.dist - b.dist)

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

function pickVaried(ranked: Ranked[], count: number): Ranked[] {
  const chosen: Ranked[] = []
  const usedCategories = new Set<string>()
  for (const item of ranked) {
    if (chosen.length >= count) break
    if (!usedCategories.has(item.poi.category)) {
      chosen.push(item)
      usedCategories.add(item.poi.category)
    }
  }
  for (const item of ranked) {
    if (chosen.length >= count) break
    if (!chosen.includes(item)) chosen.push(item)
  }
  return chosen
}

function composeStops(items: Ranked[], base: Coordinates, params: BuildParams): PlanStop[] {
  const interestText = params.interests.length > 0 ? params.interests.slice(0, 2).join(' and ') : 'your plan'
  const constraintText = params.constraints.length > 0 ? params.constraints.slice(0, 2).join(' and ') : 'your pace'

  let clock = new Date(Date.now() + 15 * 60000)
  let previous = base

  return items.map(({ poi, enr }, index) => {
    const travelMin = Math.max(3, Math.round((distanceKm(previous, poi) / 4.8) * 60))
    clock = new Date(clock.getTime() + travelMin * 60000)
    const arrival = formatTime(clock)
    const stayMin = STAY_MINUTES[poi.category] ?? 40
    clock = new Date(clock.getTime() + stayMin * 60000)
    previous = poi

    const popular = enr.views >= 400
    const description = firstSentence(enr.extract)

    return {
      id: `${poi.id}-${index}`,
      time: arrival,
      title: poi.name,
      address: `${poi.name}, ${params.destinationText || 'nearby'}`,
      coordinates: { lat: poi.lat, lng: poi.lng },
      meta: `${poi.category} · ${stayMin} min${popular ? ' · Popular now' : ''}`,
      travel: `${travelMin} min walk`,
      why:
        description ??
        (poi.notable
          ? `Well-known ${poi.category.toLowerCase()} — a genuine highlight near you.`
          : `Real ${poi.category.toLowerCase()} that fits ${interestText}.`),
      backup: `Flexible timing keeps ${constraintText} protected.`,
      image: enr.image,
      popular,
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
