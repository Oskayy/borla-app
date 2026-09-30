import { randomInt } from 'crypto'

// Staff accounts: who can manage them, and which roles they can be given.
export const STAFF_ADMIN_ROLES = ['SUPER_ADMIN']
export const STAFF_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER', 'FINANCE', 'SUPPORT', 'COMPLIANCE', 'ANALYST']

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin (everything, incl. staff accounts)',
  OPS_MANAGER: 'Ops Manager (dispatch, settings, refunds)',
  DISPATCHER: 'Dispatcher (assigning, drivers, exceptions)',
  FINANCE: 'Finance (driver withdrawals, refunds, payout rules)',
  SUPPORT: 'Support (exceptions and customer issues)',
  COMPLIANCE: 'Compliance (driver approvals, unload checks)',
  ANALYST: 'Analyst (read-only)',
}

// A temporary password that passes the app's password rules; the person must change it at first sign-in.
export function temporaryPassword(): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?']
  const all = sets.join('')
  const chars = sets.map((s) => s[randomInt(s.length)])
  while (chars.length < 16) chars.push(all[randomInt(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
