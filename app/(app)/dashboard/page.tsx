import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  calculateReadinessScore,
  calculateStreak,
  getWeakTopics,
  type TopicAccuracy,
} from "@/lib/analytics"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TopicHeatmap } from "@/components/TopicHeatmap"
import {
  ReviewHistoryChart,
  CardStatePieChart,
  type ReviewHistoryPoint,
  type CardStateDistribution,
} from "@/components/Charts"
import Link from "next/link"

// ---------------------------------------------------------------------------
// State label mapping
// ---------------------------------------------------------------------------

const STATE_LABELS: Record<number, string> = {
  0: "New",
  1: "Learning",
  2: "Review",
  3: "Mature",
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  let supabase
  try {
    supabase = await createServerSupabaseClient()
  } catch (e) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center">
        <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
        <p className="mt-4 text-muted-foreground">Unable to connect to the database. Please check your environment variables.</p>
      </div>
    )
  }
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Run all queries in parallel
  const [
    totalCardsRes,
    dueCardsRes,
    todayReviewsRes,
    topicAccuracyRes,
    cardStatesRes,
    reviewHistoryRes,
    rollingAccuracyRes,
    cardsSeenRes,
    streakDatesRes,
  ] = await Promise.all([
    // Total cards
    supabase.from("cards").select("id", { count: "exact", head: true }),

    // Due cards (due <= now)
    supabase
      .from("user_progress")
      .select("id", { count: "exact", head: true })
      .lte("due", now.toISOString()),

    // Today's reviews
    supabase
      .from("review_log")
      .select("id", { count: "exact", head: true })
      .gte("reviewed_at", todayStart.toISOString()),

    // Topic accuracy from materialized view (fallback: direct query)
    supabase
      .from("mv_topic_accuracy")
      .select("topic, accuracy, correct_count, total_count")
      .order("accuracy", { ascending: true }),

    // Card state distribution
    supabase.from("user_progress").select("card_state"),

    // Review history (last 30 days) — get raw dates and aggregate client-side
    supabase
      .from("review_log")
      .select("reviewed_at")
      .gte("reviewed_at", thirtyDaysAgo.toISOString())
      .order("reviewed_at", { ascending: true }),

    // Rolling 7-day accuracy
    supabase
      .from("review_log")
      .select("is_correct")
      .gte("reviewed_at", sevenDaysAgo.toISOString()),

    // Unique cards seen
    supabase
      .from("user_progress")
      .select("card_id", { count: "exact", head: true }),

    // Streak dates (all review dates)
    supabase
      .from("review_log")
      .select("reviewed_at")
      .order("reviewed_at", { ascending: false })
      .limit(500),
  ])

  // ---------------------------------------------------------------------------
  // Process results
  // ---------------------------------------------------------------------------

  const totalCards = totalCardsRes.count ?? 0
  const dueCards = dueCardsRes.count ?? 0
  const todayReviews = todayReviewsRes.count ?? 0
  const cardsSeen = cardsSeenRes.count ?? 0

  // Topic accuracy
  let topicAccuracyData: TopicAccuracy[] = []
  if (topicAccuracyRes.data && topicAccuracyRes.data.length > 0) {
    topicAccuracyData = topicAccuracyRes.data.map((row) => ({
      topic: row.topic,
      accuracy: row.accuracy ?? 0,
      totalCount: row.total_count ?? 0,
      correctCount: row.correct_count ?? 0,
    }))
  } else if (topicAccuracyRes.error) {
    // Fallback: direct query if materialized view is unavailable
    const fallback = await supabase
      .from("review_log")
      .select("card_id, is_correct, cards(topic)")
      .gte("reviewed_at", thirtyDaysAgo.toISOString())

    if (fallback.data) {
      const topicMap = new Map<
        string,
        { correct: number; total: number }
      >()
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

  // Card state distribution
  const stateMap = new Map<number, number>()
  for (const row of cardStatesRes.data ?? []) {
    const state = row.card_state ?? 0
    stateMap.set(state, (stateMap.get(state) ?? 0) + 1)
  }
  // Add new cards (cards without user_progress)
  const progressCount = (cardStatesRes.data ?? []).length
  const newCards = Math.max(0, totalCards - progressCount)
  const cardStateDistribution: CardStateDistribution[] = [
    { name: "New", value: newCards + (stateMap.get(0) ?? 0) },
    { name: "Learning", value: stateMap.get(1) ?? 0 },
    { name: "Review", value: stateMap.get(2) ?? 0 },
    { name: "Mature", value: stateMap.get(3) ?? 0 },
  ].filter((d) => d.value > 0)

  // Review history aggregated by day
  const dayCountMap = new Map<string, number>()
  for (const row of reviewHistoryRes.data ?? []) {
    const day = new Date(row.reviewed_at).toISOString().slice(0, 10)
    dayCountMap.set(day, (dayCountMap.get(day) ?? 0) + 1)
  }
  // Fill in missing days with 0
  const reviewHistory: ReviewHistoryPoint[] = []
  const cursor = new Date(thirtyDaysAgo)
  while (cursor <= now) {
    const key = cursor.toISOString().slice(0, 10)
    reviewHistory.push({ date: key, count: dayCountMap.get(key) ?? 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  // Rolling 7-day accuracy
  const rollingData = rollingAccuracyRes.data ?? []
  const rollingCorrect = rollingData.filter((r) => r.is_correct).length
  const rollingAccuracy =
    rollingData.length > 0 ? rollingCorrect / rollingData.length : 0

  // Streak
  const streakDates = (streakDatesRes.data ?? []).map((r) => r.reviewed_at)
  const streak = calculateStreak(streakDates)

  // Readiness score
  const readinessScore = calculateReadinessScore({
    cardsSeen,
    totalCards,
    rollingAccuracy,
    topicAccuracies: topicAccuracyData.map((t) => t.accuracy),
    lastReviewDate: streakDates[0] ?? null,
  })

  // Weak topics for drill CTA
  const weakTopics = getWeakTopics(topicAccuracyData).slice(0, 3)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 md:p-8">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your PM&R board preparation at a glance.
        </p>
      </div>

      {/* Readiness + Stats row */}
      <div className="grid gap-4 md:grid-cols-5 stagger-children">
        {/* Readiness Score — hero card */}
        <Card className="md:col-span-2">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-widest text-muted-foreground">
              Board Readiness
            </p>
            <p className="font-heading text-6xl font-bold tabular-nums tracking-tight">
              {readinessScore}
            </p>
            <ReadinessBar score={readinessScore} />
          </CardContent>
        </Card>

        {/* Stat cards */}
        <StatCard label="Reviewed Today" value={todayReviews} />
        <StatCard label="Day Streak" value={`${streak}`} />
        <StatCard label="Due Now" value={dueCards} accent />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link
          href="/review"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Review Due Cards
        </Link>
        {weakTopics.length > 0 && (
          <Link
            href="/drill"
            className="flex h-11 flex-1 items-center justify-center rounded-lg border border-border bg-card font-semibold text-sm transition-all hover:bg-accent active:scale-[0.98]"
          >
            Drill Weak Areas
          </Link>
        )}
      </div>

      {/* Topic Heatmap */}
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold tracking-tight">
          Topic Mastery
        </h2>
        <Card>
          <CardContent className="pt-4">
            <TopicHeatmap
              data={topicAccuracyData.map((t) => ({
                topic: t.topic,
                accuracy: t.accuracy,
                totalCount: t.totalCount,
                correctCount: t.correctCount,
              }))}
            />
          </CardContent>
        </Card>
      </section>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold tracking-tight">
            Review History
          </h2>
          <Card>
            <CardContent className="pt-4">
              <ReviewHistoryChart data={reviewHistory} />
            </CardContent>
          </Card>
        </section>
        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold tracking-tight">
            Card Distribution
          </h2>
          <Card>
            <CardContent className="pt-4">
              <CardStatePieChart data={cardStateDistribution} />
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Weak Topics */}
      {weakTopics.length > 0 && (
        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold tracking-tight">
            Areas to Focus
          </h2>
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-2">
                {weakTopics.map((t) => (
                  <Badge key={t.topic} variant="outline" className="text-sm">
                    {t.topic} — {Math.round(t.accuracy * 100)}%
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Use{" "}
                <Link href="/drill" className="font-medium text-primary underline underline-offset-2">
                  Drill Mode
                </Link>{" "}
                to target these areas with focused practice.
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Footer stat */}
      <p className="pb-4 text-center text-xs text-muted-foreground">
        {totalCards.toLocaleString()} total cards &middot; {cardsSeen.toLocaleString()} seen
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components (server-rendered)
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string
  value: number | string
  accent?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-6 text-center">
        <p className={`text-3xl font-bold tabular-nums ${accent ? "text-primary" : ""}`}>
          {value}
        </p>
        <p className="mt-1 text-[0.6875rem] font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
      </CardContent>
    </Card>
  )
}

function ReadinessBar({ score }: { score: number }) {
  // Warm palette: copper → amber → sage green
  let colorClass = "bg-destructive/80"
  if (score >= 70) colorClass = "bg-primary"
  else if (score >= 40) colorClass = "bg-amber-500"

  return (
    <div
      className="mt-2 h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Board readiness score: ${score} out of 100`}
    >
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass}`}
        style={{ width: `${score}%` }}
      />
    </div>
  )
}
