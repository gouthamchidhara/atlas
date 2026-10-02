import { useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { money, monthLabel } from '../lib/format'

interface Point {
  key: string
  value: number
}

/** Single-series column chart (spend per month) with per-bar hover tooltip. */
export function MonthlyBars({ data, height = 200 }: { data: Point[]; height?: number }) {
  const { state } = useStore()
  const s = state.settings
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const padL = 44
  const padB = 24
  const plotH = height - padB
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)))
  const ticks = [0, max / 2, max]
  const slot = (W - padL) / data.length
  const barW = Math.min(40, slot * 0.55)

  return (
    <div ref={ref} className={`chart${hover !== null ? ' hovering' : ''}`}>
      <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Spending per month">
        {ticks.map((t) => {
          const y = plotH - (t / max) * (plotH - 8)
          return (
            <g key={t}>
              <line className="gridline" x1={padL} x2={W} y1={y} y2={y} />
              <text x={padL - 8} y={y + 4} textAnchor="end">
                {money(t, s, { compact: true })}
              </text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const h = (d.value / max) * (plotH - 8)
          const x = padL + slot * i + (slot - barW) / 2
          const y = plotH - h
          const r = Math.min(4, h / 2)
          const isLast = i === data.length - 1
          return (
            <g key={d.key}>
              {h > 0 && (
                <path
                  className={`bar${isLast ? ' current' : ''}${hover === i ? ' active' : ''}`}
                  d={`M${x},${plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${plotH} Z`}
                />
              )}
              <text x={x + barW / 2} y={height - 6} textAnchor="middle" style={isLast ? { fill: 'var(--text)', fontWeight: 600 } : undefined}>
                {monthLabel(d.key, s.locale)}
              </text>
              <rect
                className="hit"
                x={padL + slot * i}
                y={0}
                width={slot}
                height={plotH}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <div
          className="tooltip"
          style={{
            left: `${((padL + slot * hover + slot / 2) / W) * 100}%`,
            top: `${((plotH - (data[hover].value / max) * (plotH - 8)) / height) * 100}%`,
          }}
        >
          <span className="faint">{monthLabel(data[hover].key, s.locale, 'long')}</span>
          <b className="num">{money(data[hover].value, s)}</b>
        </div>
      )}
    </div>
  )
}

function niceMax(v: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * exp
}
