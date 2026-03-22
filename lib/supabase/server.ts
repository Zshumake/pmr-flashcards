import { createClient } from '@supabase/supabase-js'

// Single-user mode: uses service role key to bypass RLS.
// When multi-user auth is re-enabled, switch back to createServerClient
// from @supabase/ssr with cookie-based auth (see git history).
export async function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
