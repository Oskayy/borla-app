import { NextRequest, NextResponse } from 'next/server'
import { getClientIp } from '@/lib/rate-limit'
import { parseVital } from '@/lib/vitals'

// Anonymous page-speed measurements from browsers (components/WebVitals.tsx). Public on purpose: visitors who aren't
// signed in count too. Nothing is stored and nothing identifies anyone (lib/vitals.ts); each report becomes one line in
// the server log, e.g. "[vitals] LCP 2346 good phone /dashboard/driver/home". The IP is used only for the throttle
// below, kept in memory and never logged.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 40
const recent = new Map<string, { count: number; since: number }>()

function throttled(ip: string): boolean {
  const now = Date.now()
  if (recent.size > 5000) recent.clear()
  const r = recent.get(ip)
  if (!r || now - r.since > WINDOW_MS) {
    recent.set(ip, { count: 1, since: now })
    return false
  }
  r.count++
  return r.count > MAX_PER_WINDOW
}

export async function POST(req: NextRequest) {
  if (throttled(getClientIp(req))) return new NextResponse(null, { status: 429 })
  const text = await req.text().catch(() => '')
  if (!text || text.length > 1000) return new NextResponse(null, { status: 400 })
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return new NextResponse(null, { status: 400 })
  }
  const v = parseVital(body)
  if (!v) return new NextResponse(null, { status: 400 })
  console.log(`[vitals] ${v.name} ${v.value} ${v.rating} ${v.device} ${v.path}`)
  return new NextResponse(null, { status: 204 })
}
