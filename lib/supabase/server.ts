import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Server Components cannot set cookies — this is expected to throw
            try {
              cookieStore.set(name, value, options)
            } catch {
              // Ignored in Server Components; works in Server Actions and Route Handlers
            }
          })
        },
      },
    }
  )
}
