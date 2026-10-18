// Small numbers for the ops console's charts. Pure functions (no database), so they can be unit-tested.

const DAY = 86_400_000

// Average stars per driver for each of the last `weeks` weeks (oldest first). A week with no ratings is skipped,
// so a trend line only joins weeks that had ratings.
export function weeklyAverages(ratings: { driverId: string; stars: number; createdAt: Date }[], now: Date, weeks = 5): Map<string, number[]> {
  const start = now.getTime() - weeks * 7 * DAY
  const sums = new Map<string, { sum: number; n: number }[]>()
  for (const r of ratings) {
    const t = r.createdAt.getTime()
    if (t < start || t > now.getTime()) continue
    const w = Math.min(weeks - 1, Math.floor((t - start) / (7 * DAY)))
    const row = sums.get(r.driverId) ?? Array.from({ length: weeks }, () => ({ sum: 0, n: 0 }))
    row[w].sum += r.stars
    row[w].n += 1
    sums.set(r.driverId, row)
  }
  const out = new Map<string, number[]>()
  for (const [id, row] of sums) out.set(id, row.filter((b) => b.n > 0).map((b) => Math.round((b.sum / b.n) * 10) / 10))
  return out
}

// Counts per week for the last `weeks` weeks, oldest first, labelled "Wk 1" … (e.g. missed stops).
export function weeklyCounts(dates: Date[], now: Date, weeks = 4): { label: string; value: number }[] {
  const start = now.getTime() - weeks * 7 * DAY
  const counts = Array(weeks).fill(0) as number[]
  for (const d of dates) {
    const t = d.getTime()
    if (t < start || t > now.getTime()) continue
    counts[Math.min(weeks - 1, Math.floor((t - start) / (7 * DAY)))]++
  }
  return counts.map((value, i) => ({ label: i === weeks - 1 ? 'This wk' : `${weeks - 1 - i} wk ago`, value }))
}

// How many ratings of each star value (5 down to 1).
export function starSpread(stars: number[]): { stars: number; count: number }[] {
  return [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: stars.filter((x) => x === s).length }))
}

// "0244 123 456" → "024 •••• 456": enough to recognise a customer without showing the whole number.
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  const local = digits.startsWith('233') ? `0${digits.slice(3)}` : digits
  if (local.length < 7) return '•••'
  return `${local.slice(0, 3)} •••• ${local.slice(-3)}`
}
