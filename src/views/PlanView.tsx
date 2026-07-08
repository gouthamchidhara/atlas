import { Clock, MapPin, Navigation, RefreshCw, Sparkles, WandSparkles } from 'lucide-react'
import type { TravelPlan } from '../domain/trip'

type PlanViewProps = {
  prompt: string
  onPromptChange: (value: string) => void
  timeBudget: string
  onTimeBudgetChange: (value: string) => void
  leaveBy: string
  onLeaveByChange: (value: string) => void
  interests: string[]
  selectedInterests: string[]
  onToggleInterest: (value: string) => void
  constraints: string[]
  selectedConstraints: string[]
  onToggleConstraint: (value: string) => void
  plan: TravelPlan | null
  onGenerate: () => void
  onReplan: (option: string) => void
  onDirections: () => void
  providerLabel: string
}

const replanOptions = ['Running late', 'Avoid crowds', 'Less walking', 'Bad weather']
const timeOptions = ['1h', '2h', '3h', '4h+']

export function PlanView({
  prompt,
  onPromptChange,
  timeBudget,
  onTimeBudgetChange,
  leaveBy,
  onLeaveByChange,
  interests,
  selectedInterests,
  onToggleInterest,
  constraints,
  selectedConstraints,
  onToggleConstraint,
  plan,
  onGenerate,
  onReplan,
  onDirections,
  providerLabel,
}: PlanViewProps) {
  return (
    <div className="view">
      <div>
        <p className="eyebrow">AI planner</p>
        <h1 className="view-title">Plan in your words</h1>
      </div>

      <label className="field">
        <span className="field-label">
          <WandSparkles aria-hidden="true" />
          Tell Atlas your day
        </span>
        <textarea
          className="field-input field-textarea"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="I land at 2 PM, want a quiet dinner, short walks, back by 7."
        />
      </label>

      <div className="segmented" role="group" aria-label="Time available">
        {timeOptions.map((option) => (
          <button
            key={option}
            type="button"
            className={`segment${timeBudget === option ? ' segment--active' : ''}`}
            onClick={() => onTimeBudgetChange(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <label className="field">
        <span className="field-label">
          <Clock aria-hidden="true" />
          Must finish by
        </span>
        <input
          className="field-input"
          value={leaveBy}
          onChange={(event) => onLeaveByChange(event.target.value)}
          placeholder="5:30 PM"
        />
      </label>

      <div className="chip-group">
        <p className="chip-group-label">Interests</p>
        <div className="chip-row">
          {interests.map((value) => (
            <button
              key={value}
              type="button"
              className={`select-chip${selectedInterests.includes(value) ? ' select-chip--on' : ''}`}
              onClick={() => onToggleInterest(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="chip-group">
        <p className="chip-group-label">Constraints to protect</p>
        <div className="chip-row">
          {constraints.map((value) => (
            <button
              key={value}
              type="button"
              className={`select-chip${selectedConstraints.includes(value) ? ' select-chip--on' : ''}`}
              onClick={() => onToggleConstraint(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="btn-primary" onClick={onGenerate}>
        <Sparkles aria-hidden="true" />
        {plan ? 'Rebuild itinerary' : 'Build itinerary'}
      </button>

      {plan && (
        <>
          <div className="plan-banner">
            <MapPin aria-hidden="true" />
            {plan.constraint}
          </div>

          <div className="rail-header">
            <h2>{plan.title}</h2>
            <span>{plan.stops.length} stops</span>
          </div>

          <ol className="timeline">
            {plan.stops.map((stop) => (
              <li key={stop.id} className="timeline-item">
                <div className="timeline-marker" aria-hidden="true">
                  <span />
                </div>
                <div className="timeline-body">
                  <div className="timeline-head">
                    <time>{stop.time}</time>
                    <span className="timeline-meta">{stop.meta} · {stop.travel}</span>
                  </div>
                  <h3>{stop.title}</h3>
                  <p>{stop.why}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="chip-group">
            <p className="chip-group-label">One-tap replan</p>
            <div className="chip-row">
              {replanOptions.map((option) => (
                <button key={option} type="button" className="ghost-chip" onClick={() => onReplan(option)}>
                  <RefreshCw aria-hidden="true" />
                  {option}
                </button>
              ))}
            </div>
          </div>

          <button type="button" className="btn-primary" onClick={onDirections}>
            <Navigation aria-hidden="true" />
            Start route
          </button>
          <p className="handoff-note">Opens in {providerLabel}</p>
        </>
      )}
    </div>
  )
}
