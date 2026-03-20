import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { parseCloze, generateDistractors, stripHtml, renderClozeFront } from "@/lib/card-parser"
import { sanitizeCardHtml } from "@/lib/sanitize"
import { ExamSession, type ExamQuestion } from "@/components/ExamSession"

// ---------------------------------------------------------------------------
// Time calculation: 72 seconds per question at 1x
// ---------------------------------------------------------------------------

const BASE_SECONDS_PER_QUESTION = 72

function computeTotalSeconds(
  questionCount: number,
  multiplier: string
): number | null {
  if (multiplier === "none") return null
  const mult = parseFloat(multiplier) || 1
  return Math.round(questionCount * BASE_SECONDS_PER_QUESTION * mult)
}

// ---------------------------------------------------------------------------
// Shuffle utility
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ExamSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const supabase = await createServerSupabaseClient()

  // Fetch the study session
  const { data: session, error: sessionError } = await supabase
    .from("study_sessions")
    .select("id, mode, topic_filter, session_state")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session || session.mode !== "exam") {
    notFound()
  }

  const state = session.session_state as {
    questionCount: number
    timeMultiplier: string
    selectedTopics: string[]
  }

  const questionCount = state.questionCount ?? 25
  const timeMultiplier = state.timeMultiplier ?? "1"
  const selectedTopics: string[] = state.selectedTopics ?? []

  // Fetch cards from selected topics (or all topics)
  let query = supabase
    .from("cards")
    .select("id, front_html, back_html, topic, cloze_deletions")

  if (selectedTopics.length > 0) {
    query = query.in("topic", selectedTopics)
  }

  // Fetch more cards than needed to have variety
  const { data: allCards, error: cardsError } = await query.limit(2000)

  if (cardsError || !allCards || allCards.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h2 className="text-xl font-bold">No Cards Available</h2>
        <p className="text-sm text-muted-foreground">
          No cards found for the selected topics. Please go back and adjust your
          settings.
        </p>
      </div>
    )
  }

  // Build a pool of same-topic cloze answers for distractor generation
  const topicAnswerPool = new Map<string, string[]>()
  for (const card of allCards) {
    const clozes = parseCloze(card.front_html)
    const topic = card.topic ?? "General"
    const existing = topicAnswerPool.get(topic) ?? []
    for (const c of clozes) {
      const plain = stripHtml(c.answer).trim()
      if (plain.length > 0) {
        existing.push(plain)
      }
    }
    topicAnswerPool.set(topic, existing)
  }

  // Select random cards and generate questions
  const shuffledCards = shuffle(allCards)
  const questions: ExamQuestion[] = []

  for (const card of shuffledCards) {
    if (questions.length >= questionCount) break

    const clozes = parseCloze(card.front_html)
    if (clozes.length === 0) continue

    // Pick a random cloze from this card
    const cloze = clozes[Math.floor(Math.random() * clozes.length)]
    const correctAnswer = stripHtml(cloze.answer).trim()
    if (correctAnswer.length === 0) continue

    const topic = card.topic ?? "General"
    const pool = topicAnswerPool.get(topic) ?? []

    const distractors = generateDistractors(correctAnswer, pool, 3)

    // Need at least 1 distractor to make a valid question
    if (distractors.length === 0) continue

    // Pad to 4 options if needed (some topics may have limited answers)
    const options = shuffle([correctAnswer, ...distractors.slice(0, 3)])

    // Generate the question stem: render the cloze front with blank
    const questionHtml = sanitizeCardHtml(
      renderClozeFront(card.front_html, clozes, cloze.index)
    )

    // Explanation: sanitized back_html or the full front with answers revealed
    const explanationHtml = card.back_html
      ? sanitizeCardHtml(card.back_html)
      : null

    questions.push({
      cardId: card.id,
      topic,
      questionHtml,
      correctAnswer,
      options,
      explanationHtml,
    })
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h2 className="text-xl font-bold">Unable to Generate Questions</h2>
        <p className="text-sm text-muted-foreground">
          Could not generate enough questions from the available cards. Try
          selecting different topics or a smaller question count.
        </p>
      </div>
    )
  }

  const totalSeconds = computeTotalSeconds(questions.length, timeMultiplier)

  return (
    <ExamSession
      sessionId={sessionId}
      questions={questions}
      totalSeconds={totalSeconds}
    />
  )
}
