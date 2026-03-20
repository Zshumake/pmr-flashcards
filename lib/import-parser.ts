import { parseCloze, stripHtml } from './card-parser'

export interface ParsedCard {
  anki_guid: string
  topic: string
  front_html: string
  back_html: string | null
  cloze_deletions: Array<{ index: number; answer: string; hint: string | null }>
  plain_text: string
  tags: string[]
}

/**
 * Parse a tab-separated Anki export line, handling CSV-style quoting
 * where fields containing tabs or quotes are wrapped in quotes with
 * internal quotes doubled ("").
 */
export function parseAnkiLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  let i = 0

  while (i < line.length) {
    const ch = line[i]

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          current += '"'
          i += 2
        } else {
          // End of quoted field
          inQuotes = false
          i++
        }
      } else {
        current += ch
        i++
      }
    } else {
      if (ch === '"' && current === '') {
        // Start of quoted field
        inQuotes = true
        i++
      } else if (ch === '\t') {
        fields.push(current)
        current = ''
        i++
      } else {
        current += ch
        i++
      }
    }
  }

  fields.push(current)
  return fields
}

/**
 * Derive topic from deck name.
 * "z EMG" -> "EMG", "z P&O gait" -> "P&O gait"
 */
export function deriveTopic(deckName: string): string {
  return deckName.replace(/^z\s+/i, '').trim()
}

/**
 * Parse a single Anki export line into a structured card object.
 */
export function parseCardLine(line: string): ParsedCard | null {
  const fields = parseAnkiLine(line)
  if (fields.length < 4) return null

  const [guid, , deck, frontHtml, backHtml, tags] = fields

  if (!guid || !frontHtml) return null

  const clozes = parseCloze(frontHtml)
  const plainText = stripHtml(frontHtml + (backHtml ? ' ' + backHtml : ''))

  return {
    anki_guid: guid,
    topic: deriveTopic(deck || ''),
    front_html: frontHtml,
    back_html: backHtml || null,
    cloze_deletions: clozes,
    plain_text: plainText,
    tags: tags ? tags.trim().split(/\s+/).filter(Boolean) : [],
  }
}

/**
 * Parse an entire Anki .txt export file content.
 * Skips the 6 header lines.
 */
export function parseAnkiFile(content: string): ParsedCard[] {
  const lines = content.split('\n')
  const cards: ParsedCard[] = []

  // Skip header lines (start with #)
  let dataStart = 0
  for (let i = 0; i < lines.length && i < 10; i++) {
    if (lines[i].startsWith('#')) {
      dataStart = i + 1
    } else {
      break
    }
  }

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const card = parseCardLine(line)
    if (card) cards.push(card)
  }

  return cards
}
