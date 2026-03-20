"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { cn } from "@/lib/utils"

interface ExamTimerProps {
  /** Total seconds for the exam. null means no time limit. */
  totalSeconds: number | null
  /** Called when the timer reaches zero. */
  onTimeUp?: () => void
  className?: string
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }
  return `${m}:${String(s).padStart(2, "0")}`
}

function formatTimeSpoken(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h} hour${h !== 1 ? "s" : ""}`)
  if (m > 0) parts.push(`${m} minute${m !== 1 ? "s" : ""}`)
  if (s > 0 && h === 0) parts.push(`${s} second${s !== 1 ? "s" : ""}`)
  return parts.join(" ") || "0 seconds"
}

export function ExamTimer({
  totalSeconds,
  onTimeUp,
  className,
}: ExamTimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds ?? 0)
  const [announcement, setAnnouncement] = useState("")
  const announcedRef = useRef<Set<string>>(new Set())
  const onTimeUpRef = useRef(onTimeUp)
  onTimeUpRef.current = onTimeUp

  // Countdown interval
  useEffect(() => {
    if (totalSeconds === null) return
    setRemaining(totalSeconds)
    announcedRef.current = new Set()

    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1
        if (next <= 0) {
          clearInterval(interval)
          onTimeUpRef.current?.()
          return 0
        }
        return next
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [totalSeconds])

  // Threshold announcements
  useEffect(() => {
    if (totalSeconds === null) return

    const thresholds: Array<{ key: string; check: () => boolean; msg: string }> =
      [
        {
          key: "halfway",
          check: () => remaining === Math.floor(totalSeconds / 2),
          msg: `Halfway point: ${formatTimeSpoken(remaining)} remaining`,
        },
        {
          key: "5min",
          check: () => remaining === 300,
          msg: "5 minutes remaining",
        },
        {
          key: "1min",
          check: () => remaining === 60,
          msg: "1 minute remaining",
        },
        {
          key: "30sec",
          check: () => remaining === 30,
          msg: "30 seconds remaining",
        },
      ]

    for (const t of thresholds) {
      if (t.check() && !announcedRef.current.has(t.key)) {
        announcedRef.current.add(t.key)
        setAnnouncement(t.msg)
      }
    }
  }, [remaining, totalSeconds])

  // Keyboard shortcut T to announce remaining time
  const announceTime = useCallback(() => {
    if (totalSeconds === null) {
      setAnnouncement("No time limit")
    } else {
      setAnnouncement(`${formatTimeSpoken(remaining)} remaining`)
    }
  }, [remaining, totalSeconds])

  useHotkeys("t", announceTime, { preventDefault: true })

  // Determine urgency styling
  const isLow = totalSeconds !== null && remaining <= 60
  const isWarning = totalSeconds !== null && remaining <= 300 && remaining > 60

  if (totalSeconds === null) {
    return (
      <div
        role="timer"
        aria-label="Exam time remaining"
        className={cn("flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground", className)}
      >
        <span>No limit</span>
        {/* Live region for on-demand announcements */}
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </span>
      </div>
    )
  }

  return (
    <div
      role="timer"
      aria-label="Exam time remaining"
      className={cn(
        "flex items-center gap-1.5 text-sm font-medium tabular-nums",
        isLow && "text-red-600 dark:text-red-400",
        isWarning && "text-amber-600 dark:text-amber-400",
        !isLow && !isWarning && "text-foreground",
        className
      )}
    >
      <span>{formatTime(remaining)}</span>
      {/* Live region for threshold and on-demand announcements */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  )
}
