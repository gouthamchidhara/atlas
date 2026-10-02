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
import type { CategoryId, CategoryRule } from './types'

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
export const CATEGORIES: CategoryDef[] = [
  { id: 'groceries', label: 'Groceries', icon: ShoppingCart, color: 'var(--series-1)' },
  { id: 'dining', label: 'Dining', icon: UtensilsCrossed, color: 'var(--series-2)' },
  { id: 'transport', label: 'Transport', icon: Car, color: 'var(--series-3)' },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: 'var(--series-4)' },
  { id: 'bills', label: 'Bills & Subs', icon: Receipt, color: 'var(--series-5)' },
  { id: 'entertainment', label: 'Entertainment', icon: Clapperboard, color: 'var(--series-6)' },
  { id: 'travel', label: 'Travel', icon: Plane, color: 'var(--series-7)' },
  { id: 'health', label: 'Health', icon: HeartPulse, color: 'var(--series-8)' },
  { id: 'other', label: 'Other', icon: CircleEllipsis, color: 'var(--series-other)' },
  { id: 'income', label: 'Income & Refunds', icon: Wallet, color: 'var(--series-other)' },
]

export const SPEND_CATEGORIES = CATEGORIES.filter((c) => c.id !== 'income')

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]))
export const category = (id: CategoryId): CategoryDef => BY_ID.get(id) ?? BY_ID.get('other')!

/** Built-in merchant keywords. User rules are checked first. */
const BUILTIN: Record<Exclude<CategoryId, 'other'>, string[]> = {
  groceries: ['whole foods', 'trader joe', 'kroger', 'safeway', 'aldi', 'costco', 'walmart grocery', 'instacart', 'grocery', 'market', 'bigbasket', 'tesco', 'lidl', 'publix', 'h-e-b', 'zepto', 'blinkit'],
  dining: ['starbucks', 'mcdonald', 'chipotle', 'doordash', 'uber eats', 'ubereats', 'grubhub', 'swiggy', 'zomato', 'cafe', 'coffee', 'pizza', 'burger', 'restaurant', 'bar ', 'grill', 'kitchen', 'taco', 'sushi', 'dunkin', 'subway', 'panera'],
  transport: ['uber', 'lyft', 'ola cabs', 'shell', 'chevron', 'exxon', 'bp ', 'fuel', 'gas station', 'parking', 'metro', 'transit', 'toll', 'mta', 'caltrain', 'tesla supercharger'],
  shopping: ['amazon', 'target', 'best buy', 'ikea', 'apple store', 'nike', 'zara', 'h&m', 'uniqlo', 'etsy', 'ebay', 'flipkart', 'myntra', 'walmart', 'home depot', 'sephora'],
  bills: ['netflix', 'spotify', 'hulu', 'disney+', 'youtube premium', 'icloud', 'google one', 'verizon', 'at&t', 't-mobile', 'comcast', 'xfinity', 'electric', 'utility', 'water', 'insurance', 'rent payment', 'internet', 'adobe', 'github', 'openai', 'anthropic', 'subscription'],
  entertainment: ['amc', 'cinema', 'theatre', 'theater', 'steam', 'playstation', 'xbox', 'nintendo', 'ticketmaster', 'eventbrite', 'concert', 'bowling', 'museum'],
  travel: ['airbnb', 'booking.com', 'expedia', 'marriott', 'hilton', 'hyatt', 'delta', 'united', 'american airlines', 'southwest', 'indigo', 'air india', 'emirates', 'hotel', 'airline', 'airways'],
  health: ['cvs', 'walgreens', 'pharmacy', 'clinic', 'hospital', 'dental', 'doctor', 'gym', 'fitness', 'peloton', 'apollo', '1mg'],
  income: ['payroll', 'salary', 'refund', 'cashback', 'payment received', 'payment - thank you', 'deposit', 'interest'],
}

export function categorize(merchant: string, amount: number, rules: CategoryRule[]): CategoryId {
  const m = ` ${merchant.toLowerCase()} `
  for (const r of rules) {
    if (r.pattern.trim() && m.includes(r.pattern.trim().toLowerCase())) return r.category
  }
  if (amount < 0) return 'income'
  for (const [cat, words] of Object.entries(BUILTIN)) {
    if (cat === 'income') continue
    if (words.some((w) => m.includes(w))) return cat as CategoryId
  }
  return 'other'
}
