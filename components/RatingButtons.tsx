"use client"

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
    label: "Missed",
    shortcut: "1",
    intervalKey: "again" as const,
    className:
      "border-red-400/40 text-red-700 hover:bg-red-50 active:bg-red-100 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10 dark:active:bg-red-500/20",
  },
  {
    rating: 2 as const,
    label: "Hard",
    shortcut: "2",
    intervalKey: "hard" as const,
    className:
      "border-amber-400/40 text-amber-700 hover:bg-amber-50 active:bg-amber-100 dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-500/10 dark:active:bg-amber-500/20",
  },
  {
    rating: 3 as const,
    label: "Got it",
    shortcut: "3",
    intervalKey: "good" as const,
    className:
      "border-emerald-400/40 text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/10 dark:active:bg-emerald-500/20",
  },
  {
    rating: 4 as const,
    label: "Easy",
    shortcut: "4",
    intervalKey: "easy" as const,
    className:
      "border-sky-400/40 text-sky-700 hover:bg-sky-50 active:bg-sky-100 dark:border-sky-500/30 dark:text-sky-400 dark:hover:bg-sky-500/10 dark:active:bg-sky-500/20",
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
      aria-label="How well did you know this?"
      className="grid grid-cols-4 gap-2 px-3 pb-3"
    >
      {ratings.map(({ rating, label, shortcut, className, intervalKey }) => (
        <button
          key={rating}
          type="button"
          aria-label={`${label} — next review in ${intervals[intervalKey]}`}
          disabled={disabled}
          onClick={() => onRate(rating)}
          className={cn(
            "flex h-auto min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border bg-transparent px-1 py-2 text-center font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40",
            className
          )}
        >
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-[0.625rem] font-normal opacity-70">
            {intervals[intervalKey]}
          </span>
          <kbd className="mt-0.5 hidden text-[0.5rem] font-mono opacity-40 md:block">
            {shortcut}
          </kbd>
        </button>
      ))}
    </div>
  )
}
