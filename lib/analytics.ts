// ---------------------------------------------------------------------------
// Analytics helper functions
// ---------------------------------------------------------------------------

export interface ReadinessStats {
  /** Number of unique cards the user has reviewed at least once */
  cardsSeen: number
  /** Total number of cards in the system */
  totalCards: number
  /** Rolling 7-day accuracy (0-1) from review_log */
  rollingAccuracy: number
  /** Per-topic accuracy values (0-1) */
  topicAccuracies: number[]
  /** ISO date string of the most recent review, or null */
  lastReviewDate: string | null
}

/**
 * Composite readiness score 0-100.
 *
 * - Coverage  (30%): % of total review items seen at least once
 * - Retention (30%): rolling 7-day accuracy from review_log
 * - Topic balance (20%): inverse of std deviation across per-topic accuracy
 * - Recency   (20%): decay function based on days since last session
 */
export function calculateReadinessScore(stats: ReadinessStats): number {
  // --- Coverage (0-1) ---
  const coverage =
    stats.totalCards > 0 ? stats.cardsSeen / stats.totalCards : 0

  // --- Retention (0-1) ---
  const retention = stats.rollingAccuracy

  // --- Topic balance (0-1) ---
  let topicBalance = 1
  if (stats.topicAccuracies.length > 1) {
    const mean =
      stats.topicAccuracies.reduce((a, b) => a + b, 0) /
      stats.topicAccuracies.length
    const variance =
      stats.topicAccuracies.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
      stats.topicAccuracies.length
    const stdDev = Math.sqrt(variance)
    // stdDev of 0 => perfect balance (1.0), stdDev of 0.5 => 0.0
    topicBalance = Math.max(0, 1 - stdDev * 2)
  }

  // --- Recency (0-1) ---
  let recency = 0
  if (stats.lastReviewDate) {
    const daysSince =
      (Date.now() - new Date(stats.lastReviewDate).getTime()) /
      (1000 * 60 * 60 * 24)
    // Exponential decay: 1.0 at day 0, ~0.5 at day 3, ~0.13 at day 7
    recency = Math.exp(-0.2 * daysSince)
  }

  const score =
    coverage * 30 + retention * 30 + topicBalance * 20 + recency * 20

  return Math.round(Math.min(100, Math.max(0, score)))
}

/**
 * Count consecutive days (ending today or yesterday) with at least one review.
 * Expects an array of ISO date strings (reviewed_at values).
 */
export function calculateStreak(reviewDates: string[]): number {
  if (reviewDates.length === 0) return 0

  // Build a set of unique YYYY-MM-DD strings
  const daySet = new Set<string>()
  for (const d of reviewDates) {
    daySet.add(new Date(d).toISOString().slice(0, 10))
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  // Start from today or yesterday (whichever has activity)
  let startDate: Date
  if (daySet.has(todayStr)) {
    startDate = today
  } else if (daySet.has(yesterdayStr)) {
    startDate = yesterday
  } else {
    return 0
  }

  let streak = 0
  const cursor = new Date(startDate)
  while (true) {
    const key = cursor.toISOString().slice(0, 10)
    if (!daySet.has(key)) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

export interface TopicAccuracy {
  topic: string
  accuracy: number
  totalCount: number
  correctCount: number
}

/**
 * Return topics sorted by lowest accuracy first (weakest topics).
 */
export function getWeakTopics(topicAccuracy: TopicAccuracy[]): TopicAccuracy[] {
  return [...topicAccuracy]
    .filter((t) => t.totalCount > 0)
    .sort((a, b) => a.accuracy - b.accuracy)
}
