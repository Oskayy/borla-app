import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { ROLE_LABELS, STAFF_ADMIN_ROLES, STAFF_ROLES } from '@/lib/staff'
import StaffClient, { type StaffRow } from '@/components/StaffClient'
import { PageHeader } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !STAFF_ADMIN_ROLES.includes(dbUser.role)) redirect('/ops')

  const staff = await prisma.user.findMany({
    where: { role: { in: STAFF_ROLES } },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, email: true, phone: true, role: true, active: true, mustChangePassword: true, createdAt: true },
  })
  const rows: StaffRow[] = staff.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), isMe: s.id === user.id }))

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Staff"
        lead="Add staff, change what they can do, or suspend them. New staff get a temporary password to pass on privately, not by email. At first sign-in they choose their own password and set up 2-step verification."
      />
      <StaffClient rows={rows} roles={STAFF_ROLES.map((r) => ({ code: r, label: ROLE_LABELS[r] ?? r }))} />
    </div>
  )
}
