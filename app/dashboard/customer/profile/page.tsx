import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, MapPin } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { dateLabel } from '@/lib/format'
import { Card, CardTitle, PageHeader } from '@/components/ui'
import ProfileForm from '@/components/customer/ProfileForm'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [me, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { name: true, phone: true, email: true, createdAt: true } }),
    prisma.customerProfile.findUnique({ where: { userId: user.id }, select: { address: true, homePinConfirmedAt: true } }),
  ])
  if (!me) redirect('/login')

  const initials = me.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="max-w-3xl">
      <PageHeader title="Profile" lead="Keep your details up to date so pickups go smoothly." />
      <div className="anim-stagger grid gap-6">
        <Card>
          <div className="mb-6 flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-full bg-customer text-lg font-semibold text-white">{initials}</span>
            <span>
              <span className="block text-lg font-bold tracking-tight">{me.name}</span>
              <span className="block text-sm text-ink-3">Customer since {dateLabel(me.createdAt)}</span>
            </span>
          </div>
          <ProfileForm initial={{ name: me.name, phone: me.phone }} email={me.email ?? user.email ?? ''} />
        </Card>

        <Card>
          <CardTitle>Home pin</CardTitle>
          <Link href="/dashboard/customer/home-location" className="-mx-2 flex items-center gap-3 rounded-control p-2 hover:bg-canvas">
            <MapPin aria-hidden className="size-5 shrink-0 text-customer" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{profile?.address || 'No home pin yet'}</span>
              <span className="block text-sm text-ink-3">{profile?.homePinConfirmedAt ? 'Pin confirmed on your gate' : 'Set it once for every booking'}</span>
            </span>
            <ChevronRight aria-hidden className="size-4 text-ink-3" />
          </Link>
        </Card>
      </div>
    </div>
  )
}
