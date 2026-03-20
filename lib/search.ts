import Fuse, { type IFuseOptions } from "fuse.js"
import type { SupabaseClient } from "@supabase/supabase-js"

export interface CardSearchResult {
  id: string
  topic: string
  front_html: string
  back_html: string | null
  plain_text: string
  tags: string[]
  cloze_deletions: Array<{ index: number; answer: string; hint: string | null }>
}

/**
 * Full-text search using Supabase's built-in `search_vector` tsvector column.
 * Returns up to `limit` matching cards ordered by relevance.
 */
export async function searchOnline(
  query: string,
  supabase: SupabaseClient,
  limit = 20
): Promise<CardSearchResult[]> {
  // Convert user query to tsquery-compatible format:
  // split on whitespace, join with & for AND semantics
  const tsQuery = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" & ")

  if (!tsQuery) return []

  const { data, error } = await supabase
    .from("cards")
    .select("id, topic, front_html, back_html, plain_text, tags, cloze_deletions")
    .textSearch("search_vector", tsQuery)
    .limit(limit)

  if (error) {
    console.error("searchOnline error:", error.message)
    return []
  }

  return (data ?? []) as CardSearchResult[]
}

// ---------------------------------------------------------------------------
// Offline search with Fuse.js (medical-optimized config)
// ---------------------------------------------------------------------------

const fuseOptions: IFuseOptions<CardSearchResult> = {
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 3,
  keys: [
    { name: "plain_text", weight: 0.4 },
    { name: "topic", weight: 0.3 },
    { name: "tags", weight: 0.2 },
  ],
}

/**
 * Client-side fuzzy search over a preloaded card array.
 * Ideal for offline/PWA usage where the full card set is cached in IndexedDB.
 */
export function searchOffline(
  query: string,
  cards: CardSearchResult[]
): CardSearchResult[] {
  if (!query.trim()) return cards

  const fuse = new Fuse(cards, fuseOptions)
  return fuse.search(query).map((result) => result.item)
}
