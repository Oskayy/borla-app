import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runScheduledJobs } from '@/lib/nightly-jobs'

// Called every 2 minutes by the scheduler (Supabase pg_cron): moves on stops drivers didn't accept in time,
// sends the plan-ready notice, assigns waiting orders during the shift, and rolls over uncollected orders.
// Protected by CRON_SECRET, sent as "Authorization: Bearer <secret>".
function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) return false
  const given = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function run(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const summary = await runScheduledJobs(true)
  return NextResponse.json({ success: true, ...summary })
}

export async function GET(req: NextRequest) {
  return run(req)
}

export async function POST(req: NextRequest) {
  return run(req)
}
