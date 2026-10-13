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
import { DRIVER_DOCS_BUCKET } from '@/lib/driver-docs'
import { getWalletState } from '@/lib/wallet-server'
import { OPEN_WITHDRAWAL_STATUSES } from '@/lib/wallet'
import { driverDeleteBlockers } from '@/lib/driver-delete'

// A customer deletes their account (rules in PRODUCT.md, decided Oct 2026):
// - needs the password again and the word DELETE;
// - refused while a pickup is on its way, a refund is still processing, or a payment was started in the last hour;
// - orders, payments, refunds and ledger entries are KEPT for accounting but anonymised (no name, phone, email,
//   addresses, pins or cancel notes); unpaid draft bookings are removed;
// - the customer's own waste photos are deleted; driver pickup/unload proof is kept;
// - the login is deleted, so the account can't be used again.
//
// A driver deletes their account (decided Oct 2026):
// - the same password check and DELETE;
// - refused while a stop is on their list, a payout is on its way, they have earnings left (available, clearing or
//   kept back), or they owe Trashit money (lib/driver-delete.ts);
// - their documents and photos (driver photo, profile picture, vehicle photos, licence) and Ghana Card number, MoMo
//   wallet, home base and last location are deleted;
// - orders, pickup and unload proof, earnings, payouts and the ledger are KEPT for accounting and customers' records,
//   without their name, phone, email or wallet number; ratings stay as numbers;
// - the login is deleted.

const IN_PROGRESS = ['PENDING_PAYMENT', 'PAID', 'READY_FOR_BATCH', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'PICKUP_PENDING_REVIEW', 'PICKED_UP', 'DISPOSAL_PENDING'] as const
const OPEN_REFUNDS = ['AWAITING_APPROVAL', 'PENDING', 'PROCESSING', 'NEEDS_ATTENTION']

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['CUSTOMER', 'DRIVER'])
  if (!auth.ok) return auth.response
  const id = auth.user.id
  const isDriver = auth.dbUser.role === 'DRIVER'

  if (await enforceRateLimit({ identifier: id, action: 'account_delete', maxAttempts: 5, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const body = await readJson(req)
  if (body?.confirm !== 'DELETE') {
    return NextResponse.json({ error: 'Please type DELETE to confirm' }, { status: 400 })
  }
  const passwordProblem = await confirmPassword(id, auth.user.email, body?.password)
  if (passwordProblem) return NextResponse.json({ error: passwordProblem }, { status: 403 })
  if (isDriver) return deleteDriver(id)

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
        await tx.orderRating.updateMany({ where: { customerId: id }, data: { comment: null } }) // stars stay with the driver
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


const DRIVER_OPEN = ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'PICKUP_PENDING_REVIEW', 'PICKED_UP', 'DISPOSAL_PENDING', 'FAILED_PICKUP', 'DISPUTED'] as const
const accraDate = (d: Date) => d.toLocaleString('en-GB', { timeZone: 'Africa/Accra', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

async function deleteDriver(id: string) {
  const [openStops, openWithdrawals, wallet] = await Promise.all([
    prisma.order.count({ where: { driverId: id, status: { in: [...DRIVER_OPEN] } } }),
    prisma.withdrawal.count({ where: { driverId: id, status: { in: OPEN_WITHDRAWAL_STATUSES } } }),
    getWalletState(id),
  ])
  const blockers = driverDeleteBlockers({ openStops, openWithdrawals, wallet }, accraDate)
  if (blockers.length > 0) {
    return NextResponse.json({ error: `You can't delete your account yet. ${blockers.join(' ')}`, blockers }, { status: 409 })
  }

  const docs = await prisma.driverDocument.findMany({ where: { driverId: id }, select: { path: true } })
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.driverDocument.deleteMany({ where: { driverId: id } })
        await tx.driverProfile.updateMany({
          where: { userId: id },
          data: {
            ghanaCardNumber: null,
            vehiclePlate: null,
            homeAddress: null,
            homeLat: null,
            homeLng: null,
            currentLat: null,
            currentLng: null,
            lastLocationAt: null,
            isOnline: false,
            isActive: false,
            onlineOverrideUntil: null,
            momoNumber: null,
            momoProvider: null,
            momoName: null,
            paystackRecipientCode: null,
            recipientFor: null,
            approvalNote: null,
            vehicleChangeNote: null,
            pendingVehicleTypeId: null,
            pendingRadiusKm: null,
            pendingVehicleAt: null,
          },
        })
        // Payout records stay for accounting, without the wallet owner's name or full number.
        const payouts = await tx.withdrawal.findMany({ where: { driverId: id }, select: { id: true, momoNumber: true } })
        for (const w of payouts) {
          await tx.withdrawal.update({ where: { id: w.id }, data: { momoName: 'Deleted driver', momoNumber: `•••${w.momoNumber.slice(-3)}` } })
        }
        await tx.notification.deleteMany({ where: { userId: id } })
        await tx.pushSubscription.deleteMany({ where: { userId: id } })
        await tx.user.update({ where: { id }, data: { name: 'Deleted driver', phone: `deleted-${id}`, email: null, active: false } })
      },
      { timeout: 30000 }
    )
  } catch (err) {
    console.error('[account-delete] driver database step failed', err)
    return NextResponse.json({ error: 'We could not delete your account. Nothing was changed. Please try again.' }, { status: 500 })
  }

  const admin = createAdminClient()
  if (docs.length > 0) {
    const { error } = await admin.storage.from(DRIVER_DOCS_BUCKET).remove(docs.map((d) => d.path))
    if (error) console.error('[account-delete] driver document removal failed; files to remove by hand:', docs.length, error.message)
  }
  const { error: authError } = await admin.auth.admin.deleteUser(id)
  if (authError) console.error('[account-delete] login removal failed', authError.message)

  await logAdminAction(id, 'ACCOUNT_DELETED', id, `Driver deleted their account (${docs.length} documents removed)`)
  return NextResponse.json({ success: true })
}
