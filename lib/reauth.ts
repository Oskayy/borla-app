import { createClient } from '@supabase/supabase-js'
import { isRateLimited, recordAttempt } from '@/lib/rate-limit'

// Asks for the account password again before a sensitive change (e.g. the wallet earnings are paid to),
// so someone holding an unlocked phone can't make it. Uses a separate client that never touches the
// person's login cookies, and signs that extra session out straight away.
// Returns '' when the password is right, otherwise a message to show.
export async function confirmPassword(userId: string, email: string | undefined, password: unknown): Promise<string> {
  if (typeof password !== 'string' || !password || password.length > 128 || !email) {
    return 'Please enter your password to confirm this change'
  }
  if (await isRateLimited({ identifier: userId, action: 'reauth', maxAttempts: 5, windowMinutes: 15, onlyFailures: true })) {
    return 'Too many wrong passwords. Please wait 15 minutes and try again.'
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || data.user?.id !== userId) {
    await recordAttempt(userId, 'reauth', false)
    return 'That password is not correct'
  }
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  await recordAttempt(userId, 'reauth', true)
  return ''
}
