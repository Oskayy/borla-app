import { createClient } from '@supabase/supabase-js'

// Admin client — bypasses Row Level Security and can manage any user.
// NEVER import this in client components or expose this key to the browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}