import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { activateRule, deleteRule } from '@/lib/rule-admin'

const FINANCE_ROLES = ['SUPER_ADMIN', 'FINANCE']

// Make a payout rule from the history the active one ({ action: 'activate' }).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(FINANCE_ROLES)
  if (!auth.ok) return auth.response
  if (await enforceRateLimit({ identifier: auth.user.id, action: 'payout_change', maxAttempts: 30, windowMinutes: 60 })) return tooManyRequests()

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid rule' }, { status: 400 })
  if ((await readJson(req))?.action !== 'activate') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  return activateRule('payout', id, auth.user.id)
}

// Delete a payout rule that isn't in use.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(FINANCE_ROLES)
  if (!auth.ok) return auth.response
  if (await enforceRateLimit({ identifier: auth.user.id, action: 'payout_change', maxAttempts: 30, windowMinutes: 60 })) return tooManyRequests()

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid rule' }, { status: 400 })
  return deleteRule('payout', id, auth.user.id)
}
