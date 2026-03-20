"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ExpandedState,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Badge } from "@/components/ui/badge"
import { ClozeRenderer } from "@/components/ClozeRenderer"
import { parseCloze, stripHtml } from "@/lib/card-parser"
import { ChevronRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrowseCard {
  id: string
  topic: string
  front_html: string
  back_html: string | null
  plain_text: string
  tags: string[]
  cloze_deletions: Array<{ index: number; answer: string; hint: string | null }>
}

interface CardListProps {
  cards: BrowseCard[]
  totalCount: number
  highlightCardId?: string
}

// ---------------------------------------------------------------------------
// Table column definitions
// ---------------------------------------------------------------------------

const columnHelper = createColumnHelper<BrowseCard>()

const columns = [
  columnHelper.display({
    id: "expand",
    size: 32,
    cell: ({ row }) => (
      <ChevronRightIcon
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform",
          row.getIsExpanded() && "rotate-90"
        )}
      />
    ),
  }),
  columnHelper.accessor("topic", {
    header: "Topic",
    size: 120,
    cell: (info) => (
      <Badge variant="secondary" className="text-[10px]">
        {info.getValue()}
      </Badge>
    ),
  }),
  columnHelper.accessor("front_html", {
    header: "Front",
    cell: (info) => {
      const text = stripHtml(info.getValue())
      return (
        <span className="line-clamp-2 text-sm" title={text}>
          {text.length > 100 ? text.slice(0, 100) + "..." : text}
        </span>
      )
    },
  }),
  columnHelper.accessor("cloze_deletions", {
    header: "Clozes",
    size: 64,
    cell: (info) => {
      const clozes = info.getValue()
      const uniqueIndices = new Set(clozes.map((c) => c.index))
      return (
        <span className="text-xs text-muted-foreground tabular-nums">
          {uniqueIndices.size}
        </span>
      )
    },
  }),
  columnHelper.accessor("tags", {
    header: "Tags",
    size: 120,
    cell: (info) => {
      const tags = info.getValue()
      if (!tags.length) return null
      return (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px]">
              {tag}
            </Badge>
          ))}
          {tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{tags.length - 3}
            </span>
          )}
        </div>
      )
    },
  }),
]

// ---------------------------------------------------------------------------
// Expanded row content
// ---------------------------------------------------------------------------

