import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { createAdminClient } from '@/lib/supabase-admin'
import { STAFF_ADMIN_ROLES, STAFF_ROLES, temporaryPassword } from '@/lib/staff'
import { normalizeGhanaPhone } from '@/lib/phone'
import { caught } from '@/lib/errors'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Creates a staff account with a temporary password, shown once to the Super Admin to pass on privately.
// At first sign-in the person chooses their own password, then sets up 2-step verification.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(STAFF_ADMIN_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'create_staff', maxAttempts: 20, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const name = cleanText(body?.name, 100)
  const email = cleanText(body?.email, 254)?.toLowerCase()
  const phoneRaw = cleanText(body?.phone, 20)
  const role = body?.role
  if (!name || !email || !phoneRaw) return NextResponse.json({ error: 'Name, email and phone are required' }, { status: 400 })
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
  if (!normalizeGhanaPhone(phoneRaw) && !/^\+?[0-9 ()-]{9,20}$/.test(phoneRaw)) {
    return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 })
  }
  if (!STAFF_ROLES.includes(role)) return NextResponse.json({ error: 'Please choose a staff role' }, { status: 400 })

  const password = temporaryPassword()
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) {
    const msg = /already|registered|exists/i.test(error?.message ?? '') ? 'An account with that email already exists' : error?.message || 'Could not create the login'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  try {
    await prisma.user.create({ data: { id: data.user.id, name, email, phone: phoneRaw, role, mustChangePassword: true } })
  } catch (err) {
    const e = caught(err)
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {})
    const msg = e?.code === 'P2002' ? 'That phone number or email is already used by another account' : 'Could not create the account'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  await logAdminAction(auth.user.id, 'STAFF_CREATED', data.user.id, `${name} <${email}> as ${role}`)
  return NextResponse.json({ success: true, id: data.user.id, temporaryPassword: password })
}
