import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
} from 'ts-fsrs'

export interface CardState {
  due: Date | null
  stability: number
  difficulty: number
  reps: number
  lapses: number
  card_state: number // 0=New, 1=Learning, 2=Review, 3=Relearning
  scheduled_days: number
  last_review: Date | null
}

export interface ScheduleResult {
  again: CardState
  hard: CardState
  good: CardState
  easy: CardState
}

interface FsrsEngineOptions {
  requestRetention?: number
  maxInterval?: number
}

export function createNewCardState(): CardState {
  return {
    due: null,
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    card_state: 0,
    scheduled_days: 0,
    last_review: null,
  }
}

export function createFsrsEngine(options: FsrsEngineOptions = {}) {
  const params = generatorParameters({
    request_retention: options.requestRetention ?? 0.9,
    maximum_interval: options.maxInterval ?? 365,
    enable_fuzz: true,
    enable_short_term: true,
  })
  const f = fsrs(params)

  function stateToCard(state: CardState): Card {
    const empty = createEmptyCard()
    return {
      ...empty,
      due: state.due ?? new Date(),
      stability: state.stability,
      difficulty: state.difficulty,
      reps: state.reps,
      lapses: state.lapses,
      state: state.card_state as State,
      scheduled_days: state.scheduled_days,
      last_review: state.last_review ?? undefined,
    }
  }

  function cardToState(card: Card): CardState {
    return {
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      reps: card.reps,
      lapses: card.lapses,
      card_state: card.state as number,
      scheduled_days: card.scheduled_days,
      last_review: card.last_review ? new Date(card.last_review) : null,
    }
  }

  return {
    schedule(state: CardState, now: Date): ScheduleResult {
      const card = stateToCard(state)
      const results = f.repeat(card, now)
      return {
        again: cardToState(results[Rating.Again].card),
        hard: cardToState(results[Rating.Hard].card),
        good: cardToState(results[Rating.Good].card),
        easy: cardToState(results[Rating.Easy].card),
      }
    },
  }
}
