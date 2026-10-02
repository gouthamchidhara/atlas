import type { CategoryId } from '../domain/types'

export interface TxFilter {
  q: string
  cardId: string
  category: CategoryId | ''
  month: string
}

export const EMPTY_FILTER: TxFilter = { q: '', cardId: '', category: '', month: '' }
