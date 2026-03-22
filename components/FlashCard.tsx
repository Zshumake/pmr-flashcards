"use client"

import { useRef, useCallback, useEffect } from "react"
import { ClozeRenderer } from "@/components/ClozeRenderer"
import type { ClozeDeletion } from "@/lib/card-parser"

interface FlashCardProps {
  html: string
  clozes: ClozeDeletion[]
  activeIndex: number
  isFlipped: boolean
  onFlip: () => void
}

export function FlashCard({
  html,
  clozes,
  activeIndex,
  isFlipped,
  onFlip,
}: FlashCardProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    containerRef.current?.focus()
  }, [html, activeIndex])

  const handleClick = useCallback(() => {
    if (!isFlipped) onFlip()
  }, [onFlip, isFlipped])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && !isFlipped) {
        e.preventDefault()
        onFlip()
      }
    },
    [onFlip, isFlipped]
  )

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role={isFlipped ? "region" : "button"}
      aria-label={
        isFlipped
          ? "Question and answer"
          : "Question. Tap or press space to reveal the answer."
      }
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="flex flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
    >
      {/* Question */}
      <div className="flex-1 px-1">
        <ClozeRenderer
          html={html}
          clozes={clozes}
          activeIndex={activeIndex}
          isFlipped={false}
        />
      </div>

      {/* Answer — slides in below the question */}
      {isFlipped && (
        <div className="mt-4 border-t border-border pt-4 px-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Answer
          </p>
          <ClozeRenderer
            html={html}
            clozes={clozes}
            activeIndex={activeIndex}
            isFlipped={true}
          />
        </div>
      )}
    </div>
  )
}
