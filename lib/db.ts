import Dexie, { type Table } from 'dexie'

export interface CachedCard {
  id: string
  topic: string
  front_html: string
  back_html: string | null
  cloze_deletions: unknown[]
  plain_text: string
  tags: string[]
}

export interface PendingSync {
  id?: number
  type: 'review' | 'session'
  payload: Record<string, unknown>
  created_at: Date
}

class FlashcardDB extends Dexie {
  cards!: Table<CachedCard, string>
  pendingSync!: Table<PendingSync, number>

  constructor() {
    super('pmr-flashcards')
    this.version(1).stores({
      cards: 'id, topic, *tags',
      pendingSync: '++id, type, created_at',
    })
  }
}

export const db = new FlashcardDB()
