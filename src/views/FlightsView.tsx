import { Plane, Radar, Timer } from 'lucide-react'
import type { FlightInput, FlightStatus } from '../domain/flight'

type FlightsViewProps = {
  flightInput: FlightInput
  onFieldChange: (field: keyof FlightInput, value: string) => void
  onTrack: () => void
  isTracking: boolean
  status: FlightStatus | null
  leaveBy: string
  returnMinutes: number | null
}

const RETURN_WINDOW = 180

export function FlightsView({
  flightInput,
  onFieldChange,
  onTrack,
  isTracking,
  status,
  leaveBy,
  returnMinutes,
}: FlightsViewProps) {
  const progress =
    returnMinutes == null ? 0 : Math.max(0, Math.min(1, returnMinutes / RETURN_WINDOW))
  const urgent = returnMinutes != null && returnMinutes <= 45
  const ringColor = urgent ? 'var(--warn)' : 'var(--accent)'
  const circumference = 2 * Math.PI * 26

  return (
    <div className="view">
      <div>
        <p className="eyebrow">Flight-aware</p>
        <h1 className="view-title">Track your flight</h1>
      </div>

      <div className="return-timer">
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
          <circle cx="36" cy="36" r="26" fill="none" stroke="var(--hairline-strong)" strokeWidth="6" />
          <circle
            cx="36"
            cy="36"
            r="26"
            fill="none"
            stroke={ringColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            transform="rotate(-90 36 36)"
            style={{ transition: 'stroke-dashoffset 600ms ease, stroke 300ms ease' }}
          />
        </svg>
        <div className="return-timer-body">
          <p className="return-timer-label">
            <Timer aria-hidden="true" />
            Return buffer
          </p>
          <strong>{returnMinutes == null ? `Back by ${leaveBy}` : `${returnMinutes} min left`}</strong>
          <span>{urgent ? 'Leave soon to stay on time.' : `Protected until ${leaveBy}.`}</span>
        </div>
      </div>

      <div className="field-grid">
        <label className="field">
          <span className="field-label">Flight</span>
          <input
            className="field-input"
            value={flightInput.airlineFlight}
            onChange={(event) => onFieldChange('airlineFlight', event.target.value)}
            placeholder="AA 100"
          />
        </label>
        <label className="field">
          <span className="field-label">Date</span>
          <input
            className="field-input"
            type="date"
            value={flightInput.travelDate}
            onChange={(event) => onFieldChange('travelDate', event.target.value)}
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span className="field-label">Airport</span>
          <input
            className="field-input"
            value={flightInput.airport}
            onChange={(event) => onFieldChange('airport', event.target.value)}
            placeholder="JFK, LAX, SFO"
          />
        </label>
        <label className="field">
          <span className="field-label">ICAO24</span>
          <input
            className="field-input"
            value={flightInput.icao24}
            onChange={(event) => onFieldChange('icao24', event.target.value)}
            placeholder="Hex code"
          />
        </label>
      </div>

      <button type="button" className="btn-primary" onClick={onTrack} disabled={isTracking}>
        <Radar aria-hidden="true" />
        {isTracking ? 'Checking flight…' : 'Track flight'}
      </button>

      {status && (
        <div className="status-card">
          <div className="status-head">
            <span className={`status-dot${status.isLive ? ' status-dot--live' : ''}`} aria-hidden="true" />
            <strong>{status.label}</strong>
            <span className="status-provider">
              <Plane aria-hidden="true" />
              {status.provider}
            </span>
          </div>
          <p>{status.detail}</p>
          <span className="status-updated">Updated {status.lastUpdated}</span>
        </div>
      )}
    </div>
  )
}
