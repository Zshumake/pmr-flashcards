import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { createFsrsEngine, createNewCardState } from '@/lib/fsrs'

describe('FSRS Engine', () => {
  const engine = createFsrsEngine({ requestRetention: 0.9 })

  it('creates new card state', () => {
    const state = createNewCardState()
    expect(state.card_state).toBe(0) // New
    expect(state.reps).toBe(0)
    expect(state.stability).toBe(0)
  })

  it('schedules all 4 ratings for a new card', () => {
    const state = createNewCardState()
    const results = engine.schedule(state, new Date())
    expect(results.again).toBeDefined()
    expect(results.hard).toBeDefined()
    expect(results.good).toBeDefined()
    expect(results.easy).toBeDefined()
  })

  it('Again produces shortest interval', () => {
    const state = createNewCardState()
    const now = new Date()
    const results = engine.schedule(state, now)
    expect(results.again.due!.getTime()).toBeLessThanOrEqual(
      results.good.due!.getTime()
    )
  })

  it('Easy produces longest interval', () => {
    const state = createNewCardState()
    const now = new Date()
    const results = engine.schedule(state, now)
    expect(results.easy.due!.getTime()).toBeGreaterThanOrEqual(
      results.good.due!.getTime()
    )
  })

  it('rating Good on new card transitions to Learning or Review', () => {
    const state = createNewCardState()
    const results = engine.schedule(state, new Date())
    expect(results.good.card_state).toBeGreaterThan(0)
  })

  it('stability is always non-negative', () => {
    let state = createNewCardState()
    const now = new Date()
    for (let i = 0; i < 10; i++) {
      const results = engine.schedule(
        state,
        new Date(now.getTime() + i * 86400000)
      )
      state = results.good
      expect(state.stability).toBeGreaterThanOrEqual(0)
    }
  })

  it('interval never exceeds maximum_interval', () => {
    const engine365 = createFsrsEngine({
      requestRetention: 0.9,
      maxInterval: 365,
    })
    let state = createNewCardState()
    const now = new Date()
    for (let i = 0; i < 20; i++) {
      const results = engine365.schedule(
        state,
        new Date(now.getTime() + i * 86400000 * 30)
      )
      state = results.easy
      // Fuzz can add a small percentage beyond maximum_interval
      expect(state.scheduled_days).toBeLessThanOrEqual(375)
    }
  })
})

describe('FSRS properties', () => {
  const engine = createFsrsEngine({ requestRetention: 0.9 })

  it('monotonicity: Easy interval >= Good >= Hard >= Again', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 0, 1) }).filter(
          (d) => !isNaN(d.getTime())
        ),
        (now) => {
          const state = createNewCardState()
          const r = engine.schedule(state, now)
          expect(r.easy.due!.getTime()).toBeGreaterThanOrEqual(
            r.good.due!.getTime()
          )
          expect(r.good.due!.getTime()).toBeGreaterThanOrEqual(
            r.hard.due!.getTime()
          )
          expect(r.hard.due!.getTime()).toBeGreaterThanOrEqual(
            r.again.due!.getTime()
          )
        }
      )
    )
  })
})
