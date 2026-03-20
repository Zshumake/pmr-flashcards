import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  parseCloze,
  stripHtml,
  generateDistractors,
  renderClozeFront,
  renderClozeBack,
} from '@/lib/card-parser'

describe('parseCloze', () => {
  it('parses single cloze deletion', () => {
    const result = parseCloze('The nerve is {{c1::Spinal accessory}}')
    expect(result).toEqual([
      { index: 1, answer: 'Spinal accessory', hint: null },
    ])
  })

  it('parses cloze with hint', () => {
    const result = parseCloze('Root: {{c2::C3, C4::2}}')
    expect(result).toEqual([{ index: 2, answer: 'C3, C4', hint: '2' }])
  })

  it('parses multiple clozes on one note', () => {
    const result = parseCloze(
      'Nerve: {{c1::Long thoracic}} Root: {{c2::C5, C6, C7::3}}'
    )
    expect(result).toHaveLength(2)
    expect(result[0].answer).toBe('Long thoracic')
    expect(result[1].answer).toBe('C5, C6, C7')
  })

  it('handles nested HTML inside cloze', () => {
    const result = parseCloze('{{c1::<b>answer</b>}}')
    expect(result[0].answer).toBe('<b>answer</b>')
  })

  it('handles empty cloze gracefully', () => {
    const result = parseCloze('{{c1::}}')
    expect(result[0].answer).toBe('')
  })

  it('returns empty array for no clozes', () => {
    const result = parseCloze('No cloze here')
    expect(result).toEqual([])
  })

  it('handles malformed cloze (missing closing braces)', () => {
    const result = parseCloze('{{c1::answer}')
    expect(result).toEqual([])
  })
})

describe('stripHtml', () => {
  it('strips tags preserving text', () => {
    expect(stripHtml('<div><b>hello</b> world</div>')).toBe('hello world')
  })

  it('decodes HTML entities', () => {
    expect(stripHtml('5 &gt; 3 &amp; 2 &lt; 4')).toBe('5 > 3 & 2 < 4')
  })

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('')
  })
})

describe('renderClozeFront', () => {
  it('blanks the active cloze and shows others', () => {
    const html = 'Nerve: {{c1::Long thoracic}} Root: {{c2::C5, C6, C7}}'
    const clozes = parseCloze(html)
    const result = renderClozeFront(html, clozes, 1)
    expect(result).toContain('<span class="cloze-blank">[...]</span>')
    expect(result).toContain('C5, C6, C7')
    expect(result).not.toContain('Long thoracic')
  })

  it('shows hint when present', () => {
    const html = '{{c1::answer::hint}}'
    const clozes = parseCloze(html)
    const result = renderClozeFront(html, clozes, 1)
    expect(result).toContain('(hint)')
  })
})

describe('renderClozeBack', () => {
  it('reveals the active cloze answer', () => {
    const html = 'Nerve: {{c1::Long thoracic}} Root: {{c2::C5, C6, C7}}'
    const clozes = parseCloze(html)
    const result = renderClozeBack(html, clozes, 1)
    expect(result).toContain(
      '<span class="cloze-answer">Long thoracic</span>'
    )
    expect(result).toContain('C5, C6, C7')
  })
})

describe('generateDistractors', () => {
  const sameTopicAnswers = [
    'Spinal accessory',
    'Long thoracic',
    'Dorsal scapular',
    'Suprascapular',
    'Axillary',
  ]

  it('returns 3 distractors', () => {
    const result = generateDistractors('Spinal accessory', sameTopicAnswers)
    expect(result).toHaveLength(3)
  })

  it('does not include correct answer', () => {
    const result = generateDistractors('Spinal accessory', sameTopicAnswers)
    expect(result).not.toContain('Spinal accessory')
  })

  it('returns unique distractors', () => {
    const result = generateDistractors('Spinal accessory', sameTopicAnswers)
    expect(new Set(result).size).toBe(3)
  })

  it('handles insufficient pool gracefully', () => {
    const result = generateDistractors('answer', ['answer', 'one'])
    expect(result.length).toBeLessThanOrEqual(3)
    expect(result.length).toBeGreaterThanOrEqual(1)
  })
})

describe('parseCloze properties', () => {
  it('never crashes on arbitrary input', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const result = parseCloze(s)
        expect(Array.isArray(result)).toBe(true)
      })
    )
  })

  it('parsed count matches cloze marker count', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            index: fc.integer({ min: 1, max: 9 }),
            answer: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter((s) => !s.includes('}}') && !s.includes('::')),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (clozes) => {
          const input = clozes
            .map((c) => `{{c${c.index}::${c.answer}}}`)
            .join(' ')
          const result = parseCloze(input)
          expect(result.length).toBe(clozes.length)
        }
      )
    )
  })
})
