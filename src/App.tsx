import { useEffect, useMemo, useState } from 'react'
import { Bookmark, Compass, Moon, Plane, Sun, SunMoon, User, WandSparkles } from 'lucide-react'
import { MapCanvas } from './components/MapCanvas'
import { BottomSheet, type Detent } from './components/BottomSheet'
import { FloatingTabBar, type TabId } from './components/FloatingTabBar'
import { HomeView } from './views/HomeView'
import { PlanView } from './views/PlanView'
import { FlightsView } from './views/FlightsView'
import { SavedView } from './views/SavedView'
import { FALLBACK_CENTER, stopToCard } from './data/places'
import type { FlightInput, FlightStatus } from './domain/flight'
import type { TravelPlan } from './domain/trip'
import { inferDestination } from './services/planner'
import { buildItinerary } from './services/itinerary'
import { trackFlight } from './services/flightTracking'
import { getPreferredMapProvider, openRouteInMaps, resolveMapProvider } from './services/maps'
import './App.css'

type ThemeMode = 'auto' | 'light' | 'dark'

const tabs = [
  { id: 'home' as const, label: 'Explore', icon: Compass },
  { id: 'plan' as const, label: 'Plan', icon: WandSparkles },
  { id: 'flights' as const, label: 'Flights', icon: Plane },
  { id: 'saved' as const, label: 'Saved', icon: Bookmark },
]

const interestOptions = ['Views', 'Food', 'History', 'Family', 'Quiet spots']
const constraintOptions = ['Step-free', 'Short walks', 'Low-noise']

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function minutesUntil(timeStr: string): number | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!match) return null
  let hours = Number(match[1])
  const mins = Number(match[2])
  const meridiem = match[3]?.toUpperCase()
  if (meridiem === 'PM' && hours < 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  const target = new Date()
  target.setHours(hours, mins, 0, 0)
  const diff = Math.round((target.getTime() - Date.now()) / 60000)
  return diff > 0 ? diff : null
}

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return dark
}

