"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useHotkeys } from "react-hotkeys-hook"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { ExamTimer } from "@/components/ExamTimer"
import {
  ExamResults,
  type TopicScore,
} from "@/components/ExamResults"
import { createClient } from "@/lib/supabase/client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExamQuestion {
  /** Card ID for reference */
  cardId: string
  /** Topic this question belongs to */
  topic: string
  /** HTML to render as the question stem (cloze front) */
  questionHtml: string
  /** The correct answer text */
  correctAnswer: string
  /** All shuffled options (including correct) */
  options: string[]
  /** Optional explanation shown after answering (full card back HTML) */
  explanationHtml: string | null
}

interface ExamSessionProps {
  sessionId: string
  questions: ExamQuestion[]
  totalSeconds: number | null
}

type AnswerState = "unanswered" | "correct" | "incorrect"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExamSession({
  sessionId,
  questions,
  totalSeconds,
}: ExamSessionProps) {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [answerState, setAnswerState] = useState<AnswerState>("unanswered")
  const [userAnswers] = useState<Map<number, string>>(() => new Map())
  const [correctCount, setCorrectCount] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [startTime] = useState(() => Date.now())

  const legendRef = useRef<HTMLLegendElement>(null)
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentQuestion = questions[currentIndex]
  const progressPercent =
    questions.length > 0
      ? Math.round((currentIndex / questions.length) * 100)
      : 0

  // ---------------------------------------------------------------------------
  // Focus management: focus legend on question change
  // ---------------------------------------------------------------------------

  useEffect(() => {
    legendRef.current?.focus()
  }, [currentIndex])

  // Cleanup auto-advance on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current)
      }
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Finish exam
  // ---------------------------------------------------------------------------

  const finishExam = useCallback(async () => {
    setIsComplete(true)
    const durationSeconds = Math.round((Date.now() - startTime) / 1000)

    // Calculate topic scores
    const topicMap = new Map<string, { correct: number; total: number }>()
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const entry = topicMap.get(q.topic) ?? { correct: 0, total: 0 }
      entry.total++
      if (userAnswers.get(i) === q.correctAnswer) {
        entry.correct++
      }
      topicMap.set(q.topic, entry)
    }

    const scoreByTopic: Record<string, { correct: number; total: number }> = {}
    topicMap.forEach((v, k) => {
      scoreByTopic[k] = v
    })

    // Save to Supabase
    try {
      const supabase = createClient()
      await supabase.from("exam_results").insert({
        session_id: sessionId,
        total_questions: questions.length,
        correct_count: correctCount,
        score_by_topic: scoreByTopic,
        duration_seconds: durationSeconds,
        questions: questions.map((q, i) => ({
          cardId: q.cardId,
          topic: q.topic,
          correctAnswer: q.correctAnswer,
          userAnswer: userAnswers.get(i) ?? null,
          isCorrect: userAnswers.get(i) === q.correctAnswer,
        })),
      })

      // Update the study session
      await supabase
        .from("study_sessions")
        .update({
          cards_reviewed: questions.length,
          cards_correct: correctCount,
          duration_seconds: durationSeconds,
          ended_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
    } catch {
      // Silently fail -- results are shown locally regardless
    }
  }, [correctCount, questions, sessionId, startTime, userAnswers])

  // ---------------------------------------------------------------------------
  // Answer selection
  // ---------------------------------------------------------------------------

  const handleSelectAnswer = useCallback(
    (option: string) => {
      if (answerState !== "unanswered") return

      setSelectedAnswer(option)
      userAnswers.set(currentIndex, option)

      const isCorrect = option === currentQuestion.correctAnswer
      if (isCorrect) {
        setCorrectCount((prev) => prev + 1)
        setAnswerState("correct")
        // Auto-advance after 2 seconds on correct
        autoAdvanceTimerRef.current = setTimeout(() => {
          advanceQuestion()
        }, 2000)
      } else {
        setAnswerState("incorrect")
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answerState, currentIndex, currentQuestion]
  )

  // ---------------------------------------------------------------------------
  // Advance to next question
  // ---------------------------------------------------------------------------

  const advanceQuestion = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }

    if (currentIndex >= questions.length - 1) {
      finishExam()
      return
    }

    setCurrentIndex((prev) => prev + 1)
    setSelectedAnswer(null)
    setAnswerState("unanswered")
  }, [currentIndex, questions.length, finishExam])

  // ---------------------------------------------------------------------------
  // Time-up handler
  // ---------------------------------------------------------------------------

  const handleTimeUp = useCallback(() => {
    finishExam()
  }, [finishExam])

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts: 1-4 to select options, Enter/N to advance
  // ---------------------------------------------------------------------------

  useHotkeys(
    "1",
    () => {
      if (currentQuestion.options[0]) handleSelectAnswer(currentQuestion.options[0])
    },
    { enabled: answerState === "unanswered" && !isComplete }
  )
  useHotkeys(
    "2",
    () => {
      if (currentQuestion.options[1]) handleSelectAnswer(currentQuestion.options[1])
    },
    { enabled: answerState === "unanswered" && !isComplete }
  )
  useHotkeys(
    "3",
    () => {
      if (currentQuestion.options[2]) handleSelectAnswer(currentQuestion.options[2])
    },
    { enabled: answerState === "unanswered" && !isComplete }
  )
  useHotkeys(
    "4",
    () => {
      if (currentQuestion.options[3]) handleSelectAnswer(currentQuestion.options[3])
    },
    { enabled: answerState === "unanswered" && !isComplete }
  )
  useHotkeys("enter", advanceQuestion, {
    enabled: answerState !== "unanswered" && !isComplete,
  })
  useHotkeys("n", advanceQuestion, {
    enabled: answerState !== "unanswered" && !isComplete,
  })

  // ---------------------------------------------------------------------------
  // Results screen
  // ---------------------------------------------------------------------------

  if (isComplete) {
    const durationSeconds = Math.round((Date.now() - startTime) / 1000)

    const topicMap = new Map<string, { correct: number; total: number }>()
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const entry = topicMap.get(q.topic) ?? { correct: 0, total: 0 }
      entry.total++
      if (userAnswers.get(i) === q.correctAnswer) {
        entry.correct++
      }
      topicMap.set(q.topic, entry)
    }

    const topicScores: TopicScore[] = Array.from(topicMap.entries()).map(
      ([topic, { correct, total }]) => ({
        topic,
        correct,
        total,
        percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
      })
    )

    return (
      <ExamResults
        totalQuestions={questions.length}
        correctCount={correctCount}
        topicScores={topicScores}
        durationSeconds={durationSeconds}
        questions={questions}
        userAnswers={userAnswers}
        onReturnToSetup={() => router.push("/exam")}
      />
    )
  }

  // ---------------------------------------------------------------------------
  // Active exam UI
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-1 flex-col">
      {/* Top bar: timer + progress */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-sm font-medium text-muted-foreground">
          {currentIndex + 1}/{questions.length}
        </span>
        <ExamTimer totalSeconds={totalSeconds} onTimeUp={handleTimeUp} />
      </div>

      {/* Progress bar */}
      <div className="px-3 pt-2 pb-1">
        <Progress value={progressPercent}>
          <ProgressLabel className="sr-only">Exam progress</ProgressLabel>
          <ProgressValue className="sr-only" />
        </Progress>
      </div>

      {/* Question */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pt-3 pb-4">
        <AnimatePresence mode="wait">
          <motion.fieldset
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-3"
          >
            <legend
              ref={legendRef}
              tabIndex={-1}
              className="mb-2 text-base font-medium leading-snug outline-none"
            >
              <span className="text-muted-foreground">
                Question {currentIndex + 1}.{" "}
              </span>
              <span
                dangerouslySetInnerHTML={{
                  __html: currentQuestion.questionHtml,
                }}
              />
            </legend>

            {/* Answer options */}
            <div className="flex flex-col gap-2">
              {currentQuestion.options.map((option, optIndex) => {
                const letter = String.fromCharCode(65 + optIndex) // A, B, C, D
                const isSelected = selectedAnswer === option
                const isCorrectOption = option === currentQuestion.correctAnswer
                const answered = answerState !== "unanswered"

                let optionStyle = ""
                if (answered) {
                  if (isCorrectOption) {
                    optionStyle =
                      "border-green-500 bg-green-50 dark:bg-green-950/30"
                  } else if (isSelected && !isCorrectOption) {
                    optionStyle =
                      "border-red-500 bg-red-50 dark:bg-red-950/30"
                  }
                }

                return (
                  <label
                    key={optIndex}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      "min-h-[3rem]",
                      !answered && "hover:bg-muted/50 active:bg-muted",
                      !answered && isSelected && "border-primary bg-primary/5",
                      answered && "cursor-default",
                      optionStyle || (!answered ? "border-border" : "border-border")
                    )}
                  >
                    <input
                      type="radio"
                      name={`question-${currentIndex}`}
                      value={option}
                      checked={isSelected}
                      onChange={() => handleSelectAnswer(option)}
                      disabled={answered}
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />
                    <span className="text-sm">
                      <span className="font-medium text-muted-foreground">
                        {letter}.{" "}
                      </span>
                      {option}
                    </span>
                  </label>
                )
              })}
            </div>

            {/* Explanation (shown after answering) */}
            {answerState !== "unanswered" && currentQuestion.explanationHtml && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.2 }}
                className="rounded-md bg-muted p-3 text-sm text-muted-foreground"
              >
                <p className="mb-1 font-medium text-foreground">Explanation</p>
                <div
                  dangerouslySetInnerHTML={{
                    __html: currentQuestion.explanationHtml,
                  }}
                />
              </motion.div>
            )}
          </motion.fieldset>
        </AnimatePresence>
      </div>

      {/* Bottom bar: Next button */}
      <div className="sticky bottom-0 border-t border-border bg-background/95 p-3 backdrop-blur-sm safe-bottom">
        {answerState !== "unanswered" ? (
          <Button className="h-12 w-full text-base" onClick={advanceQuestion}>
            {currentIndex >= questions.length - 1 ? "Finish Exam" : "Next"}
          </Button>
        ) : (
          <p className="py-3 text-center text-sm text-muted-foreground">
            Select an answer above
          </p>
        )}
      </div>
    </div>
  )
}
