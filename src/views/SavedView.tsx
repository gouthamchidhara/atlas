import { Bookmark, Download, MapPin, Share2 } from 'lucide-react'
import type { PlaceCard } from '../data/places'

type SavedViewProps = {
  cards: PlaceCard[]
  leaveBy: string
  onSelectCard: (id: string) => void
  onShare: () => void
  onExport: () => void
}

export function SavedView({ cards, leaveBy, onSelectCard, onShare, onExport }: SavedViewProps) {
  return (
    <div className="view">
      <div>
        <p className="eyebrow">Your library</p>
        <h1 className="view-title">Saved</h1>
      </div>

      <div className="stat-row">
        <div className="stat">
          <strong>{cards.length}</strong>
          <span>Planned stops</span>
        </div>
        <div className="stat">
          <strong>{cards.length > 0 ? leaveBy : '—'}</strong>
          <span>Leave by</span>
        </div>
        <div className="stat">
          <strong>{cards.length > 0 ? 'Ready' : '—'}</strong>
          <span>Route</span>
        </div>
      </div>

      <div className="action-row">
        <button type="button" className="btn-secondary" onClick={onShare} disabled={cards.length === 0}>
          <Share2 aria-hidden="true" />
          Share trip
        </button>
        <button type="button" className="btn-secondary" onClick={onExport} disabled={cards.length === 0}>
          <Download aria-hidden="true" />
          Export
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="empty-state">
          <span className="empty-glyph" aria-hidden="true">
            <Bookmark />
          </span>
          <h2>Nothing saved yet</h2>
          <p>Plans you build appear here, ready to share or reopen on the map.</p>
        </div>
      ) : (
        <>
          <div className="rail-header">
            <h2>Itinerary stops</h2>
            <span>{cards.length}</span>
          </div>

          <ul className="saved-list">
            {cards.map((card) => (
              <li key={card.id}>
                <button type="button" className="saved-row" onClick={() => onSelectCard(card.id)}>
                  <span className="saved-index" aria-hidden="true">{card.index}</span>
                  <span className="saved-info">
                    <strong>{card.title}</strong>
                    <span className="saved-sub">{card.time} · {card.meta}</span>
                  </span>
                  <MapPin className="saved-go" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
