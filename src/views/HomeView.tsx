import { MapPin, Mic, Navigation, Search, Sparkles } from 'lucide-react'
import { mapThumbUrl, type PlaceCard } from '../data/places'

type HomeViewProps = {
  cards: PlaceCard[]
  activeId: string | null
  onSelectCard: (id: string) => void
  prompt: string
  onPromptChange: (value: string) => void
  promptFocused: boolean
  onPromptFocus: () => void
  onPromptBlur: () => void
  onSubmitPrompt: () => void
  greeting: string
  planTitle: string | null
  theme: 'light' | 'dark'
  isBuilding: boolean
}

const suggestions = ['Scenic route', 'Quiet dinner', 'Back by 7pm', 'Kid-friendly']

export function HomeView({
  cards,
  activeId,
  onSelectCard,
  prompt,
  onPromptChange,
  promptFocused,
  onPromptFocus,
  onPromptBlur,
  onSubmitPrompt,
  greeting,
  planTitle,
  theme,
  isBuilding,
}: HomeViewProps) {
  return (
    <div className="view">
      <div>
        <p className="eyebrow">{greeting}</p>
        <h1 className="view-title">Where to today?</h1>
      </div>

      <div className={`prompt-pill${promptFocused ? ' prompt-pill--focused' : ''}`}>
        <Search className="prompt-pill-lead" aria-hidden="true" />
        <input
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onFocus={onPromptFocus}
          onBlur={onPromptBlur}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && prompt.trim()) {
              onSubmitPrompt()
            }
          }}
          placeholder="Where to — or tell me your day"
          aria-label="Ask Atlas"
        />
        <button className="prompt-pill-mic" type="button" aria-label="Speak to Atlas">
          <Mic aria-hidden="true" />
        </button>
      </div>

      {promptFocused && (
        <div className="chip-row">
          {suggestions.map((chip) => (
            <button
              key={chip}
              type="button"
              className="ghost-chip"
              onMouseDown={(event) => {
                event.preventDefault()
                onPromptChange(chip)
              }}
            >
              <Sparkles aria-hidden="true" />
              {chip}
            </button>
          ))}
        </div>
      )}

      {isBuilding && cards.length === 0 ? (
        <div className="empty-state">
          <span className="empty-glyph empty-glyph--pulse" aria-hidden="true">
            <Navigation />
          </span>
          <h2>Finding real places…</h2>
          <p>Pulling nearby spots for your destination.</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="empty-state">
          <span className="empty-glyph" aria-hidden="true">
            <Navigation />
          </span>
          <h2>Plan your day</h2>
          <p>Tell Atlas where you&rsquo;re headed and a route-ready itinerary appears here.</p>
        </div>
      ) : (
        <>
          <div className="rail-header">
            <h2>{planTitle ?? 'Your itinerary'}</h2>
            <span>{cards.length} stops</span>
          </div>

          <div className="place-rail">
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`place-card${activeId === card.id ? ' place-card--active' : ''}`}
                onClick={() => onSelectCard(card.id)}
              >
                <span className="place-thumb">
                  <img
                    src={mapThumbUrl(card.lat, card.lng, theme)}
                    alt=""
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.opacity = '0'
                    }}
                  />
                  <span className="place-thumb-pin" aria-hidden="true" />
                  <span className="place-index" aria-hidden="true">{card.index}</span>
                </span>
                <span className="place-card-body">
                  <span className="place-eyebrow">
                    <MapPin aria-hidden="true" />
                    {card.time}
                  </span>
                  <strong>{card.title}</strong>
                  <span className="place-sub">{card.meta} · {card.travel}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
