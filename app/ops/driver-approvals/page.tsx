import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { APPROVAL_ROLES, DOC_TYPES, DRIVER_DOCS_BUCKET } from '@/lib/driver-docs'
import DriverApprovalsClient, { type ApplicantRow } from '@/components/DriverApprovalsClient'

export const dynamic = 'force-dynamic'

export default async function DriverApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !APPROVAL_ROLES.includes(dbUser.role)) redirect('/ops')

  const drivers = await prisma.user.findMany({
    where: { role: 'DRIVER', driverProfile: { is: { approvalStatus: { in: ['PENDING', 'REJECTED'] } } } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      createdAt: true,
      driverProfile: { select: { approvalStatus: true, approvalNote: true, submittedAt: true, vehicleTypeRef: { select: { name: true } } } },
      driverDocuments: { select: { type: true, path: true } },
    },
  })

  // Documents are private: short-lived links let staff view them.
  const admin = createAdminClient()
  const rows: ApplicantRow[] = []
  for (const d of drivers) {
    const docs: ApplicantRow['docs'] = []
    for (const t of DOC_TYPES) {
      const doc = d.driverDocuments.find((x: { type: string }) => x.type === t.code)
      const url = doc ? (await admin.storage.from(DRIVER_DOCS_BUCKET).createSignedUrl(doc.path, 60 * 30)).data?.signedUrl ?? null : null
      docs.push({ type: t.code, label: t.label, url })
    }
    rows.push({
      id: d.id,
      name: d.name,
      phone: d.phone,
      email: d.email,
      signedUpAt: d.createdAt.toISOString(),
      status: d.driverProfile?.approvalStatus ?? 'PENDING',
      note: d.driverProfile?.approvalNote ?? null,
      submittedAt: d.driverProfile?.submittedAt ? d.driverProfile.submittedAt.toISOString() : null,
      vehicle: d.driverProfile?.vehicleTypeRef?.name ?? null,
      docs,
    })
  }
  const waiting = rows.filter((r) => r.status === 'PENDING' && r.submittedAt)
  const notSent = rows.filter((r) => r.status === 'PENDING' && !r.submittedAt)
  const rejected = rows.filter((r) => r.status === 'REJECTED')

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Driver Approvals</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        New drivers can&apos;t go online or receive pickups until they&apos;re approved here. Check the Ghana Card photo matches
        the driver&apos;s photo and name, and that the vehicle looks roadworthy.
      </p>
      <DriverApprovalsClient waiting={waiting} notSent={notSent} rejected={rejected} />
    </div>
  )
}
