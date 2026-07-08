import type { PlanStop, TravelMode, TravelPlan } from '../domain/trip'

export type MapProvider = 'google' | 'apple'

export type MapProviderStatus = {
  provider: MapProvider
  isConfigured: boolean
  label: string
  missingConfig: string
}

const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
const appleMapKitToken = import.meta.env.VITE_APPLE_MAPKIT_TOKEN ?? ''
const preferredProvider = import.meta.env.VITE_MAP_PROVIDER ?? 'google'

export function getPreferredMapProvider(): MapProviderStatus {
  if (preferredProvider === 'apple') {
    return {
      provider: 'apple',
      isConfigured: appleMapKitToken.length > 0,
      label: 'Apple Maps',
      missingConfig: 'Add VITE_APPLE_MAPKIT_TOKEN to enable MapKit JS.',
    }
  }

  return {
    provider: 'google',
    isConfigured: googleMapsApiKey.length > 0,
    label: 'Google Maps',
    missingConfig: 'Add VITE_GOOGLE_MAPS_API_KEY to enable embedded routes.',
  }
}

export function getGoogleEmbedUrl(plan: TravelPlan): string | null {
  if (!googleMapsApiKey) {
    return null
  }

  const [origin, ...restStops] = plan.stops
  const destination = restStops.at(-1)
  const waypoints = restStops.slice(0, -1)

  if (!origin || !destination) {
    return null
  }

  const params = new URLSearchParams({
    key: googleMapsApiKey,
    origin: formatStopForUrl(origin),
    destination: formatStopForUrl(destination),
    mode: toGoogleMode(plan.mode),
  })

  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(formatStopForUrl).join('|'))
  }

  return `https://www.google.com/maps/embed/v1/directions?${params.toString()}`
}

export function getGoogleDirectionsUrl(plan: TravelPlan): string {
  const [origin, ...restStops] = plan.stops
  const destination = restStops.at(-1) ?? origin
  const waypoints = restStops.slice(0, -1)
  const params = new URLSearchParams({
    api: '1',
    origin: origin ? formatStopForUrl(origin) : plan.area,
    destination: destination ? formatStopForUrl(destination) : plan.area,
    travelmode: toGoogleMode(plan.mode),
  })

  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(formatStopForUrl).join('|'))
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function getAppleMapsRouteUrl(plan: TravelPlan): string {
  const [origin, ...restStops] = plan.stops
  const destination = restStops.at(-1) ?? origin
  const params = new URLSearchParams({
    saddr: origin ? formatStopForUrl(origin) : plan.area,
    daddr: destination ? formatStopForUrl(destination) : plan.area,
    dirflg: toAppleMode(plan.mode),
  })

  return `https://maps.apple.com/?${params.toString()}`
}

export function openRouteInMaps(provider: MapProvider, plan: TravelPlan): void {
  const url = provider === 'apple' ? getAppleMapsRouteUrl(plan) : getGoogleDirectionsUrl(plan)
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Platform-aware provider: Apple Maps on iOS/macOS, Google Maps elsewhere
 * (Android/web). An explicit VITE_MAP_PROVIDER always wins.
 */
export function resolveMapProvider(): MapProvider {
  const configured = import.meta.env.VITE_MAP_PROVIDER
  if (configured === 'apple' || configured === 'google') {
    return configured
  }
  if (typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)) {
    return 'apple'
  }
  return 'google'
}

function formatStopForUrl(stop: PlanStop): string {
  return stop.address || `${stop.coordinates.lat},${stop.coordinates.lng}`
}

function toGoogleMode(mode: TravelMode): string {
  return mode === 'walking' ? 'walking' : mode === 'transit' ? 'transit' : 'driving'
}

function toAppleMode(mode: TravelMode): string {
  return mode === 'walking' ? 'w' : mode === 'transit' ? 'r' : 'd'
}