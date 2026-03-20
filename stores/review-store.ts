import { createStore, type StoreApi } from 'zustand/vanilla'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlashCard {
  id: string
  front_html: string
  back_html: string
  cloze_deletions: string[]
  topic: string
}

export interface ReviewResult {
  cardId: string
  rating: 1 | 2 | 3 | 4
  /** ISO-8601 timestamp when the rating was recorded. */
  reviewedAt: string
}

interface UndoSnapshot {
  currentIndex: number
  isFlipped: boolean
  pendingWrites: readonly ReviewResult[]
}

export interface ReviewState {
  /** Ordered queue of cards for the current review session. */
  queue: readonly FlashCard[]
  /** Index of the card currently being reviewed. */
  currentIndex: number
  /** Whether the current card is showing its back side. */
  isFlipped: boolean
  /** Batch of review results waiting to be synced. */
  pendingWrites: readonly ReviewResult[]
  /** Single-level undo snapshot (null when nothing to undo). */
  undoSnapshot: UndoSnapshot | null
}

export interface ReviewActions {
  setQueue: (cards: FlashCard[]) => void
  nextCard: () => void
  flipCard: () => void
  /**
   * Record a rating for the current card.
   * Automatically flushes pendingWrites every {@link AUTO_FLUSH_THRESHOLD} cards.
   */
  rateCard: (rating: ReviewResult['rating']) => void
  /** Restore the previous card state (single-level). */
  undo: () => void
  /** Return the current pending writes and clear the internal batch. */
  flushPendingWrites: () => readonly ReviewResult[]
}

export type ReviewSlice = ReviewState & ReviewActions

export type ReviewStore = StoreApi<ReviewSlice>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTO_FLUSH_THRESHOLD = 5

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const initialState: ReviewState = {
  queue: [],
  currentIndex: 0,
  isFlipped: false,
  pendingWrites: [],
  undoSnapshot: null,
}

export function createReviewStore(): ReviewStore {
  return createStore<ReviewSlice>((set, get) => ({
    ...initialState,

    setQueue(cards) {
      set({
        queue: cards,
        currentIndex: 0,
        isFlipped: false,
        pendingWrites: [],
        undoSnapshot: null,
      })
    },

    nextCard() {
      set((state) => {
        const nextIndex = state.currentIndex + 1
        if (nextIndex >= state.queue.length) return state
        return { currentIndex: nextIndex, isFlipped: false }
      })
    },

    flipCard() {
      set((state) => ({ isFlipped: !state.isFlipped }))
    },

    rateCard(rating) {
      const state = get()
      const card = state.queue[state.currentIndex]
      if (!card) return

      const result: ReviewResult = {
        cardId: card.id,
        rating,
        reviewedAt: new Date().toISOString(),
      }

      // Save undo snapshot *before* mutating.
      const snapshot: UndoSnapshot = {
        currentIndex: state.currentIndex,
        isFlipped: state.isFlipped,
        pendingWrites: state.pendingWrites,
      }

      const nextPending = [...state.pendingWrites, result]
      const nextIndex = state.currentIndex + 1
      const atEnd = nextIndex >= state.queue.length

      set({
        pendingWrites: nextPending,
        currentIndex: atEnd ? state.currentIndex : nextIndex,
        isFlipped: false,
        undoSnapshot: snapshot,
      })

      // Auto-flush after threshold.
      if (nextPending.length >= AUTO_FLUSH_THRESHOLD) {
        get().flushPendingWrites()
      }
    },

    undo() {
      set((state) => {
        if (!state.undoSnapshot) return state
        return {
          currentIndex: state.undoSnapshot.currentIndex,
          isFlipped: state.undoSnapshot.isFlipped,
          pendingWrites: [...state.undoSnapshot.pendingWrites],
          undoSnapshot: null,
        }
      })
    },

    flushPendingWrites() {
      const batch = get().pendingWrites
      set({ pendingWrites: [] })
      return batch
    },
  }))
}
