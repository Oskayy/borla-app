import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { DOC_TYPES } from '@/lib/driver-docs'
import DriverDocumentsForm from '@/components/DriverDocumentsForm'

export const dynamic = 'force-dynamic'

export default async function DriverVerificationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: user.id },
    select: { approvalStatus: true, approvalNote: true, submittedAt: true },
  })
  if (!profile) redirect('/dashboard/driver/profile-setup')
  if (profile.approvalStatus === 'APPROVED') redirect('/dashboard/driver')

  const docs = await prisma.driverDocument.findMany({ where: { driverId: user.id }, select: { type: true, createdAt: true } })
  const uploaded = Object.fromEntries(docs.map((d: { type: string; createdAt: Date }) => [d.type, d.createdAt.toISOString()]))
  const waiting = profile.approvalStatus === 'PENDING' && !!profile.submittedAt

  return (
    <div style={{ maxWidth: 520, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Get approved to drive</h1>
      {waiting && (
        <div className="panel" style={{ marginBottom: 16, borderLeft: '4px solid var(--color-accent)' }}>
          <p style={{ fontWeight: 600 }}>Thanks! Your documents are being checked.</p>
          <p style={{ fontSize: 13, color: '#666' }}>
            This usually takes a day or two. We&apos;ll send you a message as soon as you&apos;re approved. You can still replace a
            photo below if you need to.
          </p>
        </div>
      )}
      {profile.approvalStatus === 'REJECTED' && (
        <div className="panel" style={{ marginBottom: 16, borderLeft: '4px solid #B3261E' }}>
          <p style={{ fontWeight: 600 }}>Please update your documents</p>
          <p style={{ fontSize: 13 }}>{profile.approvalNote}</p>
        </div>
      )}
      {!waiting && profile.approvalStatus !== 'REJECTED' && (
        <p style={{ fontSize: 14, color: '#444', marginBottom: 16 }}>
          To keep customers safe, every Trashit driver is checked before their first pickup. Take clear photos of the items
          below, then send them for review.
        </p>
      )}
      <DriverDocumentsForm types={DOC_TYPES} uploaded={uploaded} submitted={waiting} />
    </div>
  )
}
