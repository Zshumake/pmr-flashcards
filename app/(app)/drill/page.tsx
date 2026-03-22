import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getWeakTopics, type TopicAccuracy } from "@/lib/analytics"
import { ReviewSession, type ReviewCardData } from "@/components/ReviewSession"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

const DRILL_SIZE = 25 // target number of cards
const WEAK_RATIO = 0.7 // 70% weak area cards
const MAINTENANCE_RATIO = 0.3 // 30% maintenance cards

export const dynamic = "force-dynamic"

export default async function DrillPage() {
  const supabase = await createServerSupabaseClient()
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Get topic accuracy (try materialized view first, fallback to direct query)
  let topicAccuracyData: TopicAccuracy[] = []

  const mvRes = await supabase
    .from("mv_topic_accuracy")
    .select("topic, accuracy, correct_count, total_count")
    .order("accuracy", { ascending: true })

  if (mvRes.data && mvRes.data.length > 0) {
    topicAccuracyData = mvRes.data.map((row) => ({
      topic: row.topic,
      accuracy: row.accuracy ?? 0,
      totalCount: row.total_count ?? 0,
      correctCount: row.correct_count ?? 0,
    }))
  } else {
    // Fallback: direct query
    const fallback = await supabase
      .from("review_log")
      .select("card_id, is_correct, cards(topic)")
      .gte("reviewed_at", thirtyDaysAgo.toISOString())

    if (fallback.data) {
      const topicMap = new Map<string, { correct: number; total: number }>()
      for (const row of fallback.data) {
        const topic =
          (row.cards as unknown as { topic: string })?.topic ?? "Unknown"
        const entry = topicMap.get(topic) ?? { correct: 0, total: 0 }
        entry.total++
        if (row.is_correct) entry.correct++
        topicMap.set(topic, entry)
      }
      topicAccuracyData = Array.from(topicMap.entries()).map(
        ([topic, stats]) => ({
          topic,
          accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
          totalCount: stats.total,
          correctCount: stats.correct,
        })
      )
    }
  }

  // Identify weak topics (bottom performers)
  const weakTopics = getWeakTopics(topicAccuracyData).slice(0, 4)
  const weakTopicNames = weakTopics.map((t) => t.topic)

  if (weakTopicNames.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          No Weak Areas Found
        </h2>
        <p className="max-w-sm text-muted-foreground">
          You need to complete some reviews before we can identify your weak
          areas. Start with a regular review session first.
        </p>
        <Link
          href="/review"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground"
        >
          Start Review
        </Link>
      </div>
    )
  }

  // Calculate split
  const weakCardCount = Math.round(DRILL_SIZE * WEAK_RATIO)
  const maintenanceCardCount = DRILL_SIZE - weakCardCount

  // Fetch weak area cards: prioritize high lapses / low stability
  const weakCardsQuery = await supabase
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
    .in("topic", weakTopicNames)
    .limit(weakCardCount * 2) // fetch extra to allow sorting

  // Fetch maintenance cards: random due cards from other topics
  const maintenanceCardsQuery = await supabase
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
    .or(`user_progress.is.null,user_progress.due.lte.${now.toISOString()}`)
    .limit(maintenanceCardCount * 2)

  // Process weak cards: sort by highest lapses / lowest stability
  let weakCards = (weakCardsQuery.data ?? []).map(flattenCard)
  weakCards.sort((a, b) => {
    // Prioritize cards with more lapses
    const aLapses = a.lapses ?? 0
    const bLapses = b.lapses ?? 0
    if (aLapses !== bLapses) return bLapses - aLapses
    // Then by lowest stability
    const aStab = a.stability ?? 999
    const bStab = b.stability ?? 999
    return aStab - bStab
  })
  weakCards = weakCards.slice(0, weakCardCount)

  // Process maintenance cards: exclude any already in weak set, shuffle
  const weakCardIds = new Set(weakCards.map((c) => c.id))
  let maintenanceCards = (maintenanceCardsQuery.data ?? [])
    .map(flattenCard)
    .filter((c) => !weakCardIds.has(c.id))

  // Shuffle maintenance cards for variety
  for (let i = maintenanceCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[maintenanceCards[i], maintenanceCards[j]] = [
      maintenanceCards[j],
      maintenanceCards[i],
    ]
  }
  maintenanceCards = maintenanceCards.slice(0, maintenanceCardCount)

  // Interleave: weak cards with occasional maintenance cards
  const drillCards = interleaveCards(weakCards, maintenanceCards)

  if (drillCards.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight">No Cards Available</h2>
        <p className="max-w-sm text-muted-foreground">
          Could not find enough cards for a drill session. Try reviewing more
          cards first.
        </p>
        <Link
          href="/review"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground"
        >
          Start Review
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Drill header */}
      <div className="border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold">Drill: Weak Areas</h1>
          <span className="text-xs text-muted-foreground">
            {drillCards.length} cards
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {weakTopics.map((t) => (
            <Badge key={t.topic} variant="outline" className="text-xs">
              {t.topic} ({Math.round(t.accuracy * 100)}%)
            </Badge>
          ))}
        </div>
      </div>

      <ReviewSession initialCards={drillCards} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flattenCard(card: {
  id: string
  front_html: string
  back_html: string | null
  cloze_deletions: string[] | null
  topic: string
  user_progress:
    | {
        due: string | null
        stability: number | null
        difficulty: number | null
        reps: number | null
        lapses: number | null
        card_state: number | null
        scheduled_days: number | null
        last_review: string | null
      }
    | {
        due: string | null
        stability: number | null
        difficulty: number | null
        reps: number | null
        lapses: number | null
        card_state: number | null
        scheduled_days: number | null
        last_review: string | null
      }[]
    | null
}): ReviewCardData {
  const progress = Array.isArray(card.user_progress)
    ? card.user_progress[0]
    : card.user_progress

  return {
    id: card.id,
    front_html: card.front_html,
    back_html: card.back_html ?? "",
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
}

/**
 * Interleave weak and maintenance cards so that every ~3 weak cards,
 * one maintenance card appears (for variety and spaced practice).
 */
function interleaveCards(
  weak: ReviewCardData[],
  maintenance: ReviewCardData[]
): ReviewCardData[] {
  const result: ReviewCardData[] = []
  let wi = 0
  let mi = 0

  while (wi < weak.length || mi < maintenance.length) {
    // Add up to 3 weak cards
    for (let i = 0; i < 3 && wi < weak.length; i++) {
      result.push(weak[wi++])
    }
    // Then 1 maintenance card
    if (mi < maintenance.length) {
      result.push(maintenance[mi++])
    }
  }

  return result
}
