'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useClientValue } from '@/lib/use-client-value'

const STORAGE_KEY = 'borla_cookie_consent'

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

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setChosen(true)
  }

  function acceptEssentialOnly() {
    localStorage.setItem(STORAGE_KEY, 'essential-only')
    setChosen(true)
  }

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#0F3D3E',
        color: '#fff',
        padding: '16px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 16,
        zIndex: 1000,
      }}
    >
      <p style={{ fontSize: 13, margin: 0, flex: '1 1 260px' }}>
        We only use cookies to keep you signed in and to remember your choices. No tracking or ads. See our{' '}
        <Link href="/cookie-policy" style={{ color: '#E8A33D', textDecoration: 'underline' }}>
          Cookie Policy
        </Link>{' '}
        for details.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={acceptEssentialOnly}
          style={{ background: 'none', border: '1px solid #fff', color: '#fff', borderRadius: 4, padding: '8px 14px', fontSize: 13 }}
        >
          Essential only
        </button>
        <button
          onClick={accept}
          className="btn-accent"
          style={{ padding: '8px 14px', fontSize: 13 }}
        >
          Accept all
        </button>
      </div>
    </div>
  )
}