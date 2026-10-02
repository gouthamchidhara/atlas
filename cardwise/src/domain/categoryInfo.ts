import type { CategoryId, CategoryRule } from './types'

/** Icon-free category metadata — safe to import from the service worker. */
export const CATEGORY_INFO: { id: CategoryId; label: string; color: string }[] = [
  { id: 'groceries', label: 'Groceries', color: 'var(--series-1)' },
  { id: 'dining', label: 'Dining', color: 'var(--series-2)' },
  { id: 'transport', label: 'Transport', color: 'var(--series-3)' },
  { id: 'shopping', label: 'Shopping', color: 'var(--series-4)' },
  { id: 'bills', label: 'Bills & Subs', color: 'var(--series-5)' },
  { id: 'entertainment', label: 'Entertainment', color: 'var(--series-6)' },
  { id: 'travel', label: 'Travel', color: 'var(--series-7)' },
  { id: 'health', label: 'Health', color: 'var(--series-8)' },
  { id: 'other', label: 'Other', color: 'var(--series-other)' },
  { id: 'income', label: 'Income & Refunds', color: 'var(--series-other)' },
]

const LABELS = new Map(CATEGORY_INFO.map((c) => [c.id, c.label]))
export const categoryLabel = (id: CategoryId) => LABELS.get(id) ?? 'Other'

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
