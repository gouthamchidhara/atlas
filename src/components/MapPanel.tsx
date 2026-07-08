import type { CSSProperties } from 'react'
import type { TravelPlan } from '../domain/trip'
import {
  getAppleMapsRouteUrl,
  getGoogleDirectionsUrl,
  getGoogleEmbedUrl,
  getPreferredMapProvider,
  openRouteInMaps,
} from '../services/maps'

type MapPanelProps = {
  plan: TravelPlan
}

export function MapPanel({ plan }: MapPanelProps) {
  const providerStatus = getPreferredMapProvider()
  const googleEmbedUrl = getGoogleEmbedUrl(plan)

  return (
    <section className="map-panel" aria-label="Route map summary">
      <div className="map-toolbar">
        <div>
          <p className="eyebrow">Map provider</p>
          <h2>{providerStatus.label}</h2>
        </div>
        <span className={providerStatus.isConfigured ? 'status ready' : 'status'}>
          {providerStatus.isConfigured ? 'Configured' : 'Setup needed'}
        </span>
      </div>

      {googleEmbedUrl ? (
        <iframe
          title={`${plan.title} route in Google Maps`}
          src={googleEmbedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div className="map-fallback" role="img" aria-label={`${plan.area} route preview`}>
          {plan.stops.map((stop, index) => (
            <span key={stop.id} style={{ '--stop-index': index } as CSSProperties}>
              {index + 1}
            </span>
          ))}
        </div>
      )}

      {!providerStatus.isConfigured && <p className="state-copy">{providerStatus.missingConfig}</p>}

      <div className="map-actions">
        <a href={getGoogleDirectionsUrl(plan)} target="_blank" rel="noreferrer">Open Google Maps</a>
        <a href={getAppleMapsRouteUrl(plan)} target="_blank" rel="noreferrer">Open Apple Maps</a>
        <button type="button" onClick={() => openRouteInMaps(providerStatus.provider, plan)}>
          Start route
        </button>
      </div>
    </section>
  )
}