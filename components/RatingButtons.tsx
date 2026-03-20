"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface RatingButtonsProps {
  onRate: (rating: 1 | 2 | 3 | 4) => void
  intervals: {
    again: string
    hard: string
    good: string
    easy: string
  }
  disabled?: boolean
}

const ratings = [
  {
    rating: 1 as const,
    label: "Again",
    ariaLabel: "Rate Again - forgot completely",
    className:
      "bg-red-500/15 text-red-700 hover:bg-red-500/25 dark:text-red-400 dark:bg-red-500/20 dark:hover:bg-red-500/30",
    intervalKey: "again" as const,
  },
  {
    rating: 2 as const,
    label: "Hard",
    ariaLabel: "Rate Hard - recalled with significant difficulty",
    className:
      "bg-orange-500/15 text-orange-700 hover:bg-orange-500/25 dark:text-orange-400 dark:bg-orange-500/20 dark:hover:bg-orange-500/30",
    intervalKey: "hard" as const,
  },
  {
    rating: 3 as const,
    label: "Good",
    ariaLabel: "Rate Good - recalled with some effort",
    className:
      "bg-green-500/15 text-green-700 hover:bg-green-500/25 dark:text-green-400 dark:bg-green-500/20 dark:hover:bg-green-500/30",
    intervalKey: "good" as const,
  },
  {
    rating: 4 as const,
    label: "Easy",
    ariaLabel: "Rate Easy - recalled effortlessly",
    className:
      "bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 dark:text-blue-400 dark:bg-blue-500/20 dark:hover:bg-blue-500/30",
    intervalKey: "easy" as const,
  },
] as const

export function RatingButtons({
  onRate,
  intervals,
  disabled = false,
}: RatingButtonsProps) {
  return (
    <div
      role="group"
      aria-label="Rate this card"
      className="grid grid-cols-4 gap-2 px-2 pb-2"
    >
      {ratings.map(({ rating, label, ariaLabel, className, intervalKey }) => (
        <Button
          key={rating}
          variant="ghost"
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => onRate(rating)}
          className={cn(
            "flex h-auto min-h-12 flex-col gap-0.5 rounded-lg px-1 py-2 text-center font-medium",
            className
          )}
        >
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-[0.65rem] font-normal opacity-80">
            {intervals[intervalKey]}
          </span>
        </Button>
      ))}
    </div>
  )
}
