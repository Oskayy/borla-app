// app/api/auth/mfa/unenroll/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { MANDATORY_MFA_ROLES } from '@/lib/mfa'
import { readJson } from '@/lib/validate'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const factorId = (await readJson(req))?.factorId
  if (typeof factorId !== 'string' || !factorId || factorId.length > 100) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (dbUser && MANDATORY_MFA_ROLES.includes(dbUser.role)) {
    return NextResponse.json(
      { error: '2FA is mandatory for your role and cannot be disabled. Contact an admin if you need help.' },
      { status: 403 }
    )
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}