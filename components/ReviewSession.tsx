"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useStore } from "zustand"
import { useHotkeys } from "react-hotkeys-hook"
import { useStores } from "@/stores/store-provider"
import { FlashCard } from "@/components/FlashCard"
import { RatingButtons } from "@/components/RatingButtons"

import { createFsrsEngine, createNewCardState } from "@/lib/fsrs"
import type { CardState, ScheduleResult } from "@/lib/fsrs"
import { parseCloze } from "@/lib/card-parser"
import { createClient } from "@/lib/supabase/client"
import type { FlashCard as FlashCardType, ReviewResult } from "@/stores/review-store"

// ---------------------------------------------------------------------------
// Types for initial data passed from the server component
// ---------------------------------------------------------------------------

export interface ReviewCardData {
  id: string
  front_html: string
  back_html: string
  cloze_deletions: string[]
  topic: string
  // FSRS state from user_progress (null for new cards)
  due: string | null
  stability: number | null
  difficulty: number | null
  reps: number | null
  lapses: number | null
  card_state: number | null
  scheduled_days: number | null
  last_review: string | null
}

interface ReviewSessionProps {
  initialCards: ReviewCardData[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fsrsEngine = createFsrsEngine()

function getCardState(card: ReviewCardData): CardState {
  if (card.stability === null) return createNewCardState()
  return {
    due: card.due ? new Date(card.due) : null,
    stability: card.stability ?? 0,
    difficulty: card.difficulty ?? 0,
    reps: card.reps ?? 0,
    lapses: card.lapses ?? 0,
    card_state: card.card_state ?? 0,
    scheduled_days: card.scheduled_days ?? 0,
    last_review: card.last_review ? new Date(card.last_review) : null,
  }
}

function formatInterval(state: CardState): string {
  if (!state.due) return "now"
  const diffMs = state.due.getTime() - Date.now()
  const diffMins = Math.max(1, Math.round(diffMs / 60_000))
  if (diffMins < 60) return `${diffMins}m`
  const diffHours = Math.round(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d`
  const diffMonths = Math.round(diffDays / 30)
  return `${diffMonths}mo`
}

function scheduleToIntervals(schedule: ScheduleResult) {
  return {
    again: formatInterval(schedule.again),
    hard: formatInterval(schedule.hard),
    good: formatInterval(schedule.good),
    easy: formatInterval(schedule.easy),
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewSession({ initialCards }: ReviewSessionProps) {
  const { reviewStore } = useStores()

  const queue = useStore(reviewStore, (s) => s.queue)
  const currentIndex = useStore(reviewStore, (s) => s.currentIndex)
  const isFlipped = useStore(reviewStore, (s) => s.isFlipped)
  const flipCard = useStore(reviewStore, (s) => s.flipCard)
  const rateCard = useStore(reviewStore, (s) => s.rateCard)
  const undo = useStore(reviewStore, (s) => s.undo)
  const undoSnapshot = useStore(reviewStore, (s) => s.undoSnapshot)
  const setQueue = useStore(reviewStore, (s) => s.setQueue)
  const flushPendingWrites = useStore(reviewStore, (s) => s.flushPendingWrites)
  const pendingWrites = useStore(reviewStore, (s) => s.pendingWrites)

  // Session stats
  const [sessionStartTime] = useState(() => Date.now())
  const [ratingsCount, setRatingsCount] = useState({ total: 0, again: 0 })

  // Track FSRS card states keyed by card id
  const cardStatesRef = useRef<Map<string, CardState>>(new Map())

  // Whether session is complete
  const isComplete = queue.length > 0 && currentIndex >= queue.length - 1 && isFlipped === false && pendingWrites.length === 0 && ratingsCount.total > 0

  // Actually: session is complete when all cards have been rated
  const sessionDone = ratingsCount.total >= queue.length && queue.length > 0

  // Initialize store with cards
  useEffect(() => {
    const storeCards: FlashCardType[] = initialCards.map((c) => ({
      id: c.id,
      front_html: c.front_html,
      back_html: c.back_html,
      cloze_deletions: c.cloze_deletions,
      topic: c.topic,
    }))
    setQueue(storeCards)

    // Initialize FSRS states
    const states = new Map<string, CardState>()
    for (const card of initialCards) {
      states.set(card.id, getCardState(card))
    }
    cardStatesRef.current = states
  }, [initialCards, setQueue])

  // Current card data
  const currentCard = queue[currentIndex] ?? null

  // Parse cloze deletions for current card
  const clozes = useMemo(() => {
    if (!currentCard) return []
    return parseCloze(currentCard.front_html)
  }, [currentCard])

  // Compute FSRS schedule for current card
  const schedule = useMemo<ScheduleResult | null>(() => {
    if (!currentCard) return null
    const state = cardStatesRef.current.get(currentCard.id)
    if (!state) return null
    return fsrsEngine.schedule(state, new Date())
  }, [currentCard])

  const intervals = useMemo(() => {
    if (!schedule) {
      return { again: "1m", hard: "6m", good: "10m", easy: "4d" }
    }
    return scheduleToIntervals(schedule)
  }, [schedule])

  // Flush pending writes to Supabase
  const flushToSupabase = useCallback(
    async (writes: readonly ReviewResult[]) => {
      if (writes.length === 0) return
      const supabase = createClient()

      // Upsert user_progress
      const progressRows = writes.map((w) => {
        const newState = cardStatesRef.current.get(w.cardId)
        return {
          card_id: w.cardId,
          due: newState?.due?.toISOString() ?? new Date().toISOString(),
          stability: newState?.stability ?? 0,
          difficulty: newState?.difficulty ?? 0,
          reps: newState?.reps ?? 0,
          lapses: newState?.lapses ?? 0,
          card_state: newState?.card_state ?? 0,
          scheduled_days: newState?.scheduled_days ?? 0,
          last_reviewed: newState?.last_review?.toISOString() ?? new Date().toISOString(),
        }
      })

      // Insert review_log
      const logRows = writes.map((w) => ({
        card_id: w.cardId,
        rating: w.rating,
        reviewed_at: w.reviewedAt,
      }))

      await Promise.all([
        supabase.from("user_progress").upsert(progressRows, { onConflict: "user_id,card_id,cloze_index" }),
        supabase.from("review_log").insert(logRows),
      ])
    },
    []
  )

  // Handle auto-flush from store (watch pendingWrites for threshold flush)
  const prevPendingLenRef = useRef(0)
  useEffect(() => {
    // If pending writes were flushed (went from >=5 to 0), that means store auto-flushed
    if (prevPendingLenRef.current >= 5 && pendingWrites.length === 0) {
      // The store already cleared them; we need to capture what was flushed
      // Actually the store's flushPendingWrites returns the batch, but the auto-flush
      // inside rateCard calls it internally. We need a different approach.
    }
    prevPendingLenRef.current = pendingWrites.length
  }, [pendingWrites.length])

  // Instead, we intercept rateCard to handle writes ourselves
  const handleRate = useCallback(
    (rating: 1 | 2 | 3 | 4) => {
      if (!currentCard || !schedule) return

      // Update the FSRS state for this card
      const ratingKey = (
        { 1: "again", 2: "hard", 3: "good", 4: "easy" } as const
      )[rating]
      const newState = schedule[ratingKey]
      cardStatesRef.current.set(currentCard.id, newState)

      // Track stats
      setRatingsCount((prev) => ({
        total: prev.total + 1,
        again: prev.again + (rating === 1 ? 1 : 0),
      }))

      // Rate via store (handles undo snapshot, index advancement, auto-flush)
      rateCard(rating)

      // Check if we should flush to Supabase (every 5 cards)
      // The store auto-flushes at 5, but we need to capture the writes before that
      const currentPending = reviewStore.getState().pendingWrites
      if (currentPending.length >= 5) {
        const batch = flushPendingWrites()
        flushToSupabase(batch)
      }
    },
    [currentCard, schedule, rateCard, flushPendingWrites, flushToSupabase, reviewStore]
  )

  // Flush remaining on session end
  useEffect(() => {
    if (sessionDone) {
      const batch = flushPendingWrites()
      flushToSupabase(batch)
    }
  }, [sessionDone, flushPendingWrites, flushToSupabase])

  // Flush on unmount
  useEffect(() => {
    return () => {
      const batch = reviewStore.getState().flushPendingWrites()
      if (batch.length > 0) {
        // Fire and forget on unmount
        flushToSupabase(batch)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keyboard shortcuts
  useHotkeys("space", (e) => {
    e.preventDefault()
    if (!isFlipped) flipCard()
  }, { enabled: !sessionDone && !!currentCard })

  useHotkeys("1", () => { if (isFlipped) handleRate(1) }, { enabled: !sessionDone })
  useHotkeys("2", () => { if (isFlipped) handleRate(2) }, { enabled: !sessionDone })
  useHotkeys("3", () => { if (isFlipped) handleRate(3) }, { enabled: !sessionDone })
  useHotkeys("4", () => { if (isFlipped) handleRate(4) }, { enabled: !sessionDone })
  useHotkeys("z", () => { if (undoSnapshot) undo() }, { enabled: !sessionDone })

  // ---------------------------------------------------------------------------
  // Completion screen
  // ---------------------------------------------------------------------------

  if (sessionDone) {
    const elapsed = Math.round((Date.now() - sessionStartTime) / 1000)
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    const accuracy = ratingsCount.total > 0
      ? Math.round(((ratingsCount.total - ratingsCount.again) / ratingsCount.total) * 100)
      : 0

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6 animate-fade-up">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            Session Complete
          </h2>
          <p className="mt-2 text-muted-foreground">
            Nice work. Keep the momentum going.
          </p>
        </div>
        <div className="grid w-full max-w-sm grid-cols-3 gap-6 text-center stagger-children">
          <div className="rounded-lg bg-card p-4">
            <p className="text-3xl font-bold tabular-nums">{ratingsCount.total}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Questions</p>
          </div>
          <div className="rounded-lg bg-card p-4">
            <p className="text-3xl font-bold tabular-nums">{accuracy}%</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Recall</p>
          </div>
          <div className="rounded-lg bg-card p-4">
            <p className="text-3xl font-bold tabular-nums">
              {minutes > 0 ? `${minutes}m ` : ""}{seconds}s
            </p>
            <p className="mt-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Time</p>
          </div>
        </div>
        <button
          type="button"
          className="h-12 w-full max-w-sm rounded-lg bg-primary text-primary-foreground font-semibold text-base transition-all duration-150 hover:opacity-90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={() => {
            window.location.reload()
          }}
        >
          Continue Studying
        </button>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // No card loaded yet
  // ---------------------------------------------------------------------------

  if (!currentCard) {
    return null
  }

  // ---------------------------------------------------------------------------
  // Active review
  // ---------------------------------------------------------------------------

  const progressPercent = queue.length > 0
    ? Math.round((ratingsCount.total / queue.length) * 100)
    : 0

  return (
    <div className="flex flex-1 flex-col">
      {/* Progress strip */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-1 md:px-8 max-w-3xl w-full mx-auto">
        <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary/70 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground font-medium">
          {ratingsCount.total} / {queue.length}
        </span>
      </div>

      {/* Topic label */}
      {currentCard.topic && (
        <div className="px-4 pt-1 md:px-8 max-w-3xl w-full mx-auto">
          <span className="text-[0.6875rem] font-medium uppercase tracking-widest text-primary/70">
            {currentCard.topic}
          </span>
        </div>
      )}

      {/* Question & answer area */}
      <div className="flex flex-1 flex-col px-4 pt-4 pb-2 md:px-8 md:pt-6 max-w-3xl w-full mx-auto">
        <FlashCard
          html={currentCard.front_html}
          clozes={clozes}
          activeIndex={1}
          isFlipped={isFlipped}
          onFlip={flipCard}
        />
      </div>

      {/* Actions — fixed at bottom */}
      <div className="sticky bottom-0 bg-background/90 backdrop-blur-md border-t border-border/60 pt-2 safe-bottom max-w-3xl w-full mx-auto">
        {isFlipped ? (
          <RatingButtons
            onRate={handleRate}
            intervals={intervals}
          />
        ) : (
          <div className="px-3 pb-3">
            <button
              type="button"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold text-base transition-all duration-150 hover:opacity-90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={flipCard}
            >
              Reveal Answer
              <kbd className="hidden rounded border border-primary-foreground/20 px-1.5 py-0.5 font-mono text-[0.625rem] font-normal opacity-60 md:inline">
                space
              </kbd>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
