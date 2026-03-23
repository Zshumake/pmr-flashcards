import { createServerSupabaseClient } from "@/lib/supabase/server"
import { parseCloze, generateDistractors, stripHtml, renderClozeFront } from "@/lib/card-parser"
import { sanitizeCardHtml } from "@/lib/sanitize"
import { ExamSession, type ExamQuestion } from "@/components/ExamSession"

export const dynamic = "force-dynamic"

const BASE_SECONDS_PER_QUESTION = 72

function computeTotalSeconds(
  questionCount: number,
  multiplier: string
): number | null {
  if (multiplier === "none") return null
  const mult = parseFloat(multiplier) || 1
  return Math.round(questionCount * BASE_SECONDS_PER_QUESTION * mult)
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export default async function ExamSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const questionCount = Number(sp.count) || 25
  const timeMultiplier = (sp.time as string) ?? "1"
  const selectedTopics = sp.topics ? (sp.topics as string).split(",") : []

  const supabase = await createServerSupabaseClient()

  // Fetch cards from selected topics (or all topics)
  let query = supabase
    .from("cards")
    .select("id, front_html, back_html, topic, cloze_deletions")

  if (selectedTopics.length > 0) {
    query = query.in("topic", selectedTopics)
  }

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

    const cloze = clozes[Math.floor(Math.random() * clozes.length)]
    const correctAnswer = stripHtml(cloze.answer).trim()
    if (correctAnswer.length === 0) continue

    const topic = card.topic ?? "General"
    const pool = topicAnswerPool.get(topic) ?? []
    const distractors = generateDistractors(correctAnswer, pool, 3)

    if (distractors.length === 0) continue

    const options = shuffle([correctAnswer, ...distractors.slice(0, 3)])
    const questionHtml = sanitizeCardHtml(
      renderClozeFront(card.front_html, clozes, cloze.index)
    )
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
      sessionId={`exam-${Date.now()}`}
      questions={questions}
      totalSeconds={totalSeconds}
    />
  )
}
