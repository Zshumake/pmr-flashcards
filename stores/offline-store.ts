import { create } from 'zustand'

interface OfflineState {
  isOnline: boolean
  pendingCount: number
  lastSyncedAt: Date | null
  isSyncing: boolean

  setOnline: (online: boolean) => void
  setPendingCount: (count: number) => void
  incrementPending: () => void
  decrementPending: (by?: number) => void
  markSynced: () => void
  setSyncing: (syncing: boolean) => void
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingCount: 0,
  lastSyncedAt: null,
  isSyncing: false,

  setOnline: (online) => set({ isOnline: online }),
  setPendingCount: (count) => set({ pendingCount: count }),
  incrementPending: () => set((s) => ({ pendingCount: s.pendingCount + 1 })),
  decrementPending: (by = 1) =>
    set((s) => ({ pendingCount: Math.max(0, s.pendingCount - by) })),
  markSynced: () => set({ lastSyncedAt: new Date(), isSyncing: false }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
}))
