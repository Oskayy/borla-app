import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { APPROVAL_ROLES, DOC_TYPES, DRIVER_DOCS_BUCKET } from '@/lib/driver-docs'
import DriverApprovalsClient, { type ApplicantRow } from '@/components/DriverApprovalsClient'
import VehicleChangeReviews, { type VehicleChangeRow } from '@/components/ops/VehicleChangeReviews'
import { VEHICLE_CHANGE_DOC } from '@/lib/vehicle-change'
import { PageHeader } from '@/components/ui'

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
      driverProfile: {
        select: {
          approvalStatus: true,
          approvalNote: true,
          submittedAt: true,
          ghanaCardNumber: true,
          vehiclePlate: true,
          vehicleTypeRef: { select: { name: true } },
        },
      },
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
      plate: d.driverProfile?.vehiclePlate ?? null,
      ghanaCard: d.driverProfile?.ghanaCardNumber ?? null,
      docs,
    })
  }
  // Approved drivers who asked to switch vehicle type and sent a photo of the new one.
  const changing = await prisma.user.findMany({
    where: { role: 'DRIVER', driverProfile: { is: { pendingVehicleAt: { not: null } } } },
    select: {
      id: true,
      name: true,
      phone: true,
      driverProfile: {
        select: { vehiclePlate: true, pendingVehicleTypeId: true, pendingVehicleAt: true, vehicleTypeRef: { select: { name: true, capacityLitres: true } } },
      },
      driverDocuments: { where: { type: { in: ['vehicle_photo', VEHICLE_CHANGE_DOC] } }, select: { type: true, path: true } },
    },
  })
  const vehicleTypes = await prisma.vehicleType.findMany({ select: { id: true, name: true, capacityLitres: true } })
  const signed = async (path: string | undefined) =>
    path ? (await admin.storage.from(DRIVER_DOCS_BUCKET).createSignedUrl(path, 60 * 30)).data?.signedUrl ?? null : null
  const changes: VehicleChangeRow[] = []
  for (const d of changing) {
    const p = d.driverProfile!
    changes.push({
      id: d.id,
      name: d.name,
      phone: d.phone,
      plate: p.vehiclePlate,
      from: p.vehicleTypeRef,
      to: vehicleTypes.find((v) => v.id === p.pendingVehicleTypeId) ?? null,
      sentAt: p.pendingVehicleAt!.toISOString(),
      oldPhoto: await signed(d.driverDocuments.find((x) => x.type === 'vehicle_photo')?.path),
      newPhoto: await signed(d.driverDocuments.find((x) => x.type === VEHICLE_CHANGE_DOC)?.path),
    })
  }

  const waiting = rows.filter((r) => r.status === 'PENDING' && r.submittedAt)
  const notSent = rows.filter((r) => r.status === 'PENDING' && !r.submittedAt)
  const rejected = rows.filter((r) => r.status === 'REJECTED')

  return (
    <div className="grid gap-10">
      <PageHeader title="Approvals" lead="New drivers can't go online or receive pickups until they're approved here. Approved drivers who switch vehicle wait here too." />
      <VehicleChangeReviews rows={changes} />
      <DriverApprovalsClient waiting={waiting} notSent={notSent} rejected={rejected} />
    </div>
  )
}
