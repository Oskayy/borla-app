// Outside data for the driver's Home tips: tonight's weather (Open-Meteo) and nearby fuel stations
// (OpenStreetMap, through the Overpass API). Both are free and need no key. We only ever send an area's
// position (the zone centre, or a rounded point), never a driver's exact home pin, and nothing that names anyone.
// Answers are cached, and a slow or failing service just leaves the tip out.
import { addDays, formatClock, type ShiftSettings } from '@/lib/shift'

export interface NightWeather {
  minC: number
  maxC: number
  rainChance: number // the highest chance of rain in any hour of the shift, 0-100
  rainFrom: string | null // e.g. "1:00am", the first hour with a 50%+ chance of rain
}

export interface FuelStation {
  name: string
  lat: number
  lng: number
  km: number
}

// Round a position to a grid (decimals = 1: about 11 km; 2: about 1 km).
export function roundPoint(p: { lat: number; lng: number }, decimals: number) {
  const f = 10 ** decimals
  return { lat: Math.round(p.lat * f) / f, lng: Math.round(p.lng * f) / f }
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r
  const dLng = (b.lng - a.lng) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// The local hours ("YYYY-MM-DDTHH:00") the shift of `shiftDate` covers.
export function shiftHours(shiftDate: string, s: ShiftSettings): string[] {
  const out: string[] = []
  const start = Math.floor(s.shiftStartMinutes / 60)
  const end = Math.ceil(s.shiftEndMinutes / 60)
  const overnight = s.shiftEndMinutes <= s.shiftStartMinutes
  const hh = (h: number) => String(h).padStart(2, '0')
  if (overnight) {
    for (let h = start; h < 24; h++) out.push(`${shiftDate}T${hh(h)}:00`)
    const next = addDays(shiftDate, 1)
    for (let h = 0; h < end; h++) out.push(`${next}T${hh(h)}:00`)
  } else {
    for (let h = start; h < end; h++) out.push(`${shiftDate}T${hh(h)}:00`)
  }
  return out
}

// Open-Meteo's hourly answer, cut down to the shift.
export function summarizeNightWeather(
  hourly: { time?: string[]; temperature_2m?: number[]; precipitation_probability?: (number | null)[] } | undefined,
  hours: string[]
): NightWeather | null {
  if (!hourly?.time || !hourly.temperature_2m) return null
  const wanted = new Set(hours)
  const temps: number[] = []
  let rainChance = 0
  let rainFrom: string | null = null
  hourly.time.forEach((t, i) => {
    if (!wanted.has(t)) return
    const temp = hourly.temperature_2m![i]
    if (typeof temp === 'number') temps.push(temp)
    const p = hourly.precipitation_probability?.[i] ?? 0
    if (p > rainChance) rainChance = p
    if (p >= 50 && !rainFrom) rainFrom = formatClock(Number(t.slice(11, 13)) * 60)
  })
  if (temps.length === 0) return null
  return { minC: Math.round(Math.min(...temps)), maxC: Math.round(Math.max(...temps)), rainChance, rainFrom }
}

export function weatherLine(w: NightWeather): string {
  const temp = w.minC === w.maxC ? `${w.minC}°C` : `${w.minC}–${w.maxC}°C`
  if (w.rainFrom) return `${temp}. Rain likely from about ${w.rainFrom} (${w.rainChance}%): pack a raincoat and drive carefully.`
  if (w.rainChance >= 20) return `${temp}, mostly dry (up to ${w.rainChance}% chance of rain).`
  return `${temp} and dry.`
}

// Overpass's answer: fuel stations with a position, nearest first.
export function parseFuel(
  data: { elements?: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] } | undefined,
  from: { lat: number; lng: number },
  limit = 3
): FuelStation[] {
  return (data?.elements ?? [])
    .map((e) => {
      const lat = e.lat ?? e.center?.lat
      const lng = e.lon ?? e.center?.lon
      if (lat == null || lng == null) return null
      const t = e.tags ?? {}
      const name = t.name || t.brand || t.operator || 'Fuel station'
      return { name, lat, lng, km: distanceKm(from, { lat, lng }) }
    })
    .filter((s): s is FuelStation => s !== null)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
}

// Streamed in after the page shows, so a slow answer only delays its own card.
const TIMEOUT_MS = 8000

export async function nightWeather(area: { lat: number; lng: number }, shiftDate: string, s: ShiftSettings): Promise<NightWeather | null> {
  const p = roundPoint(area, 1)
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lng}` +
    `&hourly=temperature_2m,precipitation_probability&timezone=${encodeURIComponent(s.timezone)}&forecast_days=3`
  try {
    const res = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return null
    const data = (await res.json()) as { hourly?: Parameters<typeof summarizeNightWeather>[0] }
    return summarizeNightWeather(data.hourly, shiftHours(shiftDate, s))
  } catch {
    return null
  }
}

export async function nearbyFuel(area: { lat: number; lng: number }, radiusM = 5000): Promise<FuelStation[]> {
  const p = roundPoint(area, 2)
  const query = `[out:json][timeout:8];nwr(around:${radiusM},${p.lat},${p.lng})[amenity=fuel];out center 20;`
  try {
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Trashit driver app (night refuse collection, Ghana)' },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return []
    return parseFuel(await res.json(), p)
  } catch {
    return []
  }
}
