import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'
import { confirmPassword } from '@/lib/reauth'
import { logAdminAction } from '@/lib/admin-log'
import { notifyUsers } from '@/lib/notify'
import { caught } from '@/lib/errors'
import { RECORDS_APPROVE_ROLES, RECORDS_START_ROLES, approveProblem, isDue } from '@/lib/records-retention'
import { anonymiseYear, describeCounts } from '@/lib/records-retention-server'

// Records older than 6 years (lib/records-retention.ts):
// - "request": a super admin asks for one due year to be anonymised;
// - "approve": a different super admin or finance user approves it with their password, and it runs straight away
//   (also used to run it again after a failure or a server timeout);
// - "cancel": anyone who can see the page withdraws a request that hasn't run.
export async function POST(req: NextRequest) {
  const auth = await requireAuth([...RECORDS_APPROVE_ROLES])
  if (!auth.ok) return auth.response
  const me = auth.user.id
  const role = auth.dbUser.role

  if (await enforceRateLimit({ identifier: me, action: 'records_retention', maxAttempts: 10, windowMinutes: 60 })) {
    return tooManyRequests()
  }
  const body = await readJson(req)
  const now = new Date()

  if (body?.action === 'request') {
    if (!(RECORDS_START_ROLES as readonly string[]).includes(role)) {
      return NextResponse.json({ error: 'Only a super admin can ask for this.' }, { status: 403 })
    }
    const year = Number(body?.year)
    if (!Number.isInteger(year) || year < 2000 || !isDue(year, now)) {
      return NextResponse.json({ error: "That year's records aren't 6 years old yet." }, { status: 400 })
    }
    const open = await prisma.recordsRetentionRun.findFirst({ where: { year, status: { in: ['REQUESTED', 'RUNNING', 'FAILED', 'DONE'] } } })
    if (open) return NextResponse.json({ error: `There is already a ${open.status.toLowerCase()} request for ${year}.` }, { status: 409 })
    const run = await prisma.recordsRetentionRun.create({ data: { year, requestedBy: me } })
    await logAdminAction(me, 'RECORDS_ANONYMISE_REQUESTED', run.id, `Asked to anonymise records from ${year}`)
    const approvers = await prisma.user.findMany({ where: { role: { in: [...RECORDS_APPROVE_ROLES] }, active: true, id: { not: me } }, select: { id: true } })
    await notifyUsers(
      approvers.map((u) => u.id),
      { title: `Approve: anonymise ${year} records`, body: `${auth.dbUser.name} asked to remove personal details from ${year}'s records.`, url: '/ops/records' }
    )
    return NextResponse.json({ success: true })
  }

  const run = typeof body?.id === 'string' ? await prisma.recordsRetentionRun.findUnique({ where: { id: body.id } }) : null
  if (!run) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  if (body?.action === 'cancel') {
    const done = await prisma.recordsRetentionRun.updateMany({ where: { id: run.id, status: { in: ['REQUESTED', 'FAILED'] } }, data: { status: 'CANCELLED', cancelledBy: me } })
    if (done.count === 0) return NextResponse.json({ error: 'This request can no longer be cancelled.' }, { status: 409 })
    await logAdminAction(me, 'RECORDS_ANONYMISE_CANCELLED', run.id, `Cancelled anonymising records from ${run.year}`)
    return NextResponse.json({ success: true })
  }

  if (body?.action !== 'approve') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  const problem = approveProblem(run, me, role, now)
  if (problem) return NextResponse.json({ error: problem }, { status: 403 })
  const passwordProblem = await confirmPassword(me, auth.user.email, body?.password)
  if (passwordProblem) return NextResponse.json({ error: passwordProblem }, { status: 403 })

  // Claim it, so two approvers clicking at once don't both run it.
  const claimed = await prisma.recordsRetentionRun.updateMany({
    where: { id: run.id, status: run.status, approvedAt: run.approvedAt },
    data: { status: 'RUNNING', approvedBy: me, approvedAt: now, summary: null },
  })
  if (claimed.count === 0) return NextResponse.json({ error: 'Someone else just approved this.' }, { status: 409 })
  await logAdminAction(me, 'RECORDS_ANONYMISE_APPROVED', run.id, `Approved anonymising records from ${run.year}`)

  try {
    const counts = await anonymiseYear(run.year)
    const summary = describeCounts(counts)
    await prisma.recordsRetentionRun.update({ where: { id: run.id }, data: { status: 'DONE', finishedAt: new Date(), summary } })
    await logAdminAction(me, 'RECORDS_ANONYMISED', run.id, `Records from ${run.year}: ${summary}`)
    return NextResponse.json({ success: true, summary })
  } catch (err) {
    console.error('[records-retention] run failed', err)
    const message = caught(err)?.message ?? 'Unknown error'
    await prisma.recordsRetentionRun.update({ where: { id: run.id }, data: { status: 'FAILED', summary: message.slice(0, 300) } })
    return NextResponse.json({ error: 'It stopped part way. Nothing is lost; approve it again to finish.' }, { status: 500 })
  }
}
