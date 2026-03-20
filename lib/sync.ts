import type { SupabaseClient } from '@supabase/supabase-js'
import { db, type CachedCard } from './db'
import { useOfflineStore } from '@/stores/offline-store'

// ---------------------------------------------------------------------------
// Online check
// ---------------------------------------------------------------------------

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

// ---------------------------------------------------------------------------
// Card caching (for offline reads)
// ---------------------------------------------------------------------------

export async function cacheCards(cards: CachedCard[]): Promise<void> {
  await db.cards.bulkPut(cards)
}

export async function getCachedCards(topic?: string): Promise<CachedCard[]> {
  if (topic) {
    return db.cards.where('topic').equals(topic).toArray()
  }
  return db.cards.toArray()
}

// ---------------------------------------------------------------------------
// Sync queue
// ---------------------------------------------------------------------------

export async function queueReview(
  payload: Record<string, unknown>
): Promise<void> {
  await db.pendingSync.add({
    type: 'review',
    payload,
    created_at: new Date(),
  })
  useOfflineStore.getState().incrementPending()
}

export async function queueSession(
  payload: Record<string, unknown>
): Promise<void> {
  await db.pendingSync.add({
    type: 'session',
    payload,
    created_at: new Date(),
  })
  useOfflineStore.getState().incrementPending()
}

/**
 * Flush all pending sync entries to Supabase.
 * Processes entries oldest-first, deleting each after successful write.
 */
export async function flushSyncQueue(
  supabase: SupabaseClient
): Promise<{ flushed: number; failed: number }> {
  const store = useOfflineStore.getState()

  if (store.isSyncing) return { flushed: 0, failed: 0 }
  store.setSyncing(true)

  let flushed = 0
  let failed = 0

  try {
    const pending = await db.pendingSync
      .orderBy('created_at')
      .toArray()

    for (const entry of pending) {
      try {
        if (entry.type === 'review') {
          const { progressRows, logRows } = entry.payload as {
            progressRows: Record<string, unknown>[]
            logRows: Record<string, unknown>[]
          }

          const results = await Promise.all([
            progressRows?.length
              ? supabase
                  .from('user_progress')
                  .upsert(progressRows, { onConflict: 'card_id' })
              : Promise.resolve({ error: null }),
            logRows?.length
              ? supabase.from('review_log').insert(logRows)
              : Promise.resolve({ error: null }),
          ])

          const hasError = results.some((r) => r.error)
          if (hasError) {
            failed++
            continue
          }
        } else if (entry.type === 'session') {
          const { error } = await supabase
            .from('study_sessions')
            .upsert(entry.payload)

          if (error) {
            failed++
            continue
          }
        }

        // Delete the successfully synced entry
        if (entry.id !== undefined) {
          await db.pendingSync.delete(entry.id)
        }
        flushed++
      } catch {
        failed++
      }
    }

    // Update store
    const remaining = await db.pendingSync.count()
    store.setPendingCount(remaining)
    if (flushed > 0) store.markSynced()
  } finally {
    store.setSyncing(false)
  }

  return { flushed, failed }
}

/**
 * Refresh the pending count from Dexie (call on mount).
 */
export async function refreshPendingCount(): Promise<void> {
  const count = await db.pendingSync.count()
  useOfflineStore.getState().setPendingCount(count)
}

// ---------------------------------------------------------------------------
// Auto-sync setup
// ---------------------------------------------------------------------------

let syncInterval: ReturnType<typeof setInterval> | null = null

/**
 * Initialize online/offline listeners and periodic sync.
 * Call once from a top-level client component.
 */
export function initAutoSync(getSupabase: () => SupabaseClient): () => void {
  const store = useOfflineStore.getState()

  function handleOnline() {
    store.setOnline(true)
    // Flush immediately when coming back online
    flushSyncQueue(getSupabase())
  }

  function handleOffline() {
    store.setOnline(false)
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Set initial state
  store.setOnline(navigator.onLine)
  refreshPendingCount()

  // Periodic sync every 5 minutes when online
  syncInterval = setInterval(() => {
    if (navigator.onLine) {
      flushSyncQueue(getSupabase())
    }
  }, 5 * 60 * 1000)

  // Cleanup
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    if (syncInterval) {
      clearInterval(syncInterval)
      syncInterval = null
    }
  }
}
