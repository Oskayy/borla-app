'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { enabledOAuthProviders, OAUTH_LABELS, oauthRedirect, type OAuthProviderId } from '@/lib/oauth'

function ProviderIcon({ id }: { id: OAuthProviderId }) {
  if (id === 'google')
    return (
      <svg aria-hidden viewBox="0 0 24 24" className="size-5">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9z" />
      </svg>
    )
  if (id === 'apple')
    return (
      <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 5.1c.7-.9 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z" />
      </svg>
    )
  if (id === 'azure')
    return (
      <svg aria-hidden viewBox="0 0 24 24" className="size-5">
        <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
        <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
        <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
        <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
      </svg>
    )
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5">
      <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" />
    </svg>
  )
}

// "Continue with Google" (and any other provider switched on), above the email form, with an "or" line under it.
// `next` is where to go after signing in: /dashboard for sign-in, the finish-your-account page for sign-up.
export default function SocialSignIn({ next, verb = 'Continue' }: { next: string; verb?: string }) {
  const providers = enabledOAuthProviders()
  const [busy, setBusy] = useState<OAuthProviderId | null>(null)
  const [error, setError] = useState('')
  if (providers.length === 0) return null

  async function go(provider: OAuthProviderId) {
    setError('')
    setBusy(provider)
    const { error: e } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: oauthRedirect(window.location.origin, next) },
    })
    // On success the browser is already leaving for the provider.
    if (e) {
      setBusy(null)
      setError(`${OAUTH_LABELS[provider]} sign-in isn't available right now. Please use your email instead.`)
    }
  }

  return (
    <div className="mt-6 grid gap-2.5">
      {providers.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => go(p)}
          disabled={busy !== null}
          className="press inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-surface text-[15px] font-semibold text-ink ring-1 ring-line-strong transition hover:bg-canvas disabled:cursor-wait disabled:opacity-70"
        >
          <ProviderIcon id={p} />
          {busy === p ? `Opening ${OAUTH_LABELS[p]}…` : `${verb} with ${OAUTH_LABELS[p]}`}
        </button>
      ))}
      <p role="alert" className={error ? 'text-sm text-danger' : 'sr-only'}>
        {error}
      </p>
      <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-ink-3" aria-hidden>
        <span className="h-px flex-1 bg-line" /> or with your email <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  )
}
