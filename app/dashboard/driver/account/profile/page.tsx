import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { AVATAR_DOC, driverPhotoUrls } from '@/lib/driver-photos'
import { Card } from '@/components/ui'
import { BackToAccount } from '@/components/driver/AccountRow'
import PhotoUpload from '@/components/driver/PhotoUpload'
import ProfileForm from '@/components/customer/ProfileForm'

export const dynamic = 'force-dynamic'

export default async function DriverProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [me, photos] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { name: true, phone: true, email: true } }),
    driverPhotoUrls(user.id, [AVATAR_DOC]),
  ])
  if (!me) redirect('/login')
  const initials = me.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-5">
      <div>
        <BackToAccount />
        <h1 className="text-[clamp(1.5rem,3vw,1.9rem)] font-bold tracking-[-0.025em]">Your details</h1>
      </div>

      <Card>
        <h2 className="mb-4 text-base font-semibold tracking-tight">Profile photo</h2>
        <PhotoUpload type={AVATAR_DOC} url={photos[AVATAR_DOC]} fallback={initials} round size="size-24" withButton label="Change your profile photo" />
      </Card>

      <Card>
        <ProfileForm
          initial={{ name: me.name, phone: me.phone }}
          email={me.email ?? user.email ?? ''}
          phoneHint="Customers and Trashit call you on this number, and SMS alerts go here."
        />
      </Card>
    </div>
  )
}
