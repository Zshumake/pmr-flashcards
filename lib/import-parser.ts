import { createHash } from 'crypto'
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

interface FileFormat {
  hasGuid: boolean
  tagsColumn: number | null
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
 * Supports two formats:
 * - Format A (hasGuid=true): guid, notetype, deck, front, back, tags (6+ columns)
 * - Format B (hasGuid=false): front, back, tags... (2+ columns)
 */
export function parseCardLine(line: string, format?: FileFormat, filenameTopic?: string): ParsedCard | null {
  const fields = parseAnkiLine(line)
  const hasGuid = format?.hasGuid ?? true

  let guid: string
  let frontHtml: string
  let backHtml: string | undefined
  let tags: string | undefined
  let topic: string

  if (hasGuid) {
    // Format A: guid, notetype, deck, front, back, tags
    if (fields.length < 4) return null
    const [g, , deck, front, back, t] = fields
    if (!g || !front) return null
    guid = g
    frontHtml = front
    backHtml = back
    tags = t
    topic = deriveTopic(deck || '')
  } else {
    // Format B: front, back, tags...
    if (fields.length < 1) return null
    frontHtml = fields[0]
    backHtml = fields[1]
    // Tags column varies; get from the last non-empty field or tagsColumn
    const tagsCol = format?.tagsColumn
    if (tagsCol !== null && tagsCol !== undefined && tagsCol > 0 && fields.length > tagsCol - 1) {
      tags = fields[tagsCol - 1]
    }
    if (!frontHtml) return null
    // Generate deterministic guid from content hash
    guid = createHash('md5').update(frontHtml).digest('hex').slice(0, 12)
    topic = filenameTopic || ''
  }

  const clozes = parseCloze(frontHtml)
  const plainText = stripHtml(frontHtml + (backHtml ? ' ' + backHtml : ''))

  return {
    anki_guid: guid,
    topic,
    front_html: frontHtml,
    back_html: backHtml || null,
    cloze_deletions: clozes,
    plain_text: plainText,
    tags: tags ? tags.trim().split(/\s+/).filter(Boolean) : [],
  }
}

/**
 * Parse header lines to detect export format.
 */
function detectFormat(headerLines: string[]): FileFormat {
  let hasGuid = false
  let tagsColumn: number | null = null

  for (const line of headerLines) {
    if (line.startsWith('#guid column:')) hasGuid = true
    const tagsMatch = line.match(/^#tags column:(\d+)/)
    if (tagsMatch) tagsColumn = parseInt(tagsMatch[1], 10)
  }

  return { hasGuid, tagsColumn }
}

/**
 * Parse an entire Anki .txt export file content.
 * Supports both 6-column (guid) and 2-column (front/back) formats.
 * @param filenameTopic - topic derived from filename (e.g. "CVA" from "z CVA.txt")
 */
export function parseAnkiFile(content: string, filenameTopic?: string): ParsedCard[] {
  const lines = content.split('\n')
  const cards: ParsedCard[] = []

  // Collect header lines (start with #)
  const headerLines: string[] = []
  let dataStart = 0
  for (let i = 0; i < lines.length && i < 10; i++) {
    if (lines[i].startsWith('#')) {
      headerLines.push(lines[i])
      dataStart = i + 1
    } else {
      break
    }
  }

  const format = detectFormat(headerLines)

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const card = parseCardLine(line, format, filenameTopic)
    if (card) cards.push(card)
  }

  return cards
}