function App() {
  const [tab, setTab] = useState<TabId>('home')
  const [detent, setDetent] = useState<Detent>('medium')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [promptFocused, setPromptFocused] = useState(false)

  const [timeBudget, setTimeBudget] = useState('3h')
  const [leaveBy, setLeaveBy] = useState('5:30 PM')
  const [destination, setDestination] = useState('')
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [selectedConstraints, setSelectedConstraints] = useState<string[]>([])
  const [plan, setPlan] = useState<TravelPlan | null>(null)
  const [isBuilding, setIsBuilding] = useState(false)

  const [flightInput, setFlightInput] = useState<FlightInput>({ airlineFlight: '', travelDate: '', airport: '', icao24: '' })
  const [flightStatus, setFlightStatus] = useState<FlightStatus | null>(null)
  const [isTracking, setIsTracking] = useState(false)

  const [toast, setToast] = useState('')
  const [userCenter, setUserCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    () => (localStorage.getItem('atlas-theme') as ThemeMode | null) ?? 'auto',
  )

  const prefersDark = usePrefersDark()
  const theme: 'light' | 'dark' = themeMode === 'auto' ? (prefersDark ? 'dark' : 'light') : themeMode

  // Real geolocation for the map. Falls back to a neutral camera on denial.
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (position) => setUserCenter({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setUserCenter(null),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }, [])

  useEffect(() => {
    localStorage.setItem('atlas-theme', themeMode)
  }, [themeMode])

  const provider = resolveMapProvider()
  const providerLabel = getPreferredMapProvider().label

  const cards = useMemo(() => (plan ? plan.stops.map(stopToCard) : []), [plan])
  const activeCard = cards.find((card) => card.id === activeId) ?? null

  const center = activeCard
    ? { lat: activeCard.lat, lng: activeCard.lng }
    : plan?.stops[0]?.coordinates ?? userCenter ?? FALLBACK_CENTER
  const route = tab === 'plan' && plan ? plan.stops.map((stop) => stop.coordinates) : undefined
  const returnMinutes = minutesUntil(leaveBy)

  const themeMeta: Record<ThemeMode, { icon: typeof Sun; label: string }> = {
    auto: { icon: SunMoon, label: 'Appearance: automatic' },
    light: { icon: Sun, label: 'Appearance: light' },
    dark: { icon: Moon, label: 'Appearance: dark' },
  }
  const ThemeIcon = themeMeta[themeMode].icon

  const cycleTheme = () => {
    setThemeMode((current) => (current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto'))
  }

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  const toggle = (value: string, values: string[], set: (next: string[]) => void) => {
    set(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  }

  const selectCard = (id: string) => {
    setActiveId(id)
    if (detent === 'peek') setDetent('medium')
  }

  const generatePlan = async () => {
    if (isBuilding) return
    const destinationText = destination.trim() || inferDestination(prompt, '') || prompt.trim()
    setIsBuilding(true)
    showToast('Finding real places…')
    const result = await buildItinerary({
      destinationText,
      interests: selectedInterests,
      constraints: selectedConstraints,
      timeBudget,
      leaveBy,
      flightStatus: flightStatus?.label,
      origin: userCenter ?? undefined,
    })
    setIsBuilding(false)
    if ('error' in result) {
      showToast(result.error)
      return
    }
    setPlan(result.plan)
    setActiveId(null)
    setDetent('large')
    showToast(`Itinerary ready · ${result.plan.area}`)
  }

  const submitPromptFromHome = async () => {
    setTab('plan')
    await generatePlan()
  }

  const replan = async (option: string) => {
    await generatePlan()
    showToast(`Replanned · ${option}`)
  }

  const handleDirections = () => {
    if (plan) openRouteInMaps(provider, plan)
  }

  const updateFlightField = (field: keyof FlightInput, value: string) => {
    setFlightInput((current) => ({ ...current, [field]: value }))
  }

  const handleTrackFlight = async () => {
    setIsTracking(true)
    const status = await trackFlight(flightInput)
    setFlightStatus(status)
    setIsTracking(false)
    showToast(status.isLive ? 'Live flight signal found' : 'Flight watch enabled')
  }

  const changeTab = (next: TabId) => {
    setTab(next)
    setPromptFocused(false)
    if (next !== 'home') setActiveId(null)
    if (detent === 'peek') setDetent('medium')
  }

  return (
    <main className="app-root" data-theme={theme}>
      <MapCanvas center={center} route={route} dimmed={promptFocused} theme={theme} />
      <div className="map-scrim" aria-hidden="true" />

      <header className="floating-controls">
        <button className="glass-circle" type="button" aria-label="Your profile">
          <User aria-hidden="true" />
        </button>
        <div className="floating-controls-right">
          <button className="glass-circle" type="button" aria-label={themeMeta[themeMode].label} onClick={cycleTheme}>
            <ThemeIcon aria-hidden="true" />
          </button>
          <button className="glass-circle" type="button" aria-label="Recenter on my location" onClick={() => setActiveId(null)}>
            <Compass aria-hidden="true" />
          </button>
        </div>
      </header>

      {activeCard && (
        <div className="map-place-label" role="status">
          <span className="map-place-dot" aria-hidden="true" />
          {activeCard.title}
        </div>
      )}

      <BottomSheet detent={detent} onDetentChange={setDetent}>
        {tab === 'home' && (
          <HomeView
            cards={cards}
            activeId={activeId}
            onSelectCard={selectCard}
            prompt={prompt}
            onPromptChange={setPrompt}
            promptFocused={promptFocused}
            onPromptFocus={() => {
              setPromptFocused(true)
              setDetent('large')
            }}
            onPromptBlur={() => setPromptFocused(false)}
            onSubmitPrompt={submitPromptFromHome}
            greeting={greeting()}
            planTitle={plan?.title ?? null}
            theme={theme}
            isBuilding={isBuilding}
          />
        )}

        {tab === 'plan' && (
          <PlanView
            prompt={prompt}
            onPromptChange={setPrompt}
            destination={destination}
            onDestinationChange={setDestination}
            timeBudget={timeBudget}
            onTimeBudgetChange={setTimeBudget}
            leaveBy={leaveBy}
            onLeaveByChange={setLeaveBy}
            interests={interestOptions}
            selectedInterests={selectedInterests}
            onToggleInterest={(value) => toggle(value, selectedInterests, setSelectedInterests)}
            constraints={constraintOptions}
            selectedConstraints={selectedConstraints}
            onToggleConstraint={(value) => toggle(value, selectedConstraints, setSelectedConstraints)}
            plan={plan}
            isBuilding={isBuilding}
            onGenerate={generatePlan}
            onReplan={replan}
            onDirections={handleDirections}
            providerLabel={providerLabel}
          />
        )}

        {tab === 'flights' && (
          <FlightsView
            flightInput={flightInput}
            onFieldChange={updateFlightField}
            onTrack={handleTrackFlight}
            isTracking={isTracking}
            status={flightStatus}
            leaveBy={leaveBy}
            returnMinutes={returnMinutes}
          />
        )}

        {tab === 'saved' && (
          <SavedView
            cards={cards}
            leaveBy={leaveBy}
            onSelectCard={(id) => {
              setTab('home')
              selectCard(id)
            }}
            onShare={() => showToast('Trip link copied')}
            onExport={() => showToast('Summary exported')}
          />
        )}
      </BottomSheet>

      <FloatingTabBar active={tab} onChange={changeTab} tabs={tabs} />

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  )
}

export default App
