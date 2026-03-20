export interface ClozeDeletion {
  index: number
  answer: string
  hint: string | null
}

const CLOZE_REGEX = /\{\{c(\d+)::(.*?)(?:::(.+?))?\}\}/g

export function parseCloze(text: string): ClozeDeletion[] {
  const results: ClozeDeletion[] = []
  let match: RegExpExecArray | null
  const regex = new RegExp(CLOZE_REGEX)
  while ((match = regex.exec(text)) !== null) {
    results.push({
      index: parseInt(match[1], 10),
      answer: match[2],
      hint: match[3] ?? null,
    })
  }
  return results
}

export function stripHtml(html: string): string {
  if (!html) return ''
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const textarea =
    typeof document !== 'undefined' ? document.createElement('textarea') : null
  if (textarea) {
    textarea.innerHTML = text
    return textarea.value
  }
  // Server-side fallback: decode common HTML entities manually
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

export function renderClozeFront(
  html: string,
  clozes: ClozeDeletion[],
  activeIndex: number
): string {
  let result = html
  for (const cloze of clozes) {
    const pattern = `{{c${cloze.index}::${cloze.answer}${cloze.hint ? '::' + cloze.hint : ''}}}`
    if (cloze.index === activeIndex) {
      const hint = cloze.hint ? ` (${cloze.hint})` : ''
      result = result.replaceAll(
        pattern,
        `<span class="cloze-blank">[...]${hint}</span>`
      )
    } else {
      result = result.replaceAll(pattern, cloze.answer)
    }
  }
  return result
}

export function renderClozeBack(
  html: string,
  clozes: ClozeDeletion[],
  activeIndex: number
): string {
  let result = html
  for (const cloze of clozes) {
    const pattern = `{{c${cloze.index}::${cloze.answer}${cloze.hint ? '::' + cloze.hint : ''}}}`
    if (cloze.index === activeIndex) {
      result = result.replaceAll(
        pattern,
        `<span class="cloze-answer">${cloze.answer}</span>`
      )
    } else {
      result = result.replaceAll(pattern, cloze.answer)
    }
  }
  return result
}

export function generateDistractors(
  correctAnswer: string,
  sameTopicAnswers: string[],
  count: number = 3
): string[] {
  const candidates = sameTopicAnswers.filter(
    (a) => a !== correctAnswer && a.length > 0
  )
  const len = correctAnswer.length
  const similar = candidates.filter(
    (a) => a.length >= len / 2 && a.length <= len * 2
  )
  const pool = similar.length >= count ? similar : candidates
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}
