#!/usr/bin/env npx tsx
/**
 * Import Anki .txt exports into Supabase.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-cards.ts [path-to-txt-files-dir]
 *
 * Defaults to the parent directory (../z *.txt files).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { basename, join, resolve } from 'path'
import { deriveTopic, parseAnkiFile } from '../lib/import-parser'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const BATCH_SIZE = 100

async function importFile(filePath: string): Promise<number> {
  const content = readFileSync(filePath, 'utf-8')
  // Derive topic from filename: "z CVA.txt" -> "CVA"
  const filename = basename(filePath, '.txt')
  const filenameTopic = deriveTopic(filename)
  const cards = parseAnkiFile(content, filenameTopic)

  if (cards.length === 0) {
    console.log(`  Skipping ${filePath} — no cards found`)
    return 0
  }

  // Deduplicate by anki_guid (Format B generates MD5-based guids that may collide)
  const seen = new Set<string>()
  const uniqueCards = cards.filter(card => {
    if (seen.has(card.anki_guid)) return false
    seen.add(card.anki_guid)
    return true
  })

  let imported = 0

  for (let i = 0; i < uniqueCards.length; i += BATCH_SIZE) {
    const batch = uniqueCards.slice(i, i + BATCH_SIZE).map(card => ({
      anki_guid: card.anki_guid,
      topic: card.topic,
      front_html: card.front_html,
      back_html: card.back_html,
      cloze_deletions: card.cloze_deletions,
      plain_text: card.plain_text,
      tags: card.tags,
    }))

    const { error, count } = await supabase
      .from('cards')
      .upsert(batch, {
        onConflict: 'anki_guid',
        ignoreDuplicates: false,
      })

    if (error) {
      console.error(`  Error importing batch at offset ${i}:`, error.message)
    } else {
      imported += batch.length
    }
  }

  return imported
}

async function main() {
  const dir = resolve(process.argv[2] || join(__dirname, '..', '..'))
  console.log(`Looking for .txt files in: ${dir}`)

  const files = readdirSync(dir)
    .filter(f => f.startsWith('z ') && f.endsWith('.txt'))
    .sort()

  if (files.length === 0) {
    console.error('No "z *.txt" files found in directory')
    process.exit(1)
  }

  console.log(`Found ${files.length} files to import\n`)

  let totalCards = 0

  for (const file of files) {
    const filePath = join(dir, file)
    console.log(`Importing: ${file}`)
    const count = await importFile(filePath)
    console.log(`  → ${count} cards`)
    totalCards += count
  }

  console.log(`\nTotal: ${totalCards} cards imported`)

  // Run ANALYZE for query planner after bulk import
  const { error } = await supabase.rpc('exec_sql', {
    sql: 'ANALYZE cards; ANALYZE user_progress; ANALYZE review_log;',
  })
  if (error) {
    console.log('Note: ANALYZE via RPC not available — run manually in Supabase SQL editor')
  }
}

main().catch(console.error)
