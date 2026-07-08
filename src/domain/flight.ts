export type FlightInput = {
  airlineFlight: string
  travelDate: string
  airport: string
  icao24: string
}

export type FlightStatus = {
  provider: 'OpenSky' | 'Local estimate'
  label: string
  detail: string
  lastUpdated: string
  isLive: boolean
}