"use client"

import { useRef, useCallback, useEffect } from "react"
import { motion, useReducedMotion } from "motion/react"
import { ClozeRenderer } from "@/components/ClozeRenderer"
import type { ClozeDeletion } from "@/lib/card-parser"
import { cn } from "@/lib/utils"

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
  const prefersReducedMotion = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)

  // Focus the card container when it mounts or the card changes
  useEffect(() => {
    containerRef.current?.focus()
  }, [html, activeIndex])

  const handleClick = useCallback(() => {
    onFlip()
  }, [onFlip])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onFlip()
      }
    },
    [onFlip]
  )

  if (prefersReducedMotion) {
    return (
      <div
        ref={containerRef}
        tabIndex={-1}
        role="button"
        aria-label={isFlipped ? "Card answer side. Tap to flip back." : "Card question side. Tap to reveal answer."}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="flex-1 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
      >
        <div className="flex h-full min-h-0 items-start overflow-y-auto rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10">
          <div className="w-full">
            <ClozeRenderer
              html={html}
              clozes={clozes}
              activeIndex={activeIndex}
              isFlipped={isFlipped}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="button"
      aria-label={isFlipped ? "Card answer side. Tap to flip back." : "Card question side. Tap to reveal answer."}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="flex-1 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
      style={{ perspective: "1200px" }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Front face */}
        <div
          className={cn(
            "absolute inset-0 flex items-start overflow-y-auto rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10",
            isFlipped && "pointer-events-none"
          )}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="w-full">
            <ClozeRenderer
              html={html}
              clozes={clozes}
              activeIndex={activeIndex}
              isFlipped={false}
            />
          </div>
        </div>

        {/* Back face */}
        <div
          className={cn(
            "absolute inset-0 flex items-start overflow-y-auto rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10",
            !isFlipped && "pointer-events-none"
          )}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="w-full">
            <ClozeRenderer
              html={html}
              clozes={clozes}
              activeIndex={activeIndex}
              isFlipped={true}
            />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
