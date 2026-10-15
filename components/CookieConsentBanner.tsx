'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Cookie } from 'lucide-react'
import { useClientValue } from '@/lib/use-client-value'

const STORAGE_KEY = 'borla_cookie_consent'

// A small card that floats at the bottom until a choice is saved (bottom left on a computer).
export default function CookieConsentBanner() {
  // Hidden on the server; shown in the browser until a choice is saved.
  const saved = useClientValue(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null
    } catch {
      return false
    }
  }, true)
  const [chosen, setChosen] = useState(false)
  const visible = !saved && !chosen

  function choose(value: 'accepted' | 'essential-only') {
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // private mode: the choice lasts until the page closes
    }
    setChosen(true)
  }

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Cookies"
      className="anim-note fixed inset-x-3 bottom-3 z-[60] flex flex-col gap-4 rounded-[24px] bg-hero p-5 text-on-hero shadow-lift ring-1 ring-white/10 sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-md"
    >
      <p className="flex items-start gap-3 text-sm leading-relaxed text-on-hero-2">
        <Cookie aria-hidden className="mt-0.5 size-5 shrink-0 text-highlight" />
        <span>
          We only use cookies to keep you signed in and to remember your choices. No tracking or ads. See our{' '}
          <Link href="/cookie-policy" className="font-semibold text-on-hero underline underline-offset-2">
            Cookie Policy
          </Link>{' '}
          for details.
        </span>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => choose('essential-only')}
          className="press min-h-11 flex-1 rounded-full px-4 text-sm font-semibold text-on-hero ring-1 ring-white/30 hover:bg-white/10"
        >
          Essential only
        </button>
        <button type="button" onClick={() => choose('accepted')} className="press min-h-11 flex-1 rounded-full bg-highlight px-4 text-sm font-bold text-on-highlight">
          Accept all
        </button>
      </div>
    </div>
  )
}
