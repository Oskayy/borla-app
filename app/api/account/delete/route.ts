import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { confirmPassword } from '@/lib/reauth'
import { createAdminClient } from '@/lib/supabase-admin'
import { EVIDENCE_BUCKET } from '@/lib/storage'
import { logAdminAction } from '@/lib/admin-log'

// A customer deletes their account (rules in PRODUCT.md, decided Oct 2026):
// - needs the password again and the word DELETE;
// - refused while a pickup is on its way, a refund is still processing, or a payment was started in the last hour;
// - orders, payments, refunds and ledger entries are KEPT for accounting but anonymised (no name, phone, email,
//   addresses, pins or cancel notes); unpaid draft bookings are removed;
// - the customer's own waste photos are deleted; driver pickup/unload proof is kept;
// - the login is deleted, so the account can't be used again.

const IN_PROGRESS = ['PENDING_PAYMENT', 'PAID', 'READY_FOR_BATCH', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'PICKUP_PENDING_REVIEW', 'PICKED_UP', 'DISPOSAL_PENDING'] as const
const OPEN_REFUNDS = ['AWAITING_APPROVAL', 'PENDING', 'PROCESSING', 'NEEDS_ATTENTION']

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['CUSTOMER'])
  if (!auth.ok) return auth.response
  const id = auth.user.id

  if (await enforceRateLimit({ identifier: id, action: 'account_delete', maxAttempts: 5, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  if (body?.confirm !== 'DELETE') {
    return NextResponse.json({ error: 'Please type DELETE to confirm' }, { status: 400 })
  }
  const passwordProblem = await confirmPassword(id, auth.user.email, body?.password)
  if (passwordProblem) return NextResponse.json({ error: passwordProblem }, { status: 403 })

  const [inProgress, openRefunds, recentDrafts] = await Promise.all([
    prisma.order.count({ where: { customerId: id, status: { in: [...IN_PROGRESS] } } }),
    prisma.refund.count({ where: { order: { customerId: id }, status: { in: OPEN_REFUNDS } } }),
    prisma.order.count({ where: { customerId: id, status: 'DRAFT', createdAt: { gte: new Date(Date.now() - 3600_000) } } }),
  ])
  if (inProgress > 0) {
    return NextResponse.json(
      { error: 'You have a pickup in progress. You can delete your account once it is done, or cancel it first.' },
      { status: 409 }
    )
  }
  if (openRefunds > 0) {
    return NextResponse.json({ error: 'A refund to you is still being processed. Please try again once it has arrived.' }, { status: 409 })
  }
  if (recentDrafts > 0) {
    return NextResponse.json(
      { error: 'You started a booking in the last hour. Please wait an hour so any payment in progress can settle, then try again.' },
      { status: 409 }
    )
  }

  // The customer's own waste photos, to delete from storage after the database step.
  const photos = await prisma.orderEvidence.findMany({
    where: { type: 'customer_placement', order: { customerId: id } },
    select: { photoUrl: true },
  })
  const orders = await prisma.order.findMany({
    where: { customerId: id },
    select: { id: true, status: true, quoteSnapshot: true },
  })
  const drafts = orders.filter((o) => o.status === 'DRAFT').map((o) => o.id)
  const kept = orders.filter((o) => o.status !== 'DRAFT')

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.orderEvidence.deleteMany({ where: { type: 'customer_placement', order: { customerId: id } } })
        if (drafts.length > 0) {
          await tx.orderEvidence.deleteMany({ where: { orderId: { in: drafts } } })
          await tx.auditLog.deleteMany({ where: { orderId: { in: drafts } } })
          await tx.order.deleteMany({ where: { id: { in: drafts }, status: 'DRAFT' } })
        }
        for (const o of kept) {
          const snap = (o.quoteSnapshot ?? {}) as Record<string, unknown>
          const { address: _address, ...rest } = snap
          await tx.order.update({
            where: { id: o.id },
            data: {
              quoteSnapshot: { ...rest, address: 'Removed (account deleted)' } as Prisma.InputJsonValue,
              latitude: null,
              longitude: null,
              cancelReason: null,
            },
          })
        }
        await tx.notification.deleteMany({ where: { userId: id } })
        await tx.pushSubscription.deleteMany({ where: { userId: id } })
        await tx.customerProfile.deleteMany({ where: { userId: id } })
        await tx.user.update({
          where: { id },
          data: { name: 'Deleted customer', phone: `deleted-${id}`, email: null, active: false },
        })
      },
      { timeout: 30000 }
    )
  } catch (err) {
    console.error('[account-delete] database step failed', err)
    return NextResponse.json({ error: 'We could not delete your account. Nothing was changed. Please try again.' }, { status: 500 })
  }

  const admin = createAdminClient()
  if (photos.length > 0) {
    const { error } = await admin.storage.from(EVIDENCE_BUCKET).remove(photos.map((p) => p.photoUrl))
    if (error) console.error('[account-delete] photo removal failed; files to remove by hand:', photos.length, error.message)
  }
  // The account is already anonymised and switched off; if this fails, sign-in is still blocked by `active: false`.
  const { error: authError } = await admin.auth.admin.deleteUser(id)
  if (authError) console.error('[account-delete] login removal failed', authError.message)

  await logAdminAction(id, 'ACCOUNT_DELETED', id, `Customer deleted their account (${kept.length} orders anonymised, ${drafts.length} drafts removed, ${photos.length} photos removed)`)
  return NextResponse.json({ success: true })
}
