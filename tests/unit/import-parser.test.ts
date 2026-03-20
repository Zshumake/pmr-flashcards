import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseAnkiLine, deriveTopic, parseCardLine, parseAnkiFile } from '@/lib/import-parser'

describe('parseAnkiLine', () => {
  it('splits simple tab-separated fields', () => {
    const result = parseAnkiLine('a\tb\tc')
    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('handles quoted fields with escaped quotes', () => {
    const result = parseAnkiLine('"Em,#%|7qO7"\tCloze deletion\tz misc\t"{{c1::test}}<span style=""color: red;"">text</span>"')
    expect(result[0]).toBe('Em,#%|7qO7')
    expect(result[3]).toContain('style="color: red;"')
  })

  it('handles empty fields', () => {
    const result = parseAnkiLine('guid\ttype\tdeck\tfront\t\t')
    expect(result).toHaveLength(6)
    expect(result[4]).toBe('')
  })

  it('handles field with tabs inside quotes', () => {
    // This shouldn't happen in Anki exports, but test robustness
    const result = parseAnkiLine('"field\twith\ttabs"\tother')
    expect(result[0]).toBe('field\twith\ttabs')
  })
})

describe('deriveTopic', () => {
  it('strips "z " prefix', () => {
    expect(deriveTopic('z EMG')).toBe('EMG')
  })

  it('handles multi-word topics', () => {
    expect(deriveTopic('z P&O gait')).toBe('P&O gait')
  })

  it('handles no prefix', () => {
    expect(deriveTopic('SCI')).toBe('SCI')
  })
})

describe('parseCardLine', () => {
  it('parses a simple card line', () => {
    const line = 'guid123\tCloze deletion\tz EMG\t{{c1::Dystonia}}: Movement disorder\t\t'
    const card = parseCardLine(line)
    expect(card).not.toBeNull()
    expect(card!.anki_guid).toBe('guid123')
    expect(card!.topic).toBe('EMG')
    expect(card!.cloze_deletions).toHaveLength(1)
    expect(card!.cloze_deletions[0].answer).toBe('Dystonia')
    expect(card!.plain_text).toContain('Dystonia')
  })

  it('parses tags', () => {
    const line = 'guid\ttype\tdeck\tfront {{c1::test}}\tback\ttag1 tag2 tag3'
    const card = parseCardLine(line)
    expect(card!.tags).toEqual(['tag1', 'tag2', 'tag3'])
  })

  it('parses multi-cloze card', () => {
    const line = 'guid\tCloze deletion\tz misc\t{{c1::A}} and {{c2::B}} and {{c3::C}}\t\t'
    const card = parseCardLine(line)
    expect(card!.cloze_deletions).toHaveLength(3)
  })

  it('returns null for malformed line', () => {
    expect(parseCardLine('too\tfew')).toBeNull()
  })

  it('handles null back_html', () => {
    const line = 'guid\ttype\tdeck\tfront {{c1::test}}\t\t'
    const card = parseCardLine(line)
    expect(card!.back_html).toBeNull()
  })
})

describe('parseAnkiFile', () => {
  it('parses the sample fixture file', () => {
    const content = readFileSync(
      join(__dirname, '../fixtures/sample-export.txt'),
      'utf-8'
    )
    const cards = parseAnkiFile(content)
    expect(cards.length).toBeGreaterThanOrEqual(4)

    // Check first card
    expect(cards[0].anki_guid).toBe('C[`+ILuy%v')
    expect(cards[0].topic).toBe('misc')
    expect(cards[0].cloze_deletions[0].answer).toBe('Dystonia')

    // Check multi-cloze card (Tardieu Scale)
    const tardieu = cards.find(c => c.front_html.includes('Tardieu'))
    expect(tardieu).toBeDefined()
    expect(tardieu!.cloze_deletions.length).toBe(3)
    expect(tardieu!.tags).toEqual(['tag1', 'tag2'])
    expect(tardieu!.back_html).toContain('back content')
  })

  it('skips header lines', () => {
    const content = '#separator:tab\n#html:true\n#guid column:1\n#notetype column:2\n#deck column:3\n#tags column:6\nguid\tCloze deletion\tz test\t{{c1::answer}}\t\t'
    const cards = parseAnkiFile(content)
    expect(cards).toHaveLength(1)
  })
})
