"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface ExamConfigFormProps {
  action: (formData: FormData) => Promise<void>
  topics: string[]
  questionCounts: number[]
  timeMultipliers: Array<{ label: string; value: string }>
}

export function ExamConfigForm({
  action,
  topics,
  questionCounts,
  timeMultipliers,
}: ExamConfigFormProps) {
  const [, formAction, isPending] = useActionState(
    async (_prev: null, formData: FormData) => {
      await action(formData)
      return null
    },
    null
  )

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* Question count */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Number of Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {questionCounts.map((count, i) => (
              <label
                key={count}
                className={cn(
                  "flex min-h-[2.75rem] min-w-[4.5rem] cursor-pointer items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors",
                  "has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
                  "hover:bg-muted/50"
                )}
              >
                <input
                  type="radio"
                  name="questionCount"
                  value={count}
                  defaultChecked={i === 1}
                  className="sr-only"
                />
                {count}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Time accommodation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Time Accommodation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {timeMultipliers.map((tm, i) => (
              <label
                key={tm.value}
                className={cn(
                  "flex min-h-[2.75rem] cursor-pointer items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors",
                  "has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
                  "hover:bg-muted/50"
                )}
              >
                <input
                  type="radio"
                  name="timeMultiplier"
                  value={tm.value}
                  defaultChecked={i === 0}
                  className="sr-only"
                />
                {tm.label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Topic selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Topics{" "}
            <span className="font-normal text-muted-foreground">
              (leave all unchecked for all topics)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {topics.map((topic) => (
              <label
                key={topic}
                className={cn(
                  "flex min-h-[2.75rem] cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm transition-colors",
                  "has-[:checked]:border-primary has-[:checked]:bg-primary/5",
                  "hover:bg-muted/50"
                )}
              >
                <input
                  type="checkbox"
                  name="topics"
                  value={topic}
                  className="size-4 shrink-0 accent-primary"
                />
                <span className="leading-snug">{topic}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button type="submit" className="h-12 w-full text-base" disabled={isPending}>
        {isPending ? "Starting..." : "Start Exam"}
      </Button>
    </form>
  )
}
