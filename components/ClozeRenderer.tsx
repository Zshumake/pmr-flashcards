"use client"

import { useMemo } from "react"
import type { ClozeDeletion } from "@/lib/card-parser"
import { renderClozeFront, renderClozeBack } from "@/lib/card-parser"
import { sanitizeCardHtml } from "@/lib/sanitize"

interface ClozeRendererProps {
  html: string
  clozes: ClozeDeletion[]
  activeIndex: number
  isFlipped: boolean
}

export function ClozeRenderer({
  html,
  clozes,
  activeIndex,
  isFlipped,
}: ClozeRendererProps) {
  const sanitizedHtml = useMemo(() => {
    const rendered = isFlipped
      ? renderClozeBack(html, clozes, activeIndex)
      : renderClozeFront(html, clozes, activeIndex)
    return sanitizeCardHtml(rendered)
  }, [html, clozes, activeIndex, isFlipped])

  return (
    <>
      <div
        className="card-content-prose"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isFlipped ? "Showing answer" : "Showing front of card"}
      </div>
    </>
  )
}
