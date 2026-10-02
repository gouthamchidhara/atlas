import {
  Car,
  CircleEllipsis,
  Clapperboard,
  HeartPulse,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { CategoryId } from './types'
import { CATEGORY_INFO } from './categoryInfo'

export { categorize } from './categoryInfo'

export interface CategoryDef {
  id: CategoryId
  label: string
  icon: LucideIcon
  /** CSS var holding the categorical colour (fixed slot order, see styles.css). */
  color: string
}

/**
 * Spending categories occupy the eight categorical slots in fixed order.
 * "Other" and "Income" are neutral and never take a hue.
 */
const ICONS: Record<CategoryId, LucideIcon> = {
  groceries: ShoppingCart,
  dining: UtensilsCrossed,
  transport: Car,
  shopping: ShoppingBag,
  bills: Receipt,
  entertainment: Clapperboard,
  travel: Plane,
  health: HeartPulse,
  other: CircleEllipsis,
  income: Wallet,
}

export const CATEGORIES: CategoryDef[] = CATEGORY_INFO.map((c) => ({ ...c, icon: ICONS[c.id] }))

export const SPEND_CATEGORIES = CATEGORIES.filter((c) => c.id !== 'income')

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]))
export const category = (id: CategoryId): CategoryDef => BY_ID.get(id) ?? BY_ID.get('other')!

