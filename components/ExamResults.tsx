"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ExamQuestion } from "@/components/ExamSession"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopicScore {
  topic: string
  correct: number
  total: number
  percentage: number
}

export interface ExamResultsProps {
  totalQuestions: number
  correctCount: number
  topicScores: TopicScore[]
  durationSeconds: number
  questions: ExamQuestion[]
  userAnswers: Map<number, string>
  onReturnToSetup: () => void
}

const PASS_THRESHOLD = 0.75

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExamResults({
  totalQuestions,
  correctCount,
  topicScores,
  durationSeconds,
  questions,
  userAnswers,
  onReturnToSetup,
}: ExamResultsProps) {
  const [showMissed, setShowMissed] = useState(false)

  const overallScore = totalQuestions > 0 ? correctCount / totalQuestions : 0
  const passed = overallScore >= PASS_THRESHOLD
  const scorePercent = Math.round(overallScore * 100)

  const minutes = Math.floor(durationSeconds / 60)
  const seconds = durationSeconds % 60

  const missedQuestions = questions.filter(
    (q, i) => userAnswers.get(i) !== q.correctAnswer
  )

  return (
    <div className="flex flex-col gap-6 p-4 pb-24">
      {/* Overall score */}
      <Card>
        <CardHeader className="items-center text-center">
          <CardTitle className="text-2xl">Exam Complete</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <span className="text-5xl font-bold tabular-nums">
              {scorePercent}%
            </span>
            <Badge variant={passed ? "default" : "destructive"}>
              {passed ? "PASS" : "BELOW THRESHOLD"}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {correctCount} of {totalQuestions} correct
              {" | "}
              {minutes > 0 ? `${minutes}m ` : ""}
              {seconds}s
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Score by topic */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score by Topic</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topicScores.map((ts) => (
                <TableRow key={ts.topic}>
                  <TableCell className="whitespace-normal text-xs font-medium">
                    {ts.topic}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {ts.correct}/{ts.total}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {ts.percentage}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review missed questions */}
      {missedQuestions.length > 0 && (
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="h-11 w-full"
            onClick={() => setShowMissed((prev) => !prev)}
          >
            {showMissed
              ? "Hide Missed Questions"
              : `Review Missed Questions (${missedQuestions.length})`}
          </Button>

          {showMissed && (
            <div className="flex flex-col gap-4">
              {missedQuestions.map((q) => {
                const qIndex = questions.indexOf(q)
                const userAnswer = userAnswers.get(qIndex)
                return (
                  <Card key={qIndex} size="sm">
                    <CardHeader>
                      <CardTitle className="text-sm font-normal">
                        <span className="font-medium text-muted-foreground">
                          Q{qIndex + 1}.{" "}
                        </span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: q.questionHtml,
                          }}
                        />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-1.5 text-sm">
                      <p className="text-red-600 dark:text-red-400">
                        Your answer: {userAnswer ?? "No answer"}
                      </p>
                      <p className="text-green-600 dark:text-green-400">
                        Correct answer: {q.correctAnswer}
                      </p>
                      {q.explanationHtml && (
                        <div
                          className="mt-2 rounded-md bg-muted p-2 text-xs text-muted-foreground"
                          dangerouslySetInnerHTML={{
                            __html: q.explanationHtml,
                          }}
                        />
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Return to setup */}
      <Button className="h-12 w-full" onClick={onReturnToSetup}>
        Back to Exam Setup
      </Button>
    </div>
  )
}
