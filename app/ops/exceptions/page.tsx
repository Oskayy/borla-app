import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER', 'COMPLIANCE']

export default async function ExceptionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !ALLOWED_ROLES.includes(dbUser.role)) {
    redirect('/dashboard')
  }

  const flaggedOrders = await prisma.order.findMany({
    where: { status: { in: ['FAILED_PICKUP', 'DISPUTED'] } },
    include: {
      customer: true,
      disputes: true,
      auditLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Flagged Orders</h1>
      {flaggedOrders.length === 0 && <div className="panel"><p>No flagged orders right now.</p></div>}
      {flaggedOrders.map((order) => {
        const quote = order.quoteSnapshot as { address?: string; price?: number }
        // Prefer the Dispute reason if one exists (spill/hazard path);
        // otherwise fall back to the audit log's reason (locked-gate path)
        const reason = order.disputes[0]?.reason ?? order.auditLogs[0]?.reason ?? 'No reason recorded'

        return (
          <div key={order.id} className="panel" style={{ marginBottom: 12 }}>
            <p style={{ fontWeight: 500, marginBottom: 4 }}>{quote.address}</p>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>
              GHS {quote.price} — {order.customer.name}
            </p>
            <p style={{ fontSize: 13, marginBottom: 4 }}>
              <span className="status-dot" style={{ background: '#B3261E' }} />
              {order.status}
            </p>
            <p style={{ fontSize: 13, color: '#666' }}>Reason: {reason}</p>
          </div>
        )
      })}
    </div>
  )
}