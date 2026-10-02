import type { Card } from '../domain/types'

function NetworkMark({ network }: { network: Card['network'] }) {
  if (network === 'mastercard')
    return (
      <span className="network mc" aria-label="Mastercard">
        <i />
        <i />
      </span>
    )
  const label: Record<Card['network'], string> = {
    visa: 'VISA',
    amex: 'AMEX',
    discover: 'DISCOVER',
    rupay: 'RuPay',
    mastercard: '',
    other: '',
  }
  return <span className="network">{label[network]}</span>
}

export function CardVisual({ card, onClick }: { card: Card; onClick?: () => void }) {
  const body = (
    <>
      <div className="pcard-top">
        <div>
          <div className="pcard-issuer">{card.issuer || 'My Card'}</div>
          <div className="pcard-kind">
            {card.kind} · {card.nickname}
          </div>
        </div>
        <NetworkMark network={card.network} />
      </div>
      <div className="pcard-chip" aria-hidden />
      <div className="pcard-number num" aria-label={`ending in ${card.last4}`}>
        •••• •••• •••• {card.last4}
      </div>
      <div className="pcard-bottom">
        <div>
          <div className="lbl">Card holder</div>
          <div className="val">{card.holder || '—'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="lbl">Expires</div>
          <div className="val num">{card.expiry || '—'}</div>
        </div>
      </div>
    </>
  )
  if (onClick)
    return (
      <button type="button" className={`pcard ${card.theme}`} onClick={onClick}>
        {body}
      </button>
    )
  return <div className={`pcard ${card.theme}`}>{body}</div>
}
