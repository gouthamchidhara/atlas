import { Linking, Platform } from 'react-native'
import type { PlanStop, TravelMode, TravelPlan } from '../domain/trip'

export type MapProvider = 'google' | 'apple'

/** Apple Maps on iOS, Google Maps on Android — the native platform map. */
export function resolveMapProvider(): MapProvider {
  return Platform.OS === 'ios' ? 'apple' : 'google'
}

export function providerLabel(provider: MapProvider): string {
  return provider === 'apple' ? 'Apple Maps' : 'Google Maps'
}

export function openRouteInMaps(provider: MapProvider, plan: TravelPlan): void {
  const url = provider === 'apple' ? appleUrl(plan) : googleUrl(plan)
  Linking.openURL(url).catch(() => {})
}

function googleUrl(plan: TravelPlan): string {
  const [origin, ...rest] = plan.stops
  const destination = rest.at(-1) ?? origin
  const waypoints = rest.slice(0, -1)
  const params = new URLSearchParams({
    api: '1',
    origin: origin ? formatStop(origin) : plan.area,
    destination: destination ? formatStop(destination) : plan.area,
    travelmode: toGoogleMode(plan.mode),
  })
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(formatStop).join('|'))
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

function appleUrl(plan: TravelPlan): string {
  const [origin, ...rest] = plan.stops
  const destination = rest.at(-1) ?? origin
  const params = new URLSearchParams({
    saddr: origin ? formatStop(origin) : plan.area,
    daddr: destination ? formatStop(destination) : plan.area,
    dirflg: toAppleMode(plan.mode),
  })
  return `https://maps.apple.com/?${params.toString()}`
}

function formatStop(stop: PlanStop): string {
  return stop.address || `${stop.coordinates.lat},${stop.coordinates.lng}`
}

function toGoogleMode(mode: TravelMode): string {
  return mode === 'walking' ? 'walking' : mode === 'transit' ? 'transit' : 'driving'
}

function toAppleMode(mode: TravelMode): string {
  return mode === 'walking' ? 'w' : mode === 'transit' ? 'r' : 'd'
}
