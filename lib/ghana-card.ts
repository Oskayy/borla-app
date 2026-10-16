// Ghana Card (national ID) numbers: GHA-123456789-0. Drivers type the number; no photo of the card is kept.
// People type it in many ways (spaces, no dashes, lower case), so it is tidied before checking.

const PATTERN = /^GHA(\d{9})(\d)$/

// Returns the number as GHA-123456789-0, or null when it isn't a Ghana Card number.
export function parseGhanaCard(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const compact = input.toUpperCase().replace(/[\s-]/g, '')
  const m = PATTERN.exec(compact)
  return m ? `GHA-${m[1]}-${m[2]}` : null
}

// Shapes the number while it is typed, like the example: "gha6788" becomes "GHA-6788", ten digits become
// "GHA-123456789-0". Typing only digits adds the GHA. Part of "GHA" is left alone so backspace still works.
export function formatGhanaCardTyping(input: string): string {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (s === '' || 'GHA'.startsWith(s)) return s
  const digits = s.replace(/^[A-Z]*/, '').replace(/D/g, '').slice(0, 10)
  if (!digits) return 'GHA'
  return 'GHA-' + digits.slice(0, 9) + (digits.length > 9 ? '-' + digits.slice(9) : '')
}

// For screens that don't need the whole number: GHA-•••••6789-0.
export function maskGhanaCard(n: string | null): string | null {
  const p = n ? parseGhanaCard(n) : null
  return p ? `GHA-•••••${p.slice(9, 13)}-${p.slice(-1)}` : null
}

// Vehicle number plates: letters, digits, spaces and dashes (e.g. GT 1234-24, M-24-GR 5678). Stored in capitals.
export function parsePlate(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const p = input.trim().toUpperCase().replace(/\s+/g, ' ')
  return /^[A-Z0-9][A-Z0-9 -]{2,18}[A-Z0-9]$/.test(p) && /\d/.test(p) ? p : null
}
