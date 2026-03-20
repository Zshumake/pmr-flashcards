#!/usr/bin/env npx tsx
/**
 * Extract images from Anki .apkg files and upload to Supabase Storage.
 *
 * Usage:
 *   npm install yauzl sharp file-type  # one-time install
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-media.ts [path-to-apkg-dir]
 *
 * Steps:
 * 1. Unzips each .apkg (they're ZIP files)
 * 2. Reads the `media` JSON file mapping numeric filenames to original names
 * 3. Validates each image by magic bytes (rejects SVGs)
 * 4. Re-encodes with sharp to strip EXIF/embedded payloads
 * 5. Uploads to Supabase Storage with SHA-256 content-addressed filenames
 * 6. Updates card front_html/back_html to rewrite <img src="..."> to Storage URLs
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
])

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const BUCKET_NAME = 'card-images'

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.find(b => b.name === BUCKET_NAME)) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
    })
    if (error) console.error('Failed to create bucket:', error.message)
    else console.log(`Created bucket: ${BUCKET_NAME}`)
  }
}

async function processApkg(filePath: string): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>() // original filename -> storage URL

  try {
    // Dynamic imports for optional dependencies
    const yauzl = await import('yauzl')
    const sharp = (await import('sharp')).default
    const { fileTypeFromBuffer } = await import('file-type')

    // Read the .apkg file
    const entries = await new Promise<Map<string, Buffer>>((resolvePromise, reject) => {
      const result = new Map<string, Buffer>()
      yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) return reject(err || new Error('No zipfile'))

        zipfile.readEntry()
        zipfile.on('entry', (entry) => {
          // Path traversal protection
          if (entry.fileName.includes('..') || entry.fileName.startsWith('/')) {
            zipfile.readEntry()
            return
          }

          zipfile.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr || !readStream) {
              zipfile.readEntry()
              return
            }

            const chunks: Buffer[] = []
            readStream.on('data', (chunk: Buffer) => chunks.push(chunk))
            readStream.on('end', () => {
              result.set(entry.fileName, Buffer.concat(chunks))
              zipfile.readEntry()
            })
          })
        })
        zipfile.on('end', () => resolvePromise(result))
        zipfile.on('error', reject)
      })
    })

    // Parse media mapping
    const mediaJson = entries.get('media')
    if (!mediaJson) {
      console.log(`  No media mapping found in ${filePath}`)
      return urlMap
    }

    const mediaMap: Record<string, string> = JSON.parse(mediaJson.toString('utf-8'))
    console.log(`  Found ${Object.keys(mediaMap).length} media files`)

    for (const [numericName, originalName] of Object.entries(mediaMap)) {
      const buffer = entries.get(numericName)
      if (!buffer) continue

      // Size check
      if (buffer.length > MAX_FILE_SIZE) {
        console.log(`  Skipping ${originalName} — exceeds 10MB limit`)
        continue
      }

      // Magic byte validation
      const type = await fileTypeFromBuffer(buffer)
      if (!type || !ALLOWED_MIMES.has(type.mime)) {
        console.log(`  Skipping ${originalName} — unsupported type: ${type?.mime || 'unknown'}`)
        continue
      }

      // Re-encode with sharp to strip EXIF and embedded payloads
      let processed: Buffer
      try {
        if (type.mime === 'image/gif') {
          // Sharp doesn't handle animated GIFs well, pass through after validation
          processed = buffer
        } else {
          processed = await sharp(buffer)
            .rotate() // auto-rotate based on EXIF before stripping
            .withMetadata({ orientation: undefined }) // strip EXIF
            .toBuffer()
        }
      } catch {
        console.log(`  Skipping ${originalName} — sharp processing failed`)
        continue
      }

      // Content-addressed filename
      const hash = sha256(processed)
      const ext = type.ext
      const storagePath = `${hash}.${ext}`

      // Upload
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, processed, {
          contentType: type.mime,
          upsert: true,
        })

      if (error) {
        console.log(`  Upload failed for ${originalName}: ${error.message}`)
        continue
      }

      // Get signed URL (1 year)
      const { data: signedData } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(storagePath, 365 * 24 * 60 * 60)

      if (signedData?.signedUrl) {
        urlMap.set(originalName, signedData.signedUrl)
      }
    }
  } catch (err) {
    console.error(`  Error processing ${filePath}:`, err)
  }

  return urlMap
}

async function rewriteCardImageUrls(urlMap: Map<string, string>) {
  if (urlMap.size === 0) return

  // Fetch all cards that have img tags
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, front_html, back_html')
    .or('front_html.like.%<img%,back_html.like.%<img%')

  if (error || !cards) {
    console.error('Failed to fetch cards for URL rewriting:', error?.message)
    return
  }

  let updated = 0
  for (const card of cards) {
    let frontHtml = card.front_html
    let backHtml = card.back_html
    let changed = false

    for (const [originalName, newUrl] of urlMap) {
      const pattern = `src="${originalName}"`
      const escapedPattern = `src=""${originalName}""`
      const replacement = `src="${newUrl}"`

      if (frontHtml?.includes(originalName)) {
        frontHtml = frontHtml.replaceAll(pattern, replacement).replaceAll(escapedPattern, replacement)
        changed = true
      }
      if (backHtml?.includes(originalName)) {
        backHtml = backHtml.replaceAll(pattern, replacement).replaceAll(escapedPattern, replacement)
        changed = true
      }
    }

    if (changed) {
      await supabase
        .from('cards')
        .update({ front_html: frontHtml, back_html: backHtml })
        .eq('id', card.id)
      updated++
    }
  }

  console.log(`  Updated image URLs in ${updated} cards`)
}

async function main() {
  const dir = resolve(process.argv[2] || join(__dirname, '..', '..'))
  console.log(`Looking for .apkg files in: ${dir}`)

  const files = readdirSync(dir)
    .filter(f => f.startsWith('z ') && f.endsWith('.apkg'))
    .sort()

  if (files.length === 0) {
    console.log('No .apkg files found — skipping image import')
    return
  }

  console.log(`Found ${files.length} .apkg files\n`)

  await ensureBucket()

  const allUrlMaps = new Map<string, string>()

  for (const file of files) {
    console.log(`Processing: ${file}`)
    const urlMap = await processApkg(join(dir, file))
    for (const [k, v] of urlMap) allUrlMaps.set(k, v)
    console.log(`  → ${urlMap.size} images uploaded`)
  }

  console.log(`\nRewriting image URLs in cards...`)
  await rewriteCardImageUrls(allUrlMaps)
  console.log(`Done! ${allUrlMaps.size} total images processed`)
}

main().catch(console.error)