function ExpandedCardContent({ card }: { card: BrowseCard }) {
  const clozes = useMemo(() => parseCloze(card.front_html), [card.front_html])
  const uniqueIndices = useMemo(
    () => [...new Set(clozes.map((c) => c.index))].sort((a, b) => a - b),
    [clozes]
  )

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      {uniqueIndices.length > 0 ? (
        uniqueIndices.map((idx) => (
          <div key={idx} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Cloze {idx} &mdash; Front
            </p>
            <div className="rounded border bg-background p-2">
              <ClozeRenderer
                html={card.front_html}
                clozes={clozes}
                activeIndex={idx}
                isFlipped={false}
              />
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              Cloze {idx} &mdash; Back
            </p>
            <div className="rounded border bg-background p-2">
              <ClozeRenderer
                html={card.front_html}
                clozes={clozes}
                activeIndex={idx}
                isFlipped={true}
              />
            </div>
          </div>
        ))
      ) : (
        <div className="rounded border bg-background p-2">
          <div
            className="card-content-prose"
            dangerouslySetInnerHTML={{ __html: card.front_html }}
          />
        </div>
      )}
      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {card.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CardList component
// ---------------------------------------------------------------------------

export function CardList({ cards, totalCount, highlightCardId }: CardListProps) {
  const [expanded, setExpanded] = useState<ExpandedState>(() => {
    // If a specific card should be highlighted, expand it by default
    if (highlightCardId) {
      const idx = cards.findIndex((c) => c.id === highlightCardId)
      if (idx >= 0) return { [idx]: true }
    }
    return {}
  })

  const table = useReactTable({
    data: cards,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  })

  const { rows } = table.getRowModel()

  // Virtual scrolling
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(
      (index: number) => (rows[index]?.getIsExpanded() ? 320 : 56),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [expanded]
    ),
    overscan: 10,
  })

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground px-1">
        Showing {cards.length} of {totalCount} cards
      </p>

      {/* Desktop table layout */}
      <div
        ref={parentRef}
        className="hidden md:block overflow-auto rounded-lg border"
        style={{ height: "calc(100dvh - 220px)" }}
        role="table"
        aria-rowcount={totalCount}
        aria-label="Flashcard list"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm" role="row">
          {table.getHeaderGroups().map((headerGroup) => (
            <div key={headerGroup.id} className="flex border-b">
              {headerGroup.headers.map((header) => (
                <div
                  key={header.id}
                  role="columnheader"
                  className="px-3 py-2 text-xs font-medium text-muted-foreground"
                  style={{
                    width: header.getSize(),
                    flexGrow: header.id === "front_html" ? 1 : 0,
                    flexShrink: 0,
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Virtualized rows */}
        <div
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            if (!row) return null
            const isExpanded = row.getIsExpanded()

            return (
              <div
                key={row.id}
                role="row"
                aria-rowindex={virtualRow.index + 2}
                aria-expanded={isExpanded}
                aria-controls={isExpanded ? `expanded-${row.id}` : undefined}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className={cn(
                  "absolute left-0 w-full cursor-pointer border-b transition-colors hover:bg-muted/40",
                  row.original.id === highlightCardId && "bg-primary/5"
                )}
                style={{ top: virtualRow.start }}
                onClick={() => row.toggleExpanded()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    row.toggleExpanded()
                  }
                }}
                tabIndex={0}
              >
                <div className="flex items-center">
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      role="cell"
                      className="px-3 py-2"
                      style={{
                        width: cell.column.getSize(),
                        flexGrow: cell.column.id === "front_html" ? 1 : 0,
                        flexShrink: 0,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
                {isExpanded && (
                  <div id={`expanded-${row.id}`} className="px-3 pb-3">
                    <ExpandedCardContent card={row.original} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile card layout */}
      <div className="flex flex-col gap-2 md:hidden" role="list" aria-label="Flashcard list">
        {cards.map((card, index) => (
          <MobileCardItem
            key={card.id}
            card={card}
            isHighlighted={card.id === highlightCardId}
            defaultExpanded={card.id === highlightCardId}
            index={index}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mobile card item
// ---------------------------------------------------------------------------

function MobileCardItem({
  card,
  isHighlighted,
  defaultExpanded,
  index,
}: {
  card: BrowseCard
  isHighlighted: boolean
  defaultExpanded: boolean
  index: number
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const plainText = useMemo(() => stripHtml(card.front_html), [card.front_html])
  const clozes = useMemo(() => parseCloze(card.front_html), [card.front_html])
  const clozeCount = useMemo(
    () => new Set(clozes.map((c) => c.index)).size,
    [clozes]
  )

  return (
    <div
      role="listitem"
      aria-expanded={isExpanded}
      aria-controls={isExpanded ? `mobile-expanded-${card.id}` : undefined}
      className={cn(
        "rounded-lg border bg-card p-3 transition-colors",
        isHighlighted && "ring-2 ring-primary/30"
      )}
    >
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} card ${index + 1}: ${plainText.slice(0, 50)}`}
      >
        <ChevronRightIcon
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            isExpanded && "rotate-90"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {card.topic}
            </Badge>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {clozeCount} cloze{clozeCount !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="line-clamp-2 text-sm text-foreground">
            {plainText.length > 120 ? plainText.slice(0, 120) + "..." : plainText}
          </p>
        </div>
      </button>

      {isExpanded && (
        <div id={`mobile-expanded-${card.id}`} className="mt-3">
          <ExpandedCardContent card={card} />
        </div>
      )}
    </div>
  )
}
