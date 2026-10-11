import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { DOC_TYPES } from '@/lib/driver-docs'
import DriverDocumentsForm from '@/components/DriverDocumentsForm'
import { AlertTriangle, Clock } from 'lucide-react'
import { PageHeader } from '@/components/ui'

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
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Get approved to drive" />
      {waiting && (
        <div className="mb-6 flex items-start gap-3 rounded-card bg-action-wash p-5 ring-1 ring-action/30">
          <Clock aria-hidden className="mt-0.5 size-5 shrink-0 text-action" />
          <div>
            <p className="font-semibold">Thanks! Your documents are being checked.</p>
            <p className="mt-1 text-[15px] text-ink-2">
              This usually takes a day or two. We&apos;ll send you a message as soon as you&apos;re approved. You can still replace a photo
              below if you need to.
            </p>
          </div>
        </div>
      )}
      {profile.approvalStatus === 'REJECTED' && (
        <div className="mb-6 flex items-start gap-3 rounded-card bg-danger-wash p-5 ring-1 ring-danger/30">
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" />
          <div>
            <p className="font-semibold">Please update your documents</p>
            <p className="mt-1 text-[15px] text-ink-2">{profile.approvalNote}</p>
          </div>
        </div>
      )}
      {!waiting && profile.approvalStatus !== 'REJECTED' && (
        <p className="mb-6 max-w-[60ch] text-[15px] text-ink-2">
          To keep customers safe, every Trashit driver is checked before their first pickup. Add a clear photo of yourself, then send
          your details for review. Your Ghana Card number, plate number and vehicle photo are on the setup page.
        </p>
      )}
      <DriverDocumentsForm types={DOC_TYPES.filter((t) => !t.setup)} uploaded={uploaded} submitted={waiting} />
    </div>
  )
}
