import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DriverProfileSetupForm from '@/components/DriverProfileSetupForm'

export default async function DriverProfileSetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || dbUser.role !== 'DRIVER') redirect('/dashboard')

  const zones = await prisma.zone.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: '0 20px' }}>
      <div className="panel">
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Welcome to Borla, {dbUser.name}</h1>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
          Let's finish setting up your driver profile before you start receiving jobs.
        </p>
        <DriverProfileSetupForm zones={zones} />
      </div>
    </div>
  )
}