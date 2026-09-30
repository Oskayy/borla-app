'use client'

import { useEffect, useState } from 'react'

// Offers to install Borla on the home screen. Android/Chrome gets an Install button; iPhone gets the
// Share -> Add to Home Screen steps (iPhones only allow alerts for apps added this way).
export default function InstallPrompt() {
  const [mode, setMode] = useState<'hidden' | 'android' | 'ios'>('hidden')
  const [deferred, setDeferred] = useState<any>(null)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
    if (standalone) return
    let dismissed = false
    try {
      dismissed = localStorage.getItem('borla-install-dismissed') === '1'
    } catch {
      // storage unavailable
    }
    if (dismissed) return

    const ua = navigator.userAgent
    const isIos = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua)
    if (isIos) setMode('ios')

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e)
      setMode('android')
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  function dismiss() {
    setMode('hidden')
    try {
      localStorage.setItem('borla-install-dismissed', '1')
    } catch {
      // storage unavailable
    }
  }

  async function install() {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice.catch(() => null)
    setDeferred(null)
    setMode('hidden')
  }

  if (mode === 'hidden') return null
  return (
    <div className="panel" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 8 }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 600, fontSize: 14 }}>Install Borla on your phone</p>
        {mode === 'android' ? (
          <>
            <p style={{ fontSize: 13, color: '#444', marginBottom: 8 }}>Opens straight from your home screen, full screen, with alerts.</p>
            <button onClick={install} className="btn-accent">
              Install
            </button>
          </>
        ) : (
          <p style={{ fontSize: 13, color: '#444' }}>
            Tap the Share button <span aria-hidden>⬆️</span> in Safari, then <strong>Add to Home Screen</strong>. Open Borla from the new
            icon to turn on alerts.
          </p>
        )}
      </div>
      <button onClick={dismiss} aria-label="Dismiss" style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666' }}>
        ×
      </button>
    </div>
  )
}
