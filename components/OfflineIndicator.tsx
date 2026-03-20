"use client"

import { useEffect } from "react"
import { Loader2, Wifi, WifiOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { initAutoSync } from "@/lib/sync"
import { useOfflineStore } from "@/stores/offline-store"

export function OfflineIndicator() {
  const isOnline = useOfflineStore((s) => s.isOnline)
  const isSyncing = useOfflineStore((s) => s.isSyncing)
  const pendingCount = useOfflineStore((s) => s.pendingCount)

  useEffect(() => {
    const cleanup = initAutoSync(() => createClient())
    return cleanup
  }, [])

  // Online and nothing pending -- show a subtle green dot
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return (
      <div
        className="flex items-center gap-1.5"
        role="status"
        aria-label="Online and synced"
      >
        <span className="size-2 rounded-full bg-emerald-500" />
        <span className="sr-only">Online and synced</span>
      </div>
    )
  }

  // Online but syncing
  if (isOnline && isSyncing) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        role="status"
        aria-label="Syncing"
      >
        <Loader2 className="size-3.5 animate-spin" />
        <span className="hidden sm:inline">Syncing...</span>
      </div>
    )
  }

  // Online with pending items (waiting for next sync cycle)
  if (isOnline && pendingCount > 0) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        role="status"
        aria-label={`${pendingCount} pending sync`}
      >
        <Wifi className="size-3.5" />
        <span className="tabular-nums">{pendingCount}</span>
      </div>
    )
  }

  // Offline
  return (
    <div
      className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      role="status"
      aria-label={`Offline with ${pendingCount} pending`}
    >
      <WifiOff className="size-3.5" />
      <span>Offline</span>
      {pendingCount > 0 && (
        <span className="tabular-nums">({pendingCount})</span>
      )}
    </div>
  )
}
