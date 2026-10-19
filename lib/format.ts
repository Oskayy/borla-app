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
// The name to greet someone by: their first real name, skipping titles ("Mr", "Dr") and placeholder words an account
// may have been made with ("Customer", "Driver", "Test"). Empty when nothing usable is left.
const NOT_A_NAME = new Set(['mr', 'mrs', 'ms', 'miss', 'mx', 'dr', 'rev', 'prof', 'hon', 'sir', 'madam', 'customer', 'driver', 'user', 'test', 'tester', 'demo', 'trashit', 'borla'])
export function firstNameOf(name: string | null | undefined): string {
  const word = (name ?? '')
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[.,]+$/, ''))
    .find((w) => w && !NOT_A_NAME.has(w.toLowerCase()) && !/^\d+$/.test(w))
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : ''
}

// "Good evening, Ama", or just "Good evening" when there is no name to use.
export function greetingFor(name: string | null | undefined): string {
  const first = firstNameOf(name)
  return first ? `${greeting()}, ${first}` : greeting()
}

export function greeting(): string {
  const h = Number(new Date().toLocaleString('en-GB', { timeZone: TZ, hour: 'numeric', hour12: false }))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}
