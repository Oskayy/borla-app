'use client'

import { useEffect, useState } from 'react'
import { Share, X } from 'lucide-react'
import { useClientValue } from '@/lib/use-client-value'

// Chrome's install event (not in the standard DOM types).
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> }

// False when already installed, or when the person said "not now" before.
function canOffer(): boolean {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (standalone) return false
  try {
    return localStorage.getItem('trashit-install-dismissed') !== '1'
  } catch {
    return true // storage unavailable
  }
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua)
}

// Offers to install Trashit on the home screen. Android/Chrome gets an Install button; iPhone gets the
// Share -> Add to Home Screen steps (iPhones only allow alerts for apps added this way).
export default function InstallPrompt() {
  const offer = useClientValue(canOffer, false)
  const ios = useClientValue(isIosSafari, false)
  const [deferred, setDeferred] = useState<InstallEvent | null>(null)
  const [closed, setClosed] = useState(false)
  const mode: 'hidden' | 'android' | 'ios' = closed || !offer ? 'hidden' : deferred ? 'android' : ios ? 'ios' : 'hidden'

  useEffect(() => {
    if (!offer) return
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as InstallEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [offer])

  function dismiss() {
    setClosed(true)
    try {
      localStorage.setItem('trashit-install-dismissed', '1')
    } catch {
      // storage unavailable
    }
  }

  async function install() {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice.catch(() => null)
    setDeferred(null)
    setClosed(true)
  }

  if (mode === 'hidden') return null
  return (
    <div className="flex items-start gap-3.5 rounded-card bg-surface p-4 ring-1 ring-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={40} height={40} className="size-10 rounded-[10px]" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Install Trashit on your phone</p>
        {mode === 'android' ? (
          <>
            <p className="mt-0.5 text-sm text-ink-2">Opens straight from your home screen, full screen, with alerts.</p>
            <button
              onClick={install}
              className="mt-3 inline-flex min-h-11 items-center rounded-control bg-customer px-4 text-[15px] font-semibold text-white transition hover:bg-customer-deep"
            >
              Install
            </button>
          </>
        ) : (
          <p className="mt-0.5 text-sm text-ink-2">
            Tap the Share button <Share aria-label="Share" className="inline size-4 align-text-bottom" /> in Safari, then{' '}
            <strong className="font-semibold text-ink">Add to Home Screen</strong>. Open Trashit from the new icon to turn on alerts.
          </p>
        )}
      </div>
      <button onClick={dismiss} aria-label="Dismiss" className="grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-canvas">
        <X aria-hidden className="size-4" />
      </button>
    </div>
  )
}
