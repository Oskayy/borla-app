'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'

const KEY = 'trashit-theme'

function toggleTheme() {
  const next = current() === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // private mode: the choice lasts until the page closes
  }
}

function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => obs.disconnect()
}
const current = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

// Switches light and dark mode for this device. The choice is remembered on this device only.
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, current, () => null) // null until the browser knows

  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`press grid size-11 place-items-center rounded-full text-ink-2 ring-1 ring-line transition hover:bg-canvas hover:text-ink ${className}`}
    >
      {dark ? <Sun aria-hidden className="size-5" /> : <Moon aria-hidden className="size-5" />}
    </button>
  )
}

// The same choice as a labelled on/off row, for account pages.
export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribe, current, () => null)
  const dark = theme === 'dark'
  return (
    <button type="button" role="switch" aria-checked={dark} onClick={toggleTheme} className="flex min-h-16 w-full items-center gap-3.5 px-4 text-left hover:bg-canvas">
      <Moon aria-hidden className="size-5 shrink-0 text-action-deep" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Dark mode</span>
        <span className="block text-sm text-ink-3">Easier on the eyes at night. On this device only.</span>
      </span>
      <span aria-hidden className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200 ${dark ? 'bg-action-strong' : 'bg-line-strong'}`}>
        <span className={`absolute top-1 size-6 rounded-full bg-white shadow-card transition-transform duration-200 ease-[var(--ease-spring)] ${dark ? 'translate-x-[24px]' : 'translate-x-1'}`} />
      </span>
    </button>
  )
}
