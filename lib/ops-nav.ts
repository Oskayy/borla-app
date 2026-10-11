// The ops console menu: which pages each staff role can open, grouped by job. Each page still checks its own roles;
// this only hides links a person can't use. Queue keys match lib/ops-queue.ts.

import { OPS_ROLES } from './auth'
import { DISPOSAL_REVIEW_ROLES } from './disposal-release'
import { EXCEPTION_ROLES } from './exceptions'
import { APPROVAL_ROLES } from './driver-docs'
import { PAYOUT_ROLES } from './wallet-server'
import { STAFF_ADMIN_ROLES } from './staff'

export type QueueKey = 'unloads' | 'exceptions' | 'approvals' | 'lowRatings' | 'withdrawals' | 'needsDriver' | 'finance'

export interface OpsLink {
  href: string
  label: string
  icon: string // lucide icon name, resolved in the nav component
  roles: readonly string[] | 'all'
  queue?: QueueKey
}

const SETUP_VIEW = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER', 'FINANCE']
const MONEY_RULES = ['SUPER_ADMIN', 'FINANCE']

export const OPS_SECTIONS: { title: string; links: OpsLink[] }[] = [
  {
    title: 'Tonight',
    links: [
      { href: '/ops', label: 'Overview', icon: 'LayoutDashboard', roles: 'all' },
      { href: '/ops/assign', label: 'Plan & assign', icon: 'Route', roles: OPS_ROLES, queue: 'needsDriver' },
      { href: '/ops/disposal-review', label: 'Unloads to check', icon: 'Flag', roles: DISPOSAL_REVIEW_ROLES, queue: 'unloads' },
      { href: '/ops/exceptions', label: 'Exceptions', icon: 'AlertTriangle', roles: EXCEPTION_ROLES, queue: 'exceptions' },
    ],
  },
  {
    title: 'Drivers',
    links: [
      { href: '/ops/drivers', label: 'Drivers', icon: 'Truck', roles: OPS_ROLES },
      { href: '/ops/driver-approvals', label: 'Approvals', icon: 'BadgeCheck', roles: APPROVAL_ROLES, queue: 'approvals' },
      { href: '/ops/ratings', label: 'Ratings', icon: 'Star', roles: EXCEPTION_ROLES, queue: 'lowRatings' },
    ],
  },
  {
    title: 'Money',
    links: [
      { href: '/ops/finance', label: 'Finance', icon: 'Landmark', roles: PAYOUT_ROLES, queue: 'finance' },
      { href: '/ops/withdrawals', label: 'Withdrawals', icon: 'Wallet', roles: PAYOUT_ROLES, queue: 'withdrawals' },
      { href: '/ops/pricing', label: 'Pricing', icon: 'Tags', roles: MONEY_RULES },
      { href: '/ops/payouts', label: 'Payout rules', icon: 'Percent', roles: MONEY_RULES },
    ],
  },
  {
    title: 'Setup',
    links: [
      { href: '/ops/zones', label: 'Zones', icon: 'Map', roles: ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER', 'FINANCE'] },
      { href: '/ops/disposal-sites', label: 'Disposal sites', icon: 'Factory', roles: SETUP_VIEW },
      { href: '/ops/vehicles', label: 'Vehicles', icon: 'Car', roles: SETUP_VIEW },
      { href: '/ops/shift', label: 'Shift hours', icon: 'Clock', roles: SETUP_VIEW },
      { href: '/ops/staff', label: 'Staff', icon: 'Users', roles: STAFF_ADMIN_ROLES },
      { href: '/ops/mfa-recovery', label: '2FA recovery', icon: 'KeyRound', roles: ['SUPER_ADMIN'] },
    ],
  },
]

export function canOpen(link: Pick<OpsLink, 'roles'>, role: string): boolean {
  return link.roles === 'all' || link.roles.includes(role)
}

// The menu for one role: empty sections are dropped.
export function sectionsFor(role: string) {
  return OPS_SECTIONS.map((s) => ({ ...s, links: s.links.filter((l) => canOpen(l, role)) })).filter((s) => s.links.length > 0)
}

export const ROLE_NAMES: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  OPS_MANAGER: 'Ops manager',
  DISPATCHER: 'Dispatcher',
  FINANCE: 'Finance',
  SUPPORT: 'Support',
  COMPLIANCE: 'Compliance',
  ANALYST: 'Analyst',
}
