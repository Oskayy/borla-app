import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid, readJson } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { createAdminClient } from '@/lib/supabase-admin'
import { STAFF_ADMIN_ROLES, STAFF_ROLES, temporaryPassword } from '@/lib/staff'

// Changes a staff member's role, suspends or reactivates them, or gives them a new temporary password.
// Body: { role?: string, active?: boolean, resetPassword?: true }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(STAFF_ADMIN_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'edit_staff', maxAttempts: 60, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid account' }, { status: 400 })
  if (id === auth.user.id) return NextResponse.json({ error: 'You can’t change your own account here' }, { status: 400 })

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, role: true, active: true } })
  if (!target || !STAFF_ROLES.includes(target.role)) return NextResponse.json({ error: 'Staff account not found' }, { status: 404 })

  const body = await readJson(req)
  const admin = createAdminClient()

  // Never leave Trashit without an active Super Admin.
  const losesSuperAdmin =
    target.role === 'SUPER_ADMIN' && target.active && ((body?.role && body.role !== 'SUPER_ADMIN') || body?.active === false)
  if (losesSuperAdmin) {
    const others = await prisma.user.count({ where: { role: 'SUPER_ADMIN', active: true, id: { not: id } } })
    if (others === 0) return NextResponse.json({ error: 'There must always be at least one active Super Admin' }, { status: 400 })
  }

  if (body?.role !== undefined) {
    if (!STAFF_ROLES.includes(body.role)) return NextResponse.json({ error: 'Please choose a staff role' }, { status: 400 })
    if (body.role !== target.role) {
      await prisma.user.update({ where: { id }, data: { role: body.role } })
      await logAdminAction(auth.user.id, 'STAFF_ROLE_CHANGED', id, `${target.name}: ${target.role} -> ${body.role}`)
    }
  }

  if (typeof body?.active === 'boolean' && body.active !== target.active) {
    // A ban stops sign-in and ends existing sessions when they next refresh; the flag blocks the app right away.
    const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: body.active ? 'none' : '876000h' })
    if (error) return NextResponse.json({ error: `Could not update the login: ${error.message}` }, { status: 500 })
    await prisma.user.update({ where: { id }, data: { active: body.active } })
    await logAdminAction(auth.user.id, body.active ? 'STAFF_REACTIVATED' : 'STAFF_SUSPENDED', id, target.name)
  }

  if (body?.resetPassword === true) {
    const password = temporaryPassword()
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) return NextResponse.json({ error: `Could not reset the password: ${error.message}` }, { status: 500 })
    await prisma.user.update({ where: { id }, data: { mustChangePassword: true } })
    await logAdminAction(auth.user.id, 'STAFF_PASSWORD_RESET', id, target.name)
    return NextResponse.json({ success: true, temporaryPassword: password })
  }

  return NextResponse.json({ success: true })
}
