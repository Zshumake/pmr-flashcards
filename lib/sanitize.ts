import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'b', 'i', 'u', 'em', 'strong', 'sub', 'sup',
  'div', 'span', 'p', 'br', 'hr',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'ul', 'ol', 'li',
  'img', 'font', 'ruby', 'rt',
]

const ALLOWED_ATTR = [
  'style', 'class', 'src', 'alt', 'width', 'height',
  'color', 'size', 'face', 'colspan', 'rowspan',
]

export function sanitizeCardHtml(dirty: string, supabaseDomain?: string): string {
  // Strip dangerous CSS patterns
  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName === 'style') {
      data.attrValue = data.attrValue
        .replace(/expression\s*\(/gi, '')
        .replace(/url\s*\(/gi, '')
        .replace(/-moz-binding/gi, '')
        .replace(/behavior\s*:/gi, '')
    }
  })

  // Restrict img src to Supabase domain
  if (supabaseDomain) {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'IMG') {
        const src = node.getAttribute('src') || ''
        if (src && !src.includes(supabaseDomain)) {
          node.removeAttribute('src')
        }
      }
    })
  }

  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })

  DOMPurify.removeAllHooks()
  return clean
}
