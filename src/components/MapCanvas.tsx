import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type MapPoint = {
  lat: number
  lng: number
}

type MapCanvasProps = {
  center: MapPoint
  route?: MapPoint[]
  dimmed?: boolean
  theme?: 'light' | 'dark'
}

// Keyless, minimal Apple-Maps-like basemaps (CARTO). Light + dark variants.
const TILE_URL: Record<'light' | 'dark', string> = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
}
const TILE_ATTRIBUTION = '&copy; OpenStreetMap &copy; CARTO'
const ROUTE_COLOR: Record<'light' | 'dark', string> = {
  light: '#4C5DF0',
  dark: '#6E86FF',
}

/**
 * Full-bleed map layer that sits behind the glass UI.
 * The map is the canvas of the whole app; everything else floats on top.
 */
export function MapCanvas({ center, route, dimmed = false, theme = 'light' }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileRef = useRef<L.TileLayer | null>(null)
  const routeRef = useRef<L.Polyline | null>(null)
  const puckRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0.25,
      wheelPxPerZoomLevel: 140,
      fadeAnimation: true,
    })

    tileRef.current = L.tileLayer(TILE_URL[theme], {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 20,
      detectRetina: true,
    }).addTo(map)

    const puckIcon = L.divIcon({
      className: 'map-puck',
      html: '<span class="map-puck-core"></span><span class="map-puck-halo"></span>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    })
    puckRef.current = L.marker([center.lat, center.lng], {
      icon: puckIcon,
      interactive: false,
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      tileRef.current = null
      routeRef.current = null
      puckRef.current = null
    }
    // eslint-disable-next-line
  }, [])

  // Swap basemap tiles when the theme changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !tileRef.current) {
      return
    }
    tileRef.current.setUrl(TILE_URL[theme])
    if (routeRef.current) {
      routeRef.current.setStyle({ color: ROUTE_COLOR[theme] })
    }
  }, [theme])

  // Ease the camera when the location changes rather than cutting.
  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }
    map.flyTo([center.lat, center.lng], map.getZoom(), {
      duration: 0.9,
      easeLinearity: 0.2,
    })
    puckRef.current?.setLatLng([center.lat, center.lng])
  }, [center.lat, center.lng])

  // Draw / update the route line.
  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }
    if (routeRef.current) {
      routeRef.current.remove()
      routeRef.current = null
    }
    if (route && route.length > 1) {
      routeRef.current = L.polyline(
        route.map((point) => [point.lat, point.lng]),
        {
          color: ROUTE_COLOR[theme],
          weight: 6,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        },
      ).addTo(map)
      map.fitBounds(routeRef.current.getBounds(), {
        paddingTopLeft: [40, 60],
        paddingBottomRight: [40, 320],
        animate: true,
        duration: 0.9,
      })
    }
    // eslint-disable-next-line
  }, [route])

  return <div ref={containerRef} className={`map-canvas${dimmed ? ' map-canvas--dimmed' : ''}`} aria-hidden="true" />
}
