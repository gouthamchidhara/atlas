import { category } from '../domain/categories'
import type { CategoryId } from '../domain/types'

export function CategoryIcon({ id, size = 16 }: { id: CategoryId; size?: number }) {
  const c = category(id)
  const Icon = c.icon
  return (
    <span className="cat-icon" style={{ background: c.color }} aria-hidden>
      <Icon size={size} strokeWidth={2.2} />
    </span>
  )
}
