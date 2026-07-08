import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

export type Detent = 'peek' | 'medium' | 'large'

type BottomSheetProps = {
  detent: Detent
  onDetentChange: (detent: Detent) => void
  children: ReactNode
}

// Detents expressed as the sheet's visible height as a fraction of the viewport.
const DETENT_FRACTION: Record<Detent, number> = {
  peek: 0.24,
  medium: 0.52,
  large: 0.9,
}

const ORDER: Detent[] = ['peek', 'medium', 'large']

/**
 * Apple-Maps-style floating sheet: drag the grabber, snap to detents,
 * settle with a spring. The map stays live behind it at every detent.
 */
export function BottomSheet({ detent, onDetentChange, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)
  const [dragHeight, setDragHeight] = useState<number | null>(null)

  const heightForDetent = useCallback(
    (value: Detent) => DETENT_FRACTION[value] * window.innerHeight,
    [],
  )

  const handlePointerDown = (event: React.PointerEvent) => {
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
    dragRef.current = {
      startY: event.clientY,
      startHeight: heightForDetent(detent),
    }
    setDragHeight(heightForDetent(detent))
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!dragRef.current) {
      return
    }
    const delta = dragRef.current.startY - event.clientY
    const next = Math.min(
      heightForDetent('large'),
      Math.max(heightForDetent('peek') * 0.7, dragRef.current.startHeight + delta),
    )
    setDragHeight(next)
  }

  const handlePointerUp = () => {
    if (dragRef.current == null || dragHeight == null) {
      dragRef.current = null
      return
    }
    // Snap to the nearest detent by height.
    const nearest = ORDER.reduce((best, value) => {
      const bestDistance = Math.abs(heightForDetent(best) - dragHeight)
      const valueDistance = Math.abs(heightForDetent(value) - dragHeight)
      return valueDistance < bestDistance ? value : best
    }, ORDER[0])

    dragRef.current = null
    setDragHeight(null)
    onDetentChange(nearest)
  }

  // Keep the sheet correct across viewport resizes.
  useEffect(() => {
    const onResize = () => setDragHeight(null)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const height = dragHeight ?? heightForDetent(detent)
  const isDragging = dragHeight != null

  return (
    <section
      ref={sheetRef}
      className={`bottom-sheet${isDragging ? ' bottom-sheet--dragging' : ''}`}
      style={{ height: `${height}px` }}
      aria-label="Trip panel"
    >
      <div
        className="sheet-grabber-zone"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="separator"
        aria-label="Drag to resize panel"
      >
        <span className="sheet-grabber" />
      </div>
      <div className="sheet-content">{children}</div>
    </section>
  )
}
