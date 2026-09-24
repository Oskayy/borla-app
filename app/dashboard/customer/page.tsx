import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export default async function CustomerDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })

  const lastOrder = await prisma.order.findFirst({
    where: { customerId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div style={{ maxWidth: 500, margin: '60px auto', padding: 20 }}>
      <h1>Welcome, {dbUser?.name}</h1>
      {lastOrder ? (
        <p>
          Your most recent order ({(lastOrder.quoteSnapshot as any)?.address}) is currently:{' '}
          <strong>{lastOrder.status}</strong>
        </p>
      ) : (
        <p>You haven't booked a pickup yet.</p>
      )}
    </div>
  )
}