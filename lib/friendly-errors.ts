// Sign-in service errors come back in the provider's own words, sometimes about its database.
// People only see one of these plain sentences; the original is logged on the server.

const KNOWN: [RegExp, string][] = [
  [/already (been )?registered|already exists/i, 'An account with this email already exists. Sign in instead.'],
  [/should be different from the old password/i, 'Your new password must be different from your current one.'],
  [/password should be at least|weak password/i, 'Please choose a longer, stronger password.'],
  [/invalid email|unable to validate email/i, 'Please check your email address.'],
  [/rate limit|too many requests|security purposes/i, 'Too many tries in a short time. Please wait a minute and try again.'],
  [/session|jwt|not authenticated|auth session missing/i, 'Your sign-in has expired. Please sign in again.'],
]

export function friendlyAuthError(raw: unknown, fallback: string): string {
  const text = raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : (raw as { message?: string } | null)?.message ?? ''
  for (const [pattern, message] of KNOWN) if (pattern.test(text)) return message
  if (text) console.error('[auth] error shown as a general message:', text)
  return fallback
}
