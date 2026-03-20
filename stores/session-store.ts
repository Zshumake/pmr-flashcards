import { createStore, type StoreApi } from 'zustand/vanilla'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StudyMode = 'review' | 'exam' | 'drill' | 'browse'

export interface SessionState {
  /** Current study mode, null when no session is active. */
  mode: StudyMode | null
  /** Unique identifier for the active session. */
  activeSessionId: string | null
  /** Elapsed seconds since the session started. */
  elapsedSeconds: number
  /** Whether the timer is currently running. */
  timerRunning: boolean
  /** Optional topic filter applied to the current session. */
  topicFilter: string | null
}

export interface SessionActions {
  startSession: (mode: StudyMode, sessionId: string) => void
  endSession: () => void
  /** Increment the elapsed timer by one second. */
  tick: () => void
  setTopicFilter: (topic: string | null) => void
}

export type SessionSlice = SessionState & SessionActions

export type SessionStore = StoreApi<SessionSlice>

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const initialState: SessionState = {
  mode: null,
  activeSessionId: null,
  elapsedSeconds: 0,
  timerRunning: false,
  topicFilter: null,
}

export function createSessionStore(): SessionStore {
  return createStore<SessionSlice>((set) => ({
    ...initialState,

    startSession(mode, sessionId) {
      set({
        mode,
        activeSessionId: sessionId,
        elapsedSeconds: 0,
        timerRunning: true,
      })
    },

    endSession() {
      set({
        mode: null,
        activeSessionId: null,
        timerRunning: false,
      })
    },

    tick() {
      set((state) => {
        if (!state.timerRunning) return state
        return { elapsedSeconds: state.elapsedSeconds + 1 }
      })
    },

    setTopicFilter(topic) {
      set({ topicFilter: topic })
    },
  }))
}
