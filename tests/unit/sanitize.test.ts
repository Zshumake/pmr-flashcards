import { describe, it, expect } from 'vitest'
import { sanitizeCardHtml } from '@/lib/sanitize'

describe('sanitizeCardHtml', () => {
  it('allows safe tags', () => {
    const html = '<b>bold</b> <i>italic</i> <div>block</div>'
    const result = sanitizeCardHtml(html)
    expect(result).toContain('<b>')
    expect(result).toContain('<i>')
  })

  it('strips script tags', () => {
    const html = '<script>alert("xss")</script><b>safe</b>'
    const result = sanitizeCardHtml(html)
    expect(result).not.toContain('<script>')
    expect(result).toContain('<b>safe</b>')
  })

  it('strips iframe tags', () => {
    const html = '<iframe src="evil.com"></iframe>'
    expect(sanitizeCardHtml(html)).not.toContain('<iframe>')
  })

  it('allows img with valid src', () => {
    const html = '<img src="https://test.supabase.co/storage/v1/img.png" alt="test">'
    const result = sanitizeCardHtml(html, 'test.supabase.co')
    expect(result).toContain('img')
    expect(result).toContain('test.supabase.co')
  })

  it('strips img with external src', () => {
    const html = '<img src="https://evil.com/track.png">'
    const result = sanitizeCardHtml(html, 'test.supabase.co')
    expect(result).not.toContain('evil.com')
  })

  it('allows table elements', () => {
    const html = '<table><tr><td>cell</td></tr></table>'
    expect(sanitizeCardHtml(html)).toContain('<table>')
  })

  it('strips onclick attributes', () => {
    const html = '<div onclick="alert(1)">click</div>'
    expect(sanitizeCardHtml(html)).not.toContain('onclick')
  })

  it('strips CSS expression attacks', () => {
    const html = '<div style="background: expression(alert(1))">test</div>'
    const result = sanitizeCardHtml(html)
    expect(result).not.toContain('expression')
  })

  it('strips CSS url() in styles', () => {
    const html = '<div style="background: url(javascript:alert(1))">test</div>'
    const result = sanitizeCardHtml(html)
    expect(result).not.toContain('url(')
  })

  it('blocks data URI in img src', () => {
    const html = '<img src="data:text/html,<script>alert(1)</script>">'
    const result = sanitizeCardHtml(html, 'test.supabase.co')
    expect(result).not.toContain('data:')
  })
})
