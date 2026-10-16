'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { Moon, Sun } from 'lucide-react'
import { appForPath, LEGACY_THEME_KEY, themeKey, type Theme, type ThemeApp } from '@/lib/theme'

// Light or dark is chosen per app (website, customer, driver, ops) and, when signed in, saved on the account
// (lib/theme.ts). The first paint is set by the script in app/layout.tsx.

function stored(app: ThemeApp): Theme {
  try {
    const t = localStorage.getItem(themeKey(app)) ?? localStorage.getItem(LEGACY_THEME_KEY)
    return t === 'dark' ? 'dark' : 'light'
  } catch {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  }
}

function apply(app: ThemeApp, theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(themeKey(app), theme)
  } catch {
    // private mode: the choice lasts until the page closes
  }
}

function toggleTheme(app: ThemeApp) {
  const next: Theme = current() === 'dark' ? 'light' : 'dark'
  apply(app, next)
  // Signed in to an app: keep the choice on the account too. Visitors to the website have no account.
  if (app !== 'site') {
    fetch('/api/account/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app, theme: next }),
      keepalive: true,
    }).catch(() => {})
  }
}

function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => obs.disconnect()
}
const current = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

// Switches light and dark mode for the app on screen.
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const app = appForPath(usePathname())
  const theme = useSyncExternalStore(subscribe, current, () => null) // null until the browser knows

  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={() => toggleTheme(app)}
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
  const app = appForPath(usePathname())
  const theme = useSyncExternalStore(subscribe, current, () => null)
  const dark = theme === 'dark'
  return (
    <button type="button" role="switch" aria-checked={dark} onClick={() => toggleTheme(app)} className="flex min-h-16 w-full items-center gap-3.5 px-4 text-left hover:bg-canvas">
      <Moon aria-hidden className="size-5 shrink-0 text-action-deep" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Dark mode</span>
        <span className="block text-sm text-ink-3">Easier on the eyes at night. For this app, on any device you sign in on.</span>
      </span>
      <span aria-hidden className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200 ${dark ? 'bg-action-strong' : 'bg-line-strong'}`}>
        <span className={`absolute top-1 size-6 rounded-full bg-white shadow-card transition-transform duration-200 ease-[var(--ease-spring)] ${dark ? 'translate-x-[24px]' : 'translate-x-1'}`} />
      </span>
    </button>
  )
}

// In the root layout: moving between apps without a full page load (e.g. signing in from the website) switches to
// that app's own choice.
export function ThemeByApp() {
  const pathname = usePathname()
  useEffect(() => {
    const t = stored(appForPath(pathname))
    if (document.documentElement.dataset.theme !== t) document.documentElement.dataset.theme = t
  }, [pathname])
  return null
}

// In each signed-in app's layout: the choice saved on the account wins on a new device.
export function AccountTheme({ app, saved }: { app: ThemeApp; saved: Theme | null }) {
  useEffect(() => {
    if (saved && stored(app) !== saved) apply(app, saved)
  }, [app, saved])
  return null
}
