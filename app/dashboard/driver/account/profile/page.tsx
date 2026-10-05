import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui'
import { BackToAccount } from '@/components/driver/AccountRow'
import ProfileForm from '@/components/customer/ProfileForm'

export const dynamic = 'force-dynamic'

export default async function DriverProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, phone: true, email: true } })
  if (!me) redirect('/login')

  return (
    <div className="mx-auto max-w-2xl">
      <BackToAccount />
      <h1 className="mb-5 text-[clamp(1.5rem,3vw,1.9rem)] font-bold tracking-[-0.025em]">Your details</h1>
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
