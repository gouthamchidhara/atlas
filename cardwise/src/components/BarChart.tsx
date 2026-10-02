import { useLayoutEffect, useRef, useState } from 'react'

export interface BarDatum {
  key: string
  label: string
  long: string
  value: number
}

/** Single-series column chart, sized to its container, with per-bar hover tooltip. */
export function BarChart({
  data,
  height = 200,
  format,
  formatAxis = format,
  highlightLast = false,
  maxLabels = 8,
  ariaLabel,
}: {
  data: BarDatum[]
  height?: number
  format: (v: number) => string
  formatAxis?: (v: number) => string
  highlightLast?: boolean
  maxLabels?: number
  ariaLabel: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(160, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const padL = 44
  const padB = 22
  const plotH = height - padB
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)))
  const ticks = [0, max / 2, max]
  const slot = (W - padL) / Math.max(1, data.length)
  const barW = Math.max(2, Math.min(40, slot * 0.62))
  const fit = Math.max(2, Math.floor((W - padL) / 52))
  const every = Math.max(1, Math.ceil(data.length / Math.min(maxLabels, fit)))
  const yOf = (v: number) => plotH - (v / max) * (plotH - 8)

  return (
    <div ref={ref} className={`chart${hover !== null ? ' hovering' : ''}`}>
      <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="gridline" x1={padL} x2={W} y1={yOf(t)} y2={yOf(t)} />
            <text x={padL - 8} y={yOf(t) + 4} textAnchor="end">
              {formatAxis(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = plotH - yOf(d.value)
          const x = padL + slot * i + (slot - barW) / 2
          const y = plotH - h
          const r = Math.min(4, h / 2, barW / 2)
          const isLast = highlightLast && i === data.length - 1
          const showLabel = (data.length - 1 - i) % every === 0
          return (
            <g key={d.key}>
              {h > 0.5 && (
                <path
                  className={`bar${isLast ? ' current' : ''}${hover === i ? ' active' : ''}`}
                  d={`M${x},${plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${plotH} Z`}
                />
              )}
              {showLabel && (
                <text x={x + barW / 2} y={height - 5} textAnchor="middle" style={isLast ? { fill: 'var(--text)', fontWeight: 600 } : undefined}>
                  {d.label}
                </text>
              )}
              <rect className="hit" x={padL + slot * i} y={0} width={slot} height={plotH} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: Math.min(W - 70, Math.max(70, padL + slot * hover + slot / 2)), top: yOf(data[hover].value) }}>
          <span className="faint">{data[hover].long}</span>
          <b className="num">{format(data[hover].value)}</b>
        </div>
      )}
    </div>
  )
}

function niceMax(v: number) {
  if (v <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * exp
}
