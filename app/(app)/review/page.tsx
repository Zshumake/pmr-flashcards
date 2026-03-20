import { createServerSupabaseClient } from "@/lib/supabase/server"
import { ReviewSession, type ReviewCardData } from "@/components/ReviewSession"

const SESSION_SIZE = 50

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { topic } = await searchParams
  const supabase = await createServerSupabaseClient()
  const now = new Date().toISOString()

  // Build query: cards that are due or have never been studied (new)
  let query = supabase
    .from("cards")
    .select(
      `
      id,
      front_html,
      back_html,
      cloze_deletions,
      topic,
      user_progress (
        due,
        stability,
        difficulty,
        reps,
        lapses,
        card_state,
        scheduled_days,
        last_review
      )
    `
    )
    .or(`user_progress.is.null,user_progress.due.lte.${now}`)
    .limit(SESSION_SIZE)

  if (topic && typeof topic === "string") {
    query = query.eq("topic", topic)
  }

  const { data: cards, error } = await query

  if (error) {
    throw new Error(`Failed to fetch review cards: ${error.message}`)
  }

  // Flatten join data into ReviewCardData shape
  const reviewCards: ReviewCardData[] = (cards ?? []).map((card) => {
    // user_progress is returned as an array from the join; take first if exists
    const progress = Array.isArray(card.user_progress)
      ? card.user_progress[0]
      : card.user_progress

    return {
      id: card.id,
      front_html: card.front_html,
      back_html: card.back_html,
      cloze_deletions: card.cloze_deletions ?? [],
      topic: card.topic ?? "",
      due: progress?.due ?? null,
      stability: progress?.stability ?? null,
      difficulty: progress?.difficulty ?? null,
      reps: progress?.reps ?? null,
      lapses: progress?.lapses ?? null,
      card_state: progress?.card_state ?? null,
      scheduled_days: progress?.scheduled_days ?? null,
      last_review: progress?.last_review ?? null,
    }
  })

  // No cards due
  if (reviewCards.length === 0) {
    // Find next due card to show when the user should come back
    const { data: nextDueData } = await supabase
      .from("user_progress")
      .select("due")
      .gt("due", now)
      .order("due", { ascending: true })
      .limit(1)
      .single()

    const nextDue = nextDueData?.due
      ? new Date(nextDueData.due)
      : null

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-5xl" role="img" aria-label="celebration">
          {/* intentionally no emoji per instructions; using text instead */}
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          You are all caught up!
        </h2>
        <p className="max-w-sm text-muted-foreground">
          {nextDue
            ? `Your next review is due ${formatRelativeTime(nextDue)}.`
            : "No cards are scheduled for review. Add some cards to get started."}
        </p>
      </div>
    )
  }

  return <ReviewSession initialCards={reviewCards} />
}

// ---------------------------------------------------------------------------
// Helpers (server-only)
// ---------------------------------------------------------------------------

function formatRelativeTime(date: Date): string {
  const diffMs = date.getTime() - Date.now()
  const diffMins = Math.max(1, Math.round(diffMs / 60_000))
  if (diffMins < 60) return `in ${diffMins} minute${diffMins !== 1 ? "s" : ""}`
  const diffHours = Math.round(diffMins / 60)
  if (diffHours < 24) return `in ${diffHours} hour${diffHours !== 1 ? "s" : ""}`
  const diffDays = Math.round(diffHours / 24)
  return `in ${diffDays} day${diffDays !== 1 ? "s" : ""}`
}
