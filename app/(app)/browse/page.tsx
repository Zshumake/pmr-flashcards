import { createServerSupabaseClient } from "@/lib/supabase/server"
import { CommandSearch } from "@/components/CommandSearch"
import { CardList, type BrowseCard } from "@/components/CardList"
import { BrowseFilters } from "./browse-filters"

const PAGE_SIZE = 50

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const topic = typeof params.topic === "string" ? params.topic : undefined
  const q = typeof params.q === "string" ? params.q : undefined
  const pageStr = typeof params.page === "string" ? params.page : "1"
  const state = typeof params.state === "string" ? params.state : undefined
  const highlightCard = typeof params.card === "string" ? params.card : undefined
  const page = Math.max(1, parseInt(pageStr, 10) || 1)

  const supabase = await createServerSupabaseClient()

  // Build query
  let query = supabase
    .from("cards")
    .select("id, topic, front_html, back_html, plain_text, tags, cloze_deletions", {
      count: "exact",
    })

  // Apply topic filter
  if (topic) {
    query = query.eq("topic", topic)
  }

  // Apply full-text search
  if (q && q.trim().length >= 2) {
    const tsQuery = q
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(" & ")
    query = query.textSearch("search_vector", tsQuery)
  }

  // Apply card state filter (requires join with user_progress)
  if (state && ["new", "learning", "review"].includes(state)) {
    // State filtering: 0=New, 1=Learning, 2=Review, 3=Relearning
    const stateMap: Record<string, number[]> = {
      new: [0],
      learning: [1, 3],
      review: [2],
    }
    const stateValues = stateMap[state]
    if (stateValues) {
      // For "new" cards, we want cards with no user_progress entry OR card_state=0
      // This requires a different approach since Supabase doesn't support LEFT JOINs easily
      // We'll use an RPC or filter directly if user_progress is embedded
      // For now, order by topic as a fallback
    }
  }

  // Apply pagination
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  query = query.order("topic").order("id").range(from, to)

  const { data: cards, count, error } = await query

  if (error) {
    console.error("Browse page query error:", error.message)
  }

  const totalCount = count ?? 0
  const browseCards: BrowseCard[] = (cards ?? []).map((card) => ({
    ...card,
    back_html: card.back_html ?? null,
    cloze_deletions: (typeof card.cloze_deletions === "string"
      ? JSON.parse(card.cloze_deletions)
      : card.cloze_deletions) as BrowseCard["cloze_deletions"],
    tags: (Array.isArray(card.tags) ? card.tags : []) as string[],
  }))

  // Get distinct topics for filter dropdown
  const { data: topicRows } = await supabase
    .from("cards")
    .select("topic")
    .order("topic")

  const topics = [
    ...new Set((topicRows ?? []).map((r: { topic: string }) => r.topic)),
  ]

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Header with search */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold md:text-xl">Browse Cards</h1>
        <CommandSearch />
      </div>

      {/* Filters */}
      <BrowseFilters
        topics={topics}
        currentTopic={topic}
        currentQuery={q}
        currentState={state}
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
      />

      {/* Card list */}
      {browseCards.length > 0 ? (
        <CardList
          cards={browseCards}
          totalCount={totalCount}
          highlightCardId={highlightCard}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">
            {q ? `No cards found for "${q}"` : "No cards found."}
          </p>
          {(q || topic || state) && (
            <a
              href="/browse"
              className="mt-2 text-sm text-primary underline-offset-4 hover:underline"
            >
              Clear all filters
            </a>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <BrowsePagination
          currentPage={page}
          totalPages={totalPages}
          topic={topic}
          q={q}
          state={state}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pagination (server component)
// ---------------------------------------------------------------------------

function BrowsePagination({
  currentPage,
  totalPages,
  topic,
  q,
  state,
}: {
  currentPage: number
  totalPages: number
  topic?: string
  q?: string
  state?: string
}) {
  function buildHref(page: number): string {
    const params = new URLSearchParams()
    if (topic) params.set("topic", topic)
    if (q) params.set("q", q)
    if (state) params.set("state", state)
    if (page > 1) params.set("page", String(page))
    const qs = params.toString()
    return `/browse${qs ? `?${qs}` : ""}`
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-2 py-4"
    >
      {currentPage > 1 ? (
        <a
          href={buildHref(currentPage - 1)}
          className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
        >
          Previous
        </a>
      ) : (
        <span className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium text-muted-foreground opacity-50">
          Previous
        </span>
      )}

      <span className="text-sm tabular-nums text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>

      {currentPage < totalPages ? (
        <a
          href={buildHref(currentPage + 1)}
          className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
        >
          Next
        </a>
      ) : (
        <span className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium text-muted-foreground opacity-50">
          Next
        </span>
      )}
    </nav>
  )
}
