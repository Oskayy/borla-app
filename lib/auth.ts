import { NextResponse } from 'next/server'
import type { User as DbUser } from '@prisma/client'
import type { User as AuthUser } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { MANDATORY_MFA_ROLES } from '@/lib/mfa'

export const OPS_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER']

// Every result has the same fields so it type-checks under any TypeScript setting.
// Rule of use: if `ok` is false, return `response` and stop. Only read `user` and
// `dbUser` after that check.
export interface AuthResult {
  ok: boolean
  response: NextResponse
  user: AuthUser
  dbUser: DbUser
}

function deny(status: number, error: string): AuthResult {
  return {
    ok: false,
    response: NextResponse.json({ error }, { status }),
    user: null as unknown as AuthUser,
    dbUser: null as unknown as DbUser,
  }
}

// Usage inside a route:
//   const auth = await requireAuth(['DRIVER'])
//   if (!auth.ok) return auth.response
export async function requireAuth(allowedRoles?: string[]): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return deny(401, 'Please log in')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser) return deny(401, 'Account not found')

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  // Password entered but the 2FA code not yet verified: treat as not logged in.
  if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
    return deny(401, 'Two-factor verification required')
  }

  // Admin and staff roles must always be fully 2FA-verified.
  if (MANDATORY_MFA_ROLES.includes(dbUser.role) && aal?.currentLevel !== 'aal2') {
    return deny(403, 'Two-factor authentication is required for this account')
  }

  if (allowedRoles && !allowedRoles.includes(dbUser.role)) {
    return deny(403, 'Not authorized')
  }

  return {
    ok: true,
    response: null as unknown as NextResponse,
    user,
    dbUser,
  }
}