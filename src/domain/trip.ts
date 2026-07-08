export type Coordinates = {
  lat: number
  lng: number
}

export type TravelMode = 'walking' | 'driving' | 'transit'

export type PlanStop = {
  id: string
  time: string
  title: string
  address: string
  coordinates: Coordinates
  meta: string
  travel: string
  why: string
  backup: string
}

export type TravelPlan = {
  id: string
  title: string
  area: string
  mode: TravelMode
  leaveBy: string
  constraint: string
  stops: PlanStop[]
}