"use client"

import { useCallback, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ChevronDownIcon,
  FilterIcon,
  XIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface BrowseFiltersProps {
  topics: string[]
  currentTopic?: string
  currentQuery?: string
  currentState?: string
  currentPage: number
  totalPages: number
  totalCount: number
}

function buildHref(params: {
  topic?: string
  q?: string
  state?: string
  page?: number
}): string {
  const searchParams = new URLSearchParams()
  if (params.topic) searchParams.set("topic", params.topic)
  if (params.q) searchParams.set("q", params.q)
  if (params.state) searchParams.set("state", params.state)
  if (params.page && params.page > 1) searchParams.set("page", String(params.page))
  const qs = searchParams.toString()
  return `/browse${qs ? `?${qs}` : ""}`
}

const STATE_OPTIONS = [
  { value: "new", label: "New" },
  { value: "learning", label: "Learning" },
  { value: "review", label: "Review" },
] as const

export function BrowseFilters({
  topics,
  currentTopic,
  currentQuery,
  currentState,
  totalCount,
}: BrowseFiltersProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [searchValue, setSearchValue] = useState(currentQuery ?? "")

  const navigate = useCallback(
    (params: { topic?: string; q?: string; state?: string }) => {
      startTransition(() => {
        router.push(buildHref(params))
      })
    },
    [router]
  )

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      navigate({
        topic: currentTopic,
        q: searchValue || undefined,
        state: currentState,
      })
    },
    [navigate, currentTopic, currentState, searchValue]
  )

  const handleTopicSelect = useCallback(
    (topic: string | undefined) => {
      navigate({ topic, q: currentQuery, state: currentState })
    },
    [navigate, currentQuery, currentState]
  )

  const handleStateSelect = useCallback(
    (state: string | undefined) => {
      navigate({ topic: currentTopic, q: currentQuery, state })
    },
    [navigate, currentTopic, currentQuery]
  )

  const clearAll = useCallback(() => {
    setSearchValue("")
    navigate({})
  }, [navigate])

  const hasActiveFilters = currentTopic || currentQuery || currentState

  const filterContent = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Text search */}
      <form onSubmit={handleSearch} className="flex gap-1.5">
        <Input
          type="search"
          placeholder="Filter by text..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="h-8 w-40 text-sm md:w-56"
          aria-label="Filter cards by text"
        />
        <Button type="submit" variant="secondary" size="sm" className="h-8">
          Filter
        </Button>
      </form>

      {/* Topic filter */}
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              {currentTopic ? (
                <>
                  <Badge variant="secondary" className="text-[10px]">
                    {currentTopic}
                  </Badge>
                  <XIcon
                    className="size-3 text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleTopicSelect(undefined)
                    }}
                  />
                </>
              ) : (
                <>
                  Topic
                  <ChevronDownIcon className="size-3 text-muted-foreground" />
                </>
              )}
            </Button>
          }
        />
        <PopoverContent className="w-48 p-0" align="start">
          <ScrollArea className="max-h-64">
            <div className="flex flex-col py-1">
              {currentTopic && (
                <button
                  type="button"
                  className="px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
                  onClick={() => handleTopicSelect(undefined)}
                >
                  All topics
                </button>
              )}
              {topics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className={cn(
                    "px-3 py-1.5 text-left text-sm hover:bg-muted",
                    topic === currentTopic && "bg-muted font-medium"
                  )}
                  onClick={() => handleTopicSelect(topic)}
                >
                  {topic}
                </button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* State filter */}
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              {currentState ? (
                <>
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {currentState}
                  </Badge>
                  <XIcon
                    className="size-3 text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStateSelect(undefined)
                    }}
                  />
                </>
              ) : (
                <>
                  State
                  <ChevronDownIcon className="size-3 text-muted-foreground" />
                </>
              )}
            </Button>
          }
        />
        <PopoverContent className="w-36 p-0" align="start">
          <div className="flex flex-col py-1">
            {currentState && (
              <button
                type="button"
                className="px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
                onClick={() => handleStateSelect(undefined)}
              >
                All states
              </button>
            )}
            {STATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  "px-3 py-1.5 text-left text-sm hover:bg-muted",
                  opt.value === currentState && "bg-muted font-medium"
                )}
                onClick={() => handleStateSelect(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear all */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={clearAll}
        >
          Clear all
        </Button>
      )}

      {/* Loading indicator */}
      {isPending && (
        <span className="text-xs text-muted-foreground animate-pulse">
          Loading...
        </span>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop: inline filters */}
      <div className="hidden md:block">{filterContent}</div>

      {/* Mobile: collapsible filter panel */}
      <div className="md:hidden">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => setMobileFiltersOpen((prev) => !prev)}
          aria-expanded={mobileFiltersOpen}
          aria-controls="mobile-filter-panel"
        >
          <FilterIcon className="size-3.5" />
          Filters
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1 size-5 justify-center rounded-full p-0 text-[10px]">
              {[currentTopic, currentQuery, currentState].filter(Boolean).length}
            </Badge>
          )}
        </Button>

        {mobileFiltersOpen && (
          <div
            id="mobile-filter-panel"
            className="mt-2 rounded-lg border bg-card p-3"
          >
            {filterContent}
          </div>
        )}

        {/* Active filter summary (always visible on mobile) */}
        {hasActiveFilters && !mobileFiltersOpen && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {currentQuery && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                &quot;{currentQuery}&quot;
                <button
                  type="button"
                  onClick={() =>
                    navigate({ topic: currentTopic, state: currentState })
                  }
                  aria-label="Remove text filter"
                >
                  <XIcon className="size-2.5" />
                </button>
              </Badge>
            )}
            {currentTopic && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                {currentTopic}
                <button
                  type="button"
                  onClick={() =>
                    navigate({ q: currentQuery, state: currentState })
                  }
                  aria-label="Remove topic filter"
                >
                  <XIcon className="size-2.5" />
                </button>
              </Badge>
            )}
            {currentState && (
              <Badge variant="outline" className="gap-1 text-[10px] capitalize">
                {currentState}
                <button
                  type="button"
                  onClick={() =>
                    navigate({ topic: currentTopic, q: currentQuery })
                  }
                  aria-label="Remove state filter"
                >
                  <XIcon className="size-2.5" />
                </button>
              </Badge>
            )}
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {totalCount} cards
            </span>
          </div>
        )}
      </div>
    </>
  )
}
