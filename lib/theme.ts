// Light or dark, chosen separately for each part of Trashit: the website, the customer app, the driver app and the ops
// console. On a device each choice lives under its own key (e.g. "trashit-theme:driver"); for someone signed in it is
// also saved on their account (User.themePrefs) so it follows them to other devices, and another person using the
// same phone keeps their own.

export type ThemeApp = 'site' | 'customer' | 'driver' | 'ops'
export type Theme = 'light' | 'dark'
export type ThemePrefs = Partial<Record<ThemeApp, Theme>>

export const THEME_APPS: ThemeApp[] = ['site', 'customer', 'driver', 'ops']
export const LEGACY_THEME_KEY = 'trashit-theme' // one choice for everything, before 16 Oct 2026; read as a fallback
export const themeKey = (app: ThemeApp) => `trashit-theme:${app}`

export function appForPath(pathname: string): ThemeApp {
  if (pathname.startsWith('/dashboard/customer')) return 'customer'
  if (pathname.startsWith('/dashboard/driver')) return 'driver'
  if (pathname.startsWith('/ops') || pathname.startsWith('/account') || pathname.startsWith('/security')) return 'ops'
  return 'site'
}

export function parseThemePrefs(value: unknown): ThemePrefs {
  const out: ThemePrefs = {}
  if (!value || typeof value !== 'object') return out
  for (const app of THEME_APPS) {
    const t = (value as Record<string, unknown>)[app]
    if (t === 'light' || t === 'dark') out[app] = t
  }
  return out
}

// Runs before the page paints (app/layout.tsx), so a page never flashes the wrong theme. Mirrors appForPath.
export const THEME_SCRIPT =
  "try{var p=location.pathname,a=p.indexOf('/dashboard/customer')===0?'customer':p.indexOf('/dashboard/driver')===0?'driver':" +
  "(p.indexOf('/ops')===0||p.indexOf('/account')===0||p.indexOf('/security')===0)?'ops':'site';" +
  "var t=localStorage.getItem('trashit-theme:'+a)||localStorage.getItem('trashit-theme');if(t!=='dark')t='light';" +
  'document.documentElement.dataset.theme=t}catch(e){}'
