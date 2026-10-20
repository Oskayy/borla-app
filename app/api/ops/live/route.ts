import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { STAFF_ROLES } from '@/lib/staff'
import { opsFingerprint } from '@/lib/ops-live-server'

// Open ops pages ask this every 15 seconds: a short fingerprint of what the console shows. When it changes, the
// page reloads its data. Any staff member who can open the console may ask; only the hash is returned.
export async function GET() {
  const auth = await requireAuth(STAFF_ROLES)
  if (!auth.ok) return auth.response

  try {
    return NextResponse.json({ version: await opsFingerprint(), at: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[ops-live] fingerprint failed', e)
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
}
