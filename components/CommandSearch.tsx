"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { SearchIcon } from "lucide-react"
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { stripHtml } from "@/lib/card-parser"
import type { CardSearchResult } from "@/lib/search"

function truncate(text: string, maxLength = 80): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + "..."
}

export function CommandSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<CardSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabaseRef = useRef(createClient())

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const runSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    const tsQuery = searchQuery
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(" & ")

    const { data, error } = await supabaseRef.current
      .from("cards")
      .select("id, topic, front_html, back_html, plain_text, tags, cloze_deletions")
      .textSearch("search_vector", tsQuery)
      .limit(15)

    if (!error && data) {
      setResults(data as CardSearchResult[])
    }
    setIsSearching(false)
  }, [])

  const handleValueChange = useCallback(
    (value: string) => {
      setQuery(value)

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        runSearch(value)
      }, 300)
    },
    [runSearch]
  )

  const handleSelect = useCallback(
    (cardId: string) => {
      setOpen(false)
      setQuery("")
      setResults([])
      router.push(`/browse?card=${cardId}`)
    },
    [router]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return (
    <>
      {/* Mobile: icon button. Desktop: styled search trigger */}
      <Button
        variant="outline"
        size="sm"
        className="relative h-9 w-9 md:h-9 md:w-60 md:justify-start md:px-3 md:text-sm md:text-muted-foreground"
        onClick={() => setOpen(true)}
        aria-label="Search cards"
      >
        <SearchIcon className="size-4 md:mr-2" />
        <span className="hidden md:inline-flex">Search cards...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1/2 hidden h-5 -translate-y-1/2 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 md:flex">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search flashcards"
        description="Search PM&amp;R flashcards by topic, content, or tags"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search cards..."
            value={query}
            onValueChange={handleValueChange}
          />
          <CommandList
            aria-label={`${results.length} search result${results.length !== 1 ? "s" : ""}`}
          >
            {query.trim().length >= 2 && !isSearching && results.length === 0 && (
              <CommandEmpty>No cards found.</CommandEmpty>
            )}
            {isSearching && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            )}
            {results.length > 0 && (
              <CommandGroup heading="Cards">
                {results.map((card) => (
                  <CommandItem
                    key={card.id}
                    value={card.id}
                    onSelect={handleSelect}
                    className="flex flex-col items-start gap-1 py-2"
                  >
                    <div className="flex w-full items-center gap-2">
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {card.topic}
                      </Badge>
                      <span className="truncate text-xs text-muted-foreground">
                        {truncate(stripHtml(card.front_html))}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>

      {/* Live region for screen reader result count announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isSearching
          ? "Searching..."
          : query.trim().length >= 2
            ? `${results.length} result${results.length !== 1 ? "s" : ""} found`
            : ""}
      </div>
    </>
  )
}
