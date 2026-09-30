// Ghana phone numbers. Pure functions so they can be tested.

// "024 412 3456", "+233 24 412 3456", "233244123456" -> "233244123456". Returns null if it isn't a Ghana mobile number.
export function normalizeGhanaPhone(input: unknown): string | null {
  if (typeof input !== 'string') return null
  let d = input.replace(/[^\d+]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  if (d.startsWith('00233')) d = d.slice(2)
  if (d.startsWith('0') && d.length === 10) d = '233' + d.slice(1)
  if (/^233[235]\d{8}$/.test(d)) return d
  return null
}

// "233244123456" -> "0244123456" (the form Ghanaians type, and what Paystack expects for mobile money).
export function localGhanaPhone(normalized: string): string {
  return normalized.startsWith('233') ? '0' + normalized.slice(3) : normalized
}

// Paystack's Ghana mobile money providers.
export const MOMO_PROVIDERS: { code: string; name: string }[] = [
  { code: 'MTN', name: 'MTN MoMo' },
  { code: 'VOD', name: 'Telecel Cash (Vodafone)' },
  { code: 'ATL', name: 'AirtelTigo Money' },
]

export function isMomoProvider(code: unknown): code is string {
  return typeof code === 'string' && MOMO_PROVIDERS.some((p) => p.code === code)
}
