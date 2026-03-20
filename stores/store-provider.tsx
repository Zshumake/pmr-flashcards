'use client'

import { createContext, useContext, useRef, type ReactNode } from 'react'
import { createSessionStore, type SessionStore } from './session-store'
import { createReviewStore, type ReviewStore } from './review-store'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface StoreContextValue {
  sessionStore: SessionStore
  reviewStore: ReviewStore
}

const StoreContext = createContext<StoreContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function StoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<StoreContextValue | null>(null)

  if (!storeRef.current) {
    storeRef.current = {
      sessionStore: createSessionStore(),
      reviewStore: createReviewStore(),
    }
  }

  return (
    <StoreContext value={storeRef.current}>
      {children}
    </StoreContext>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStores(): StoreContextValue {
  const ctx = useContext(StoreContext)
  if (!ctx) {
    throw new Error('useStores must be used within a <StoreProvider>')
  }
  return ctx
}
