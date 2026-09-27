import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import OptimizeForm from './optimize-form'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER']

export default async function AssignOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !ALLOWED_ROLES.includes(dbUser.role)) {
    redirect('/dashboard')
  }

  const paidOrders = await prisma.order.findMany({
    where: { status: 'PAID' },
    include: { customer: true },
  })

  const drivers = await prisma.user.findMany({
    where: { role: 'DRIVER', driverProfile: { isActive: true } },
    include: { driverProfile: { include: { zone: true } } },
  })

  const zones = await prisma.zone.findMany({
    where: { active: true, centerLat: { not: null }, centerLng: { not: null } },
  })

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Assign Orders to Drivers</h1>
      {paidOrders.length === 0 && <div className="panel"><p>No paid orders waiting for assignment.</p></div>}
      {paidOrders.length > 0 && <OptimizeForm orders={paidOrders} drivers={drivers} zones={zones} />}
    </div>
  )
}