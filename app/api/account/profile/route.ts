import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { cleanText, readJson } from '@/lib/validate'
import { localGhanaPhone, normalizeGhanaPhone } from '@/lib/phone'
import { logAdminAction } from '@/lib/admin-log'
import { confirmPassword } from '@/lib/reauth'
import { createClient } from '@/utils/supabase/server'
import { caught } from '@/lib/errors'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// A customer or driver updates their own name, phone number and email.
// Changing the email needs the current password (someone holding an unlocked phone can't take the account over).
// The email change goes through Supabase Auth; if it asks for confirmation, the new email only applies once confirmed.
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(['CUSTOMER', 'DRIVER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'profile_update', maxAttempts: 10, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  const name = cleanText(body?.name, 100)
  const normalized = normalizeGhanaPhone(body?.phone)
  if (!name || name.length < 2) return NextResponse.json({ error: 'Please enter your full name' }, { status: 400 })
  if (!normalized) return NextResponse.json({ error: 'Please enter a Ghana mobile number, e.g. 024 412 3456' }, { status: 400 })
  const phone = localGhanaPhone(normalized)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (email && (email.length > 254 || !EMAIL.test(email))) return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })

  const before = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { name: true, phone: true, email: true } })
  if (!before) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  const emailChanging = !!email && email !== (before.email ?? '').toLowerCase()

  // A new email: check the password first, then ask Supabase Auth (it may send a confirmation link).
  let emailPending = false
  if (emailChanging) {
    const problem = await confirmPassword(auth.user.id, before.email ?? undefined, body?.password)
    if (problem) return NextResponse.json({ error: problem }, { status: 403 })
    if (await prisma.user.findFirst({ where: { email, NOT: { id: auth.user.id } }, select: { id: true } })) {
      return NextResponse.json({ error: 'That email is already used by another account' }, { status: 409 })
    }
    const supabase = await createClient()
    const { data, error } = await supabase.auth.updateUser({ email })
    if (error) return NextResponse.json({ error: 'Could not change your email. Please try again.' }, { status: 400 })
    emailPending = (data.user?.email ?? '').toLowerCase() !== email
  }

  try {
    await prisma.user.update({
      where: { id: auth.user.id },
      data: { name, phone, ...(emailChanging && !emailPending ? { email } : {}) },
    })
  } catch (err) {
    if (caught(err)?.code === 'P2002') {
      return NextResponse.json({ error: 'That phone number is already used by another account' }, { status: 409 })
    }
    console.error('[profile] update failed', err)
    return NextResponse.json({ error: 'Could not save your details. Please try again.' }, { status: 500 })
  }

  const mask = (p: string) => `${p.slice(0, 3)}****${p.slice(-3)}`
  if (before.phone !== phone) await logAdminAction(auth.user.id, 'PROFILE_PHONE_CHANGED', auth.user.id, `${mask(before.phone)} -> ${mask(phone)}`)
  if (emailChanging) await logAdminAction(auth.user.id, emailPending ? 'PROFILE_EMAIL_CHANGE_REQUESTED' : 'PROFILE_EMAIL_CHANGED', auth.user.id, 'Email changed')
  return NextResponse.json({ success: true, emailPending })
}
