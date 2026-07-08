import type { Coordinates, PlanStop, TravelPlan } from '../domain/trip'

type PlanIntent = {
  destination: string
  prompt: string
  interests: string[]
  constraints: string[]
  timeBudget: string
  leaveBy: string
  flightStatus?: string
  origin?: Coordinates
}

const stopTemplates = [
  { kind: 'Signature view', stay: '35 min stay', travel: '8 min travel' },
  { kind: 'Local table', stay: '55 min stay', travel: '12 min travel' },
  { kind: 'Quiet finish', stay: '25 min stay', travel: '7 min travel' },
]

export function createTravelPlan(intent: PlanIntent): TravelPlan {
  const destination = intent.destination.trim() || 'Current location'
  const coordinates = intent.origin ?? coordinatesFromText(destination)
  const inferredInterests = inferInterests(intent.prompt, intent.interests)
  const inferredConstraints = inferConstraints(intent.prompt, intent.constraints)
  const interestText = formatList(inferredInterests, 'balanced stops')
  const constraintText = formatList(inferredConstraints, 'your limits')
  const flightContext = intent.flightStatus ? ` Flight watch: ${intent.flightStatus}` : ''

  return {
    id: slugify(destination),
    title: destination === 'Current location' || destination === 'your area'
      ? `Your ${intent.timeBudget} out`
      : `${intent.timeBudget} in ${destination}`,
    area: destination,
    mode: 'walking',
    leaveBy: intent.leaveBy,
    constraint: `Leave by ${intent.leaveBy} to protect the full plan.${flightContext}`,
    stops: stopTemplates.map((template, index) => createStop({
      index,
      destination,
      coordinates,
      interestText,
      constraintText,
      template,
    })),
  }
}

function createStop({
  index,
  destination,
  coordinates,
  interestText,
  constraintText,
  template,
}: {
  index: number
  destination: string
  coordinates: { lat: number; lng: number }
  interestText: string
  constraintText: string
  template: { kind: string; stay: string; travel: string }
}): PlanStop {
  const arrivalTimes = ['2:10 PM', '3:00 PM', '4:15 PM']
  const coordinateOffset = (index - 1) * 0.006

  return {
    id: `${slugify(destination)}-${index + 1}`,
    time: arrivalTimes[index] ?? 'Now',
    title: `${template.kind} near ${destination}`,
    address: `${template.kind}, ${destination}`,
    coordinates: {
      lat: coordinates.lat + coordinateOffset,
      lng: coordinates.lng - coordinateOffset,
    },
    meta: template.stay,
    travel: template.travel,
    why: `Why now: matches ${interestText} and keeps timing flexible.`,
    backup: `Backup nearby: shorter option that still respects ${constraintText}.`,
  }
}

function coordinatesFromText(text: string): { lat: number; lng: number } {
  let hash = 0
  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }

  return {
    lat: 32.7 + (hash % 600) / 10000,
    lng: -117.3 + ((hash >> 8) % 600) / 10000,
  }
}

function formatList(values: string[], fallback: string): string {
  if (values.length === 0) {
    return fallback
  }

  return values.slice(0, 2).join(' and ')
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'plan'
}

export function inferDestination(prompt: string, currentDestination: string): string {
  const destinationMatch = prompt.match(/(?:land at|arrive at|near|around|in|at|to)\s+([a-z0-9][a-z0-9\s.'-]{1,}?)(?:\s+(?:at|with|for|by|before|after|need|want|must)|[,.]|$)/i)
  const candidate = destinationMatch?.[1]?.trim() ?? ''

  if (!candidate || isTimeExpression(candidate)) {
    return currentDestination
  }

  return candidate
}

function isTimeExpression(value: string): boolean {
  return /^\d{1,2}(?::\d{2})?\s*(am|pm)?$/i.test(value.trim())
}

function inferInterests(prompt: string, selectedInterests: string[]): string[] {
  const promptLower = prompt.toLowerCase()
  const inferred = [
    ['Views', ['view', 'sunset', 'scenic', 'photo', 'ocean']],
    ['Food', ['food', 'dinner', 'lunch', 'restaurant', 'coffee']],
    ['History', ['history', 'museum', 'architecture', 'culture']],
    ['Family', ['family', 'kids', 'children']],
    ['Quiet spots', ['quiet', 'calm', 'low noise', 'relaxed']],
  ]
    .filter(([, keywords]) => (keywords as string[]).some((keyword) => promptLower.includes(keyword)))
    .map(([label]) => label as string)

  return [...new Set([...inferred, ...selectedInterests])]
}

function inferConstraints(prompt: string, selectedConstraints: string[]): string[] {
  const promptLower = prompt.toLowerCase()
  const inferred = [
    ['Step-free', ['step-free', 'wheelchair', 'accessible', 'stairs']],
    ['Short walks', ['short walk', 'less walking', 'tired', 'close by']],
    ['Low-noise', ['quiet', 'low noise', 'sensory']],
  ]
    .filter(([, keywords]) => (keywords as string[]).some((keyword) => promptLower.includes(keyword)))
    .map(([label]) => label as string)

  return [...new Set([...inferred, ...selectedConstraints])]
}