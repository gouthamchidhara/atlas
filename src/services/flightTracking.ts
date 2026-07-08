import type { FlightInput, FlightStatus } from '../domain/flight'

type OpenSkyStateResponse = {
  time: number
  states: Array<Array<string | number | boolean | null>> | null
}

export async function trackFlight(input: FlightInput): Promise<FlightStatus> {
  const icao24 = input.icao24.trim().toLowerCase()

  if (icao24.length >= 6) {
    try {
      const response = await fetch(`https://opensky-network.org/api/states/all?icao24=${encodeURIComponent(icao24)}`)
      if (response.ok) {
        const data = await response.json() as OpenSkyStateResponse
        const state = data.states?.[0]

        if (state) {
          const callsign = String((state[1] ?? input.airlineFlight) || icao24).trim()
          const onGround = Boolean(state[8])
          const altitude = typeof state[7] === 'number' ? Math.round(state[7] * 3.28084) : null
          const speed = typeof state[9] === 'number' ? Math.round(state[9] * 2.23694) : null

          return {
            provider: 'OpenSky',
            label: onGround ? `${callsign} on ground` : `${callsign} in flight`,
            detail: formatLiveDetail(altitude, speed),
            lastUpdated: new Date(data.time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            isLive: true,
          }
        }
      }
    } catch {
      return createLocalFlightStatus(input, 'Live lookup unavailable. Using trip-safe estimate.')
    }
  }

  return createLocalFlightStatus(input, 'Add ICAO24 hex code for OpenSky live ADS-B lookup.')
}

function createLocalFlightStatus(input: FlightInput, detail: string): FlightStatus {
  const flight = input.airlineFlight.trim() || 'Flight'
  const airport = input.airport.trim() || 'airport'

  return {
    provider: 'Local estimate',
    label: `${flight} watch enabled`,
    detail: `${detail} We will protect arrival buffers around ${airport}.`,
    lastUpdated: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    isLive: false,
  }
}

function formatLiveDetail(altitude: number | null, speed: number | null): string {
  const altitudeText = altitude ? `${altitude.toLocaleString()} ft` : 'altitude unavailable'
  const speedText = speed ? `${speed} mph` : 'speed unavailable'

  return `Live ADS-B signal: ${altitudeText}, ${speedText}. Plan will preserve transfer buffer.`
}