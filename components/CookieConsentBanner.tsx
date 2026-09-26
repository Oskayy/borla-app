'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'borla_cookie_consent'

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (!existing) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
  }

  function acceptEssentialOnly() {
    localStorage.setItem(STORAGE_KEY, 'essential-only')
    setVisible(false)
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
        We use strictly necessary cookies to keep you logged in, and (with your consent) optional
        cookies to help us improve the platform. See our{' '}
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