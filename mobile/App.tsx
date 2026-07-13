import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native'
import MapView, { Marker, Polyline } from 'react-native-maps'
import { BlurView } from 'expo-blur'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as Location from 'expo-location'
import {
  Bookmark,
  Clock,
  Compass,
  Download,
  MapPin,
  Mic,
  Moon,
  Navigation,
  Radar,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Sun,
  SunMedium,
  Timer,
  User,
  WandSparkles,
} from 'lucide-react-native'
import { font, palettes, radius, spacing, type Scheme } from './src/theme'
import type { FlightInput, FlightStatus } from './src/domain/flight'
import type { PlanStop, TravelPlan } from './src/domain/trip'
import { buildItinerary } from './src/services/itinerary'
import { parseIntent } from './src/services/intent'
import { trackFlight } from './src/services/flightTracking'
import { openRouteInMaps, providerLabel, resolveMapProvider } from './src/services/maps'

const { height: SCREEN_H } = Dimensions.get('window')
const FALLBACK = { latitude: 37.7793, longitude: -122.4193 }

type TabId = 'home' | 'plan' | 'saved'
const TABS: Array<{ id: TabId; label: string; Icon: typeof Compass }> = [
  { id: 'home', label: 'Explore', Icon: Compass },
  { id: 'plan', label: 'Plan', Icon: WandSparkles },
  { id: 'saved', label: 'Saved', Icon: Bookmark },
]
const INTERESTS = ['Views', 'Food', 'History', 'Family', 'Quiet spots']
const CONSTRAINTS = ['Step-free', 'Short walks', 'Low-noise']
const TIME_OPTIONS = ['1h', '2h', '3h', '4h+']
const REPLAN = ['Running late', 'Avoid crowds', 'Less walking', 'Bad weather']
type Deadline = 'none' | 'flight' | 'meeting' | 'dinner' | 'custom'
const DEADLINES: Array<{ id: Deadline; label: string }> = [
  { id: 'none', label: 'No deadline' },
  { id: 'flight', label: 'Flight' },
  { id: 'meeting', label: 'Meeting' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'custom', label: 'Custom time' },
]

type Palette = (typeof palettes)['light']

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function minutesUntil(timeStr: string): number | null {
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2])
  const mer = m[3]?.toUpperCase()
  if (mer === 'PM' && h < 12) h += 12
  if (mer === 'AM' && h === 12) h = 0
  const t = new Date()
  t.setHours(h, min, 0, 0)
  const diff = Math.round((t.getTime() - Date.now()) / 60000)
  return diff > 0 ? diff : null
}

const LABELS: Record<string, string> = {
  Restaurant: 'Local bite',
  Cafe: 'Coffee stop',
  Viewpoint: 'Best views',
  Museum: 'Culture pick',
  Attraction: 'Worth a stop',
  Park: 'Green escape',
  Garden: 'Quiet corner',
  Historic: 'Historic',
  Family: 'Family pick',
  Place: 'Local spot',
}

function cartoThumb(lat: number, lng: number, dark: boolean, zoom = 15): string {
  const n = 2 ** zoom
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n)
  return `https://a.basemaps.cartocdn.com/${dark ? 'dark_all' : 'light_all'}/${zoom}/${x}/${y}@2x.png`
}

function GlassCircle({ c, children, onPress }: { c: Palette; children: ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <BlurView intensity={30} tint={c.blurTint} style={[styles.glassCircle, { borderColor: c.hairline, backgroundColor: c.glassStrong }]}>
        {children}
      </BlurView>
    </Pressable>
  )
}

function Chip({ label, on, c, onPress }: { label: string; on: boolean; c: Palette; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, { borderColor: c.hairline, backgroundColor: on ? c.btnFill : c.glass }]}>
      <Text style={{ fontFamily: font.family, fontSize: font.subhead, fontWeight: font.wMedium, color: on ? c.btnText : c.ink }}>{label}</Text>
    </Pressable>
  )
}

function PrimaryButton({ label, c, onPress, Icon, disabled }: { label: string; c: Palette; onPress: () => void; Icon?: typeof Compass; disabled?: boolean }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={[styles.primaryBtn, { backgroundColor: c.btnFill, opacity: disabled ? 0.6 : 1 }]}>
      {Icon && <Icon size={18} color={c.btnText} />}
      <Text style={{ fontFamily: font.family, fontSize: font.body, fontWeight: font.wSemibold, color: c.btnText }}>{label}</Text>
    </Pressable>
  )
}

function CardImage({ image, fallback }: { image?: string; fallback: string }) {
  const [uri, setUri] = useState(image || fallback)
  return <Image source={{ uri }} style={styles.cardThumb} onError={() => setUri(fallback)} />
}

function AppInner() {
  const sysScheme = useColorScheme()
  const [themeMode, setThemeMode] = useState<'auto' | 'light' | 'dark'>('auto')
  const scheme: Scheme = themeMode === 'auto' ? (sysScheme === 'dark' ? 'dark' : 'light') : themeMode
  const c = palettes[scheme]
  const dark = scheme === 'dark'
  const ThemeIcon = themeMode === 'auto' ? SunMedium : themeMode === 'light' ? Sun : Moon
  const cycleTheme = () => setThemeMode((m) => (m === 'auto' ? 'light' : m === 'light' ? 'dark' : 'auto'))
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)

  const [tab, setTab] = useState<TabId>('home')
  const [mapReady, setMapReady] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [destination, setDestination] = useState('')
  const [timeBudget, setTimeBudget] = useState('3h')
  const [leaveBy, setLeaveBy] = useState('5:30 PM')
  const [interests, setInterests] = useState<string[]>([])
  const [constraints, setConstraints] = useState<string[]>([])
  const [deadline, setDeadline] = useState<Deadline>('none')
  const [plan, setPlan] = useState<TravelPlan | null>(null)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState('')
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null)
  const [flightInput, setFlightInput] = useState<FlightInput>({ airlineFlight: '', travelDate: '', airport: '', icao24: '' })
  const [flightStatus, setFlightStatus] = useState<FlightStatus | null>(null)
  const [tracking, setTracking] = useState(false)
  const [toast, setToast] = useState('')

  const provider = resolveMapProvider()
  const returnMinutes = minutesUntil(leaveBy)

  // Bottom sheet: fixed height, animate translateY on the native driver (smooth, no relayout).
  const topGap = insets.top + 60
  const anchorBottom = insets.bottom + 84
  const sheetH = Math.max(320, SCREEN_H - topGap - anchorBottom)
  const SNAP_T = useMemo(() => [0, Math.round(sheetH * 0.46), Math.max(0, sheetH - 132)], [sheetH])
  const translateY = useRef(new Animated.Value(Math.round(SCREEN_H * 0.3))).current
  const currentT = useRef(Math.round(SCREEN_H * 0.3))
  const snapT = (t: number) => {
    currentT.current = t
    Animated.spring(translateY, { toValue: t, useNativeDriver: true, damping: 26, stiffness: 220, mass: 0.9 }).start()
  }
  useEffect(() => {
    snapT(SNAP_T[1])
    // eslint-disable-next-line
  }, [])
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
        onPanResponderMove: (_e, g) => {
          const next = Math.max(0, Math.min(SNAP_T[2], currentT.current + g.dy))
          translateY.setValue(next)
        },
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dy) < 6) {
            snapT(currentT.current >= SNAP_T[2] - 4 ? SNAP_T[1] : SNAP_T[2])
            return
          }
          const projected = currentT.current + g.dy
          const nearest = SNAP_T.reduce((a, b) => (Math.abs(b - projected) < Math.abs(a - projected) ? b : a))
          snapT(nearest)
        },
      }),
    [translateY, SNAP_T],
  )

  useEffect(() => {
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') return
        const pos = await Location.getCurrentPositionAsync({})
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setOrigin(coords)
        mapRef.current?.animateToRegion({ latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 700)
      } catch {
        /* keep fallback */
      }
    })()
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }
  const toggle = (val: string, list: string[], set: (v: string[]) => void) =>
    set(list.includes(val) ? list.filter((x) => x !== val) : [...list, val])

  const build = async (destText: string, overrideInterests?: string[]) => {
    setBuilding(true)
    setError('')
    if (currentT.current > SNAP_T[1]) snapT(SNAP_T[1])
    const result = await buildItinerary({
      destinationText: destText,
      interests: overrideInterests ?? interests,
      constraints,
      timeBudget,
      leaveBy,
      flightStatus: deadline === 'flight' ? flightStatus?.label : undefined,
      origin: origin ?? undefined,
    })
    setBuilding(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setPlan(result.plan)
    snapT(SNAP_T[0])
    const coords = result.plan.stops.map((s) => ({ latitude: s.coordinates.lat, longitude: s.coordinates.lng }))
    setTimeout(() => mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 120, right: 60, bottom: SCREEN_H * 0.5, left: 60 }, animated: true }), 250)
    showToast('Itinerary ready')
  }

  const handlePrompt = (text: string) => {
    const it = parseIntent(text)
    if (it.location) setDestination(it.location)
    if (it.leaveBy) setLeaveBy(it.leaveBy)
    if (it.deadline) setDeadline(it.deadline)
    if (it.flight) setFlightInput((f) => ({ ...f, airlineFlight: it.flight as string }))
    if (it.interests.length) setInterests(it.interests)
    build(it.location || text, it.interests.length ? it.interests : undefined)
  }

  const focusStop = (lat: number, lng: number) => mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 600)
  const handleTrack = async () => {
    setTracking(true)
    const status = await trackFlight(flightInput)
    setFlightStatus(status)
    setTracking(false)
    showToast(status.isLive ? 'Live flight signal found' : 'Flight watch enabled')
  }

  const routeCoords = plan?.stops.map((s) => ({ latitude: s.coordinates.lat, longitude: s.coordinates.lng })) ?? []

  return (
    <View style={[styles.root, { backgroundColor: c.appBg }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...FALLBACK, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle={scheme}
        onMapReady={() => setMapReady(true)}
      >
        {plan?.stops.map((s) => (
          <Marker key={s.id} coordinate={{ latitude: s.coordinates.lat, longitude: s.coordinates.lng }} title={s.title} description={s.meta} />
        ))}
        {routeCoords.length > 1 && <Polyline coordinates={routeCoords} strokeColor={c.accent} strokeWidth={5} />}
      </MapView>

      {!mapReady && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.appBg, alignItems: 'center', justifyContent: 'center', gap: 12 }]} pointerEvents="none">
          <ActivityIndicator color={c.accent} />
          <Text style={{ color: c.ink3, fontFamily: font.family, fontSize: font.subhead }}>Loading map…</Text>
        </View>
      )}

      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <GlassCircle c={c}>
          <User size={20} color={c.ink} />
        </GlassCircle>
        <View style={styles.topRight}>
          <GlassCircle c={c} onPress={cycleTheme}>
            <ThemeIcon size={20} color={c.ink} />
          </GlassCircle>
          <GlassCircle c={c} onPress={() => origin && focusStop(origin.lat, origin.lng)}>
            <Compass size={20} color={c.ink} />
          </GlassCircle>
        </View>
      </View>

      {toast ? (
        <View style={[styles.toast, { bottom: insets.bottom + 84 + 12 }]}>
          <Text style={{ color: '#fff', fontFamily: font.family, fontSize: font.subhead, fontWeight: font.wMedium }}>{toast}</Text>
        </View>
      ) : null}

      <Animated.View style={[styles.sheet, { height: sheetH, bottom: anchorBottom, backgroundColor: c.glassStrong, borderColor: c.hairline, transform: [{ translateY }] }]}>
        <View style={styles.grabberZone} {...pan.panHandlers}>
          <View style={[styles.grabber, { backgroundColor: c.hairlineStrong }]} />
        </View>
        <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {tab === 'home' && HomeView()}
          {tab === 'plan' && PlanView()}
          {tab === 'saved' && SavedView()}
        </ScrollView>
      </Animated.View>

      <View style={[styles.tabBarWrap, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
        <BlurView intensity={40} tint={c.blurTint} style={[styles.tabBar, { borderColor: c.hairline, backgroundColor: c.glassStrong }]}>
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id
            return (
              <Pressable key={id} onPress={() => setTab(id)} style={[styles.tabItem, active && { backgroundColor: c.tabActive }]}>
                <Icon size={19} color={active ? c.ink : c.ink3} />
                {active && <Text style={[styles.tabLabel, { color: c.ink }]}>{label}</Text>}
              </Pressable>
            )
          })}
        </BlurView>
      </View>
    </View>
  )

  function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
    return (
      <View>
        <Text style={[styles.eyebrow, { color: c.ink3 }]}>{eyebrow}</Text>
        <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
      </View>
    )
  }

  function SuggestionCard({ stop, index }: { stop: PlanStop; index: number }) {
    const category = stop.meta.split(' · ')[0]
    return (
      <Pressable onPress={() => focusStop(stop.coordinates.lat, stop.coordinates.lng)} style={[styles.card, { borderColor: c.hairline, backgroundColor: c.glass }]}>
        <View style={styles.cardThumbWrap}>
          <CardImage image={stop.image} fallback={cartoThumb(stop.coordinates.lat, stop.coordinates.lng, dark)} />
          <View style={[styles.cardLabel, { backgroundColor: stop.popular ? c.accent : dark ? 'rgba(20,22,28,0.82)' : 'rgba(255,255,255,0.9)' }]}>
            <Text style={{ fontFamily: font.family, fontSize: font.caption, fontWeight: font.wSemibold, color: stop.popular ? '#fff' : c.ink }}>{stop.popular ? 'Popular now' : LABELS[category] ?? 'Local spot'}</Text>
          </View>
          <View style={[styles.cardIndex, { backgroundColor: c.btnFill }]}>
            <Text style={{ color: c.btnText, fontFamily: font.family, fontWeight: font.wBold, fontSize: font.caption }}>{index + 1}</Text>
          </View>
        </View>
        <View style={{ padding: 14, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Clock size={12} color={c.ink3} />
            <Text style={{ color: c.ink3, fontFamily: font.family, fontSize: font.caption, fontWeight: font.wSemibold }}>{stop.time} · {stop.travel}</Text>
          </View>
          <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.family, fontSize: font.headline, fontWeight: font.wSemibold }}>{stop.title}</Text>
          <Text numberOfLines={2} style={{ color: c.ink2, fontFamily: font.family, fontSize: font.subhead, lineHeight: 18 }}>{stop.why}</Text>
          <Text style={{ color: c.ink3, fontFamily: font.family, fontSize: font.caption, marginTop: 2 }}>{stop.meta}</Text>
        </View>
      </Pressable>
    )
  }

  function BuildStateOrEmpty({ emptyTitle, emptyBody }: { emptyTitle: string; emptyBody: string }) {
    if (building) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator color={c.accent} />
          <Text style={[styles.emptyTitle, { color: c.ink }]}>Finding real places…</Text>
          <Text style={[styles.emptyBody, { color: c.ink2 }]}>Reading the map, reviews, and timing for your window.</Text>
        </View>
      )
    }
    if (error) {
      return (
        <View style={styles.emptyState}>
          <View style={[styles.emptyGlyph, { backgroundColor: c.track }]}>
            <Navigation size={24} color={c.warn} />
          </View>
          <Text style={[styles.emptyTitle, { color: c.ink }]}>Couldn&rsquo;t build that</Text>
          <Text style={[styles.emptyBody, { color: c.ink2 }]}>{error}</Text>
        </View>
      )
    }
    return (
      <View style={styles.emptyState}>
        <View style={[styles.emptyGlyph, { backgroundColor: c.track }]}>
          <Navigation size={24} color={c.ink2} />
        </View>
        <Text style={[styles.emptyTitle, { color: c.ink }]}>{emptyTitle}</Text>
        <Text style={[styles.emptyBody, { color: c.ink2 }]}>{emptyBody}</Text>
      </View>
    )
  }

  function HomeView() {
    return (
      <View style={{ gap: spacing.s5 }}>
        <SectionTitle eyebrow={greeting()} title="Where to today?" />
        <View style={[styles.pill, { backgroundColor: c.glass, borderColor: c.hairline }]}>
          <Search size={20} color={c.ink3} />
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            onSubmitEditing={() => prompt.trim() && handlePrompt(prompt.trim())}
            returnKeyType="search"
            placeholder="Where to — e.g. Miami, Dallas, Torrey Pines"
            placeholderTextColor={c.ink3}
            style={[styles.pillInput, { color: c.ink }]}
          />
          <Pressable onPress={() => prompt.trim() && handlePrompt(prompt.trim())} style={[styles.micBtn, { backgroundColor: c.btnFill }]}>
            <Mic size={18} color={c.btnText} />
          </Pressable>
        </View>
        {plan && !building && !error ? (
          <View style={{ gap: 14 }}>
            <View style={styles.railHeader}>
              <Text style={[styles.h2, { color: c.ink }]}>{plan.title}</Text>
              <Text style={{ color: c.ink3, fontFamily: font.family, fontSize: font.subhead }}>{plan.stops.length} stops</Text>
            </View>
            {plan.stops.map((s, i) => (
              <SuggestionCard key={s.id} stop={s} index={i} />
            ))}
          </View>
        ) : (
          <BuildStateOrEmpty emptyTitle="Plan your day" emptyBody="Type a city or spot and I'll build a real, time-aware plan from what's actually nearby." />
        )}
      </View>
    )
  }

  function PlanView() {
    const setF = (k: keyof FlightInput, v: string) => setFlightInput((cur) => ({ ...cur, [k]: v }))
    const urgent = returnMinutes != null && returnMinutes <= 45
    return (
      <View style={{ gap: spacing.s5 }}>
        <SectionTitle eyebrow="AI planner" title="Plan in your words" />

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <WandSparkles size={15} color={c.ink3} />
            <Text style={[styles.label, { color: c.ink2 }]}>Destination</Text>
          </View>
          <TextInput value={destination} onChangeText={setDestination} placeholder="City, area, or landmark" placeholderTextColor={c.ink3} style={[styles.input, { color: c.ink, borderColor: c.hairline, backgroundColor: c.glass }]} />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: c.ink2 }]}>Time available</Text>
          <View style={styles.segmented}>
            {TIME_OPTIONS.map((opt) => (
              <Pressable key={opt} onPress={() => setTimeBudget(opt)} style={[styles.segment, timeBudget === opt && { backgroundColor: c.trackActive }]}>
                <Text style={{ fontFamily: font.family, fontSize: 15, fontWeight: font.wSemibold, color: timeBudget === opt ? c.ink : c.ink2 }}>{opt}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={[styles.label, { color: c.ink2 }]}>Do you have a deadline later?</Text>
          <View style={styles.chipRow}>
            {DEADLINES.map((d) => (
              <Chip key={d.id} label={d.label} on={deadline === d.id} c={c} onPress={() => setDeadline(d.id)} />
            ))}
          </View>
        </View>

        {deadline !== 'none' && (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Clock size={15} color={c.ink3} />
              <Text style={[styles.label, { color: c.ink2 }]}>Must be back / free by</Text>
            </View>
            <TextInput value={leaveBy} onChangeText={setLeaveBy} placeholder="5:30 PM" placeholderTextColor={c.ink3} style={[styles.input, { color: c.ink, borderColor: c.hairline, backgroundColor: c.glass }]} />
            {returnMinutes != null && (
              <View style={[styles.banner, { backgroundColor: urgent ? 'rgba(228,121,27,0.12)' : c.glass, borderColor: c.hairline }]}>
                <Timer size={16} color={urgent ? c.warn : c.accent} />
                <Text style={{ flex: 1, color: c.ink, fontFamily: font.family, fontSize: font.subhead }}>
                  {urgent ? `Only ${returnMinutes} min left — keep it close and leave soon.` : `You have about ${returnMinutes} min. I'll keep the plan inside that window.`}
                </Text>
              </View>
            )}
          </View>
        )}

        {deadline === 'flight' && (
          <View style={{ gap: 12 }}>
            <View style={styles.fieldGrid}>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={[styles.label, { color: c.ink2 }]}>Flight</Text>
                <TextInput value={flightInput.airlineFlight} onChangeText={(v) => setF('airlineFlight', v)} placeholder="AA 100" placeholderTextColor={c.ink3} style={[styles.input, { color: c.ink, borderColor: c.hairline, backgroundColor: c.glass }]} />
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={[styles.label, { color: c.ink2 }]}>Airport</Text>
                <TextInput value={flightInput.airport} onChangeText={(v) => setF('airport', v)} placeholder="SFO" placeholderTextColor={c.ink3} style={[styles.input, { color: c.ink, borderColor: c.hairline, backgroundColor: c.glass }]} />
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={[styles.label, { color: c.ink2 }]}>ICAO24 (live tracking)</Text>
              <TextInput value={flightInput.icao24} onChangeText={(v) => setF('icao24', v)} placeholder="a1b2c3 hex code" placeholderTextColor={c.ink3} autoCapitalize="none" style={[styles.input, { color: c.ink, borderColor: c.hairline, backgroundColor: c.glass }]} />
            </View>
            <PrimaryButton label={tracking ? 'Checking flight…' : 'Track flight'} Icon={Radar} c={c} disabled={tracking} onPress={handleTrack} />
            {flightStatus ? (
              <View style={[styles.statusCard, { borderColor: c.hairline, backgroundColor: c.glass }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: flightStatus.isLive ? c.positive : c.ink3 }} />
                  <Text style={{ flex: 1, color: c.ink, fontFamily: font.family, fontSize: font.headline, fontWeight: font.wSemibold }}>{flightStatus.label}</Text>
                  <Text style={{ color: c.ink3, fontFamily: font.family, fontSize: font.caption }}>{flightStatus.provider}</Text>
                </View>
                <Text style={{ color: c.ink2, fontFamily: font.family, fontSize: font.subhead, marginTop: 6 }}>{flightStatus.detail}</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={{ gap: 10 }}>
          <Text style={[styles.label, { color: c.ink2 }]}>Interests</Text>
          <View style={styles.chipRow}>
            {INTERESTS.map((v) => (
              <Chip key={v} label={v} on={interests.includes(v)} c={c} onPress={() => toggle(v, interests, setInterests)} />
            ))}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={[styles.label, { color: c.ink2 }]}>Constraints to protect</Text>
          <View style={styles.chipRow}>
            {CONSTRAINTS.map((v) => (
              <Chip key={v} label={v} on={constraints.includes(v)} c={c} onPress={() => toggle(v, constraints, setConstraints)} />
            ))}
          </View>
        </View>

        <PrimaryButton label={plan ? 'Rebuild itinerary' : 'Build itinerary'} Icon={Sparkles} c={c} disabled={building} onPress={() => build(destination.trim() || prompt.trim())} />
        {building || error ? <BuildStateOrEmpty emptyTitle="" emptyBody="" /> : null}

        {plan && !building ? (
          <>
            <View style={[styles.banner, { backgroundColor: 'rgba(228,121,27,0.10)', borderColor: 'rgba(228,121,27,0.24)' }]}>
              <MapPin size={16} color={c.warn} />
              <Text style={{ flex: 1, color: c.ink, fontFamily: font.family, fontSize: font.subhead, lineHeight: 18 }}>{plan.constraint}</Text>
            </View>
            <View style={styles.railHeader}>
              <Text style={[styles.h2, { color: c.ink }]}>{plan.title}</Text>
              <Text style={{ color: c.ink3, fontFamily: font.family, fontSize: font.subhead }}>{plan.stops.length} stops</Text>
            </View>
            {plan.stops.map((s, i) => (
              <View key={s.id} style={styles.timelineItem}>
                <View style={styles.timelineMarkerCol}>
                  <View style={[styles.timelineDot, { borderColor: c.accent, backgroundColor: c.glassStrong }]} />
                  {i < plan.stops.length - 1 && <View style={[styles.timelineLine, { backgroundColor: c.hairlineStrong }]} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 18 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: c.ink, fontFamily: font.family, fontSize: font.subhead, fontWeight: font.wSemibold }}>{s.time}</Text>
                    <Text style={{ color: c.ink3, fontFamily: font.family, fontSize: font.caption }}>{s.travel}</Text>
                  </View>
                  <Text style={{ color: c.ink, fontFamily: font.family, fontSize: font.headline, fontWeight: font.wSemibold, marginTop: 2 }}>{s.title}</Text>
                  <Text style={{ color: c.ink2, fontFamily: font.family, fontSize: font.subhead, marginTop: 2 }}>{s.why}</Text>
                </View>
              </View>
            ))}
            <View style={{ gap: 10 }}>
              <Text style={[styles.label, { color: c.ink2 }]}>One-tap replan</Text>
              <View style={styles.chipRow}>
                {REPLAN.map((o) => (
                  <Pressable key={o} onPress={() => build(destination.trim() || prompt.trim())} style={[styles.ghostChip, { borderColor: c.hairline, backgroundColor: c.glass }]}>
                    <RefreshCw size={13} color={c.ink3} />
                    <Text style={{ color: c.ink, fontFamily: font.family, fontSize: font.subhead, fontWeight: font.wMedium }}>{o}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <PrimaryButton label="Start route" Icon={Navigation} c={c} onPress={() => openRouteInMaps(provider, plan)} />
            <Text style={{ textAlign: 'center', color: c.ink3, fontFamily: font.family, fontSize: font.caption }}>Opens in {providerLabel(provider)}</Text>
          </>
        ) : null}
      </View>
    )
  }

  function SavedView() {
    const stops = plan?.stops ?? []
    return (
      <View style={{ gap: spacing.s5 }}>
        <SectionTitle eyebrow="Your library" title="Saved" />
        <View style={styles.statRow}>
          <View style={[styles.stat, { borderColor: c.hairline, backgroundColor: c.glass }]}>
            <Text style={{ color: c.ink, fontFamily: font.family, fontSize: font.title2, fontWeight: font.wBold }}>{stops.length}</Text>
            <Text style={{ color: c.ink3, fontFamily: font.family, fontSize: font.caption }}>Stops</Text>
          </View>
          <View style={[styles.stat, { borderColor: c.hairline, backgroundColor: c.glass }]}>
            <Text style={{ color: c.ink, fontFamily: font.family, fontSize: font.title2, fontWeight: font.wBold }}>{stops.length ? leaveBy : '—'}</Text>
            <Text style={{ color: c.ink3, fontFamily: font.family, fontSize: font.caption }}>Back by</Text>
          </View>
          <View style={[styles.stat, { borderColor: c.hairline, backgroundColor: c.glass }]}>
            <Text style={{ color: c.ink, fontFamily: font.family, fontSize: font.title2, fontWeight: font.wBold }}>{stops.length ? 'Ready' : '—'}</Text>
            <Text style={{ color: c.ink3, fontFamily: font.family, fontSize: font.caption }}>Route</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable onPress={() => showToast('Trip link copied')} style={[styles.secondaryBtn, { borderColor: c.hairline, backgroundColor: c.glass }]}>
            <Share2 size={18} color={c.ink} />
            <Text style={{ color: c.ink, fontFamily: font.family, fontWeight: font.wSemibold }}>Share</Text>
          </Pressable>
          <Pressable onPress={() => showToast('Summary exported')} style={[styles.secondaryBtn, { borderColor: c.hairline, backgroundColor: c.glass }]}>
            <Download size={18} color={c.ink} />
            <Text style={{ color: c.ink, fontFamily: font.family, fontWeight: font.wSemibold }}>Export</Text>
          </Pressable>
        </View>
        {stops.length === 0 ? (
          <BuildStateOrEmpty emptyTitle="Nothing saved yet" emptyBody="Plans you build appear here, ready to reopen on the map." />
        ) : (
          stops.map((s, i) => (
            <Pressable key={s.id} onPress={() => { setTab('home'); focusStop(s.coordinates.lat, s.coordinates.lng) }} style={[styles.stopCard, { borderColor: c.hairline, backgroundColor: c.glass }]}>
              <View style={[styles.stopIndex, { backgroundColor: c.btnFill, borderRadius: 12, width: 40, height: 40 }]}>
                <Text style={{ color: c.btnText, fontFamily: font.family, fontWeight: font.wBold }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: c.ink, fontFamily: font.family, fontSize: font.headline, fontWeight: font.wSemibold }}>{s.title}</Text>
                <Text style={{ color: c.ink2, fontFamily: font.family, fontSize: font.subhead }}>{s.time} · {s.meta}</Text>
              </View>
              <MapPin size={18} color={c.ink3} />
            </Pressable>
          ))
        )}
      </View>
    )
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 3 },
  topRight: { flexDirection: 'row', gap: 10 },
  glassCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  toast: { position: 'absolute', alignSelf: 'center', zIndex: 6, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999, backgroundColor: 'rgba(11,18,32,0.92)' },
  sheet: { position: 'absolute', left: 0, right: 0, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderWidth: 1, borderBottomWidth: 0, overflow: 'hidden', zIndex: 4 },
  grabberZone: { alignItems: 'center', justifyContent: 'center', height: 44, paddingTop: 4 },
  grabber: { width: 44, height: 5, borderRadius: 999 },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 40 },
  eyebrow: { fontFamily: font.family, fontSize: font.subhead, fontWeight: font.wMedium, marginBottom: 2 },
  title: { fontFamily: font.family, fontSize: font.display, fontWeight: font.wBold, letterSpacing: -0.5 },
  h2: { fontFamily: font.family, fontSize: font.title2, fontWeight: font.wSemibold },
  label: { fontFamily: font.family, fontSize: font.subhead, fontWeight: font.wSemibold },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingLeft: 16, paddingRight: 12, borderRadius: radius.pill, borderWidth: 1 },
  pillInput: { flex: 1, fontFamily: font.family, fontSize: font.body, fontWeight: font.wMedium },
  micBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: radius.card, paddingVertical: 13, paddingHorizontal: 14, fontFamily: font.family, fontSize: font.body },
  fieldGrid: { flexDirection: 'row', gap: 12 },
  segmented: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.card, backgroundColor: 'rgba(127,127,127,0.10)' },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  ghostChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: radius.pill, paddingHorizontal: 18 },
  secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: radius.pill, borderWidth: 1 },
  banner: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: radius.card, borderWidth: 1, alignItems: 'center' },
  railHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  card: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  cardThumbWrap: { height: 128, backgroundColor: 'rgba(127,127,127,0.12)' },
  cardThumb: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  cardLabel: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  cardIndex: { position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stopCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.card, borderWidth: 1 },
  stopIndex: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineMarkerCol: { width: 20, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, marginTop: 2 },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyGlyph: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: font.family, fontSize: font.title2, fontWeight: font.wSemibold },
  emptyBody: { fontFamily: font.family, fontSize: font.subhead, textAlign: 'center', maxWidth: 280, lineHeight: 19 },
  statusCard: { padding: 14, borderRadius: radius.card, borderWidth: 1 },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, gap: 2, padding: 14, borderRadius: radius.card, borderWidth: 1 },
  tabBarWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 5 },
  tabBar: { flexDirection: 'row', gap: 2, padding: 6, borderRadius: radius.pill, borderWidth: 1, overflow: 'hidden' },
  tabItem: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.pill },
  tabLabel: { fontFamily: font.family, fontSize: font.subhead, fontWeight: font.wSemibold },
})
