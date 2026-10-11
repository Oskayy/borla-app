// A pickup someone priced before they had an account. Kept on this device (for a day) so that after signing up
// or signing in, the booking form opens with the same bins and pin and they don't start again.
// Browser only; nothing here is sent anywhere until they book.

const KEY = 'trashit-booking-draft'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

export interface BookingDraft {
  address: string
  pin: { lat: number; lng: number } | null
  wasteType: string
  hazardous: boolean
  bins: Record<string, number>
  resumed: boolean // already taken back to the booking form once after signing in
}

// The stored text (a string, so it can be read with useClientValue).
export function draftRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function parseDraft(raw: string): BookingDraft | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw)
    if (typeof d?.savedAt !== 'number' || Date.now() - d.savedAt > MAX_AGE_MS) return null
    if (typeof d.address !== 'string' || typeof d.wasteType !== 'string' || typeof d.bins !== 'object' || !d.bins) return null
    const pin = d.pin && typeof d.pin.lat === 'number' && typeof d.pin.lng === 'number' ? { lat: d.pin.lat, lng: d.pin.lng } : null
    const bins: Record<string, number> = {}
    for (const [k, v] of Object.entries(d.bins)) if (typeof v === 'number' && v > 0) bins[k] = Math.min(20, Math.floor(v))
    return { address: d.address.slice(0, 200), pin, wasteType: d.wasteType, hazardous: d.hazardous === true, bins, resumed: d.resumed === true }
  } catch {
    return null
  }
}

export function saveDraft(d: Omit<BookingDraft, 'resumed'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...d, savedAt: Date.now() }))
  } catch {
    // Private mode or storage off: they'll pick their bins again after signing up.
  }
}

// Remember that the person was taken back to the booking form, so it only happens once.
export function markResumed(): void {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) localStorage.setItem(KEY, JSON.stringify({ ...JSON.parse(raw), resumed: true }))
  } catch {
    // ignore
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing to clear
  }
}
