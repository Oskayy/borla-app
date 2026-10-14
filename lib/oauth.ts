// Sign in with another account (Google and others), through Supabase Auth.
// A provider shows on the sign-in and sign-up pages only once it is switched on in Supabase
// (Authentication → Providers) AND listed in NEXT_PUBLIC_OAUTH_PROVIDERS, e.g. "google" or "google,apple".

export type OAuthProviderId = 'google' | 'apple' | 'azure' | 'facebook'

export const OAUTH_LABELS: Record<OAuthProviderId, string> = {
  google: 'Google',
  apple: 'Apple',
  azure: 'Microsoft',
  facebook: 'Facebook',
}

export function enabledOAuthProviders(raw = process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? ''): OAuthProviderId[] {
  const known = Object.keys(OAUTH_LABELS) as OAuthProviderId[]
  const list = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is OAuthProviderId => known.includes(s as OAuthProviderId))
  return [...new Set(list)]
}

// Where the provider sends the person back: the existing link handler, then a page inside this site.
export function oauthRedirect(origin: string, next: string) {
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  return `${origin}/auth/confirm?next=${encodeURIComponent(safe)}`
}
