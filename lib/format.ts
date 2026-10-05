// Dates shown to people, always in Ghana time.

export const TZ = 'Africa/Accra'

// e.g. "Sun, 5 Oct" (outside components so render stays pure).
export function todayLabel(): string {
  return new Date().toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
}

export function dateLabel(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' })
}

export function dateTimeLabel(d: Date | string): string {
  return new Date(d).toLocaleString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
}

// Morning / afternoon / evening greeting for the current Accra hour.
export function greeting(): string {
  const h = Number(new Date().toLocaleString('en-GB', { timeZone: TZ, hour: 'numeric', hour12: false }))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}
