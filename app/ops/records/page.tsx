import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/ui'
import { AllClear, SectionTitle } from '@/components/ops/kit'
import RecordsYears, { type YearRow } from '@/components/ops/RecordsYears'
import { RECORDS_PAGE_ROLES, dueDate, isDue, isStuck, yearsToShow } from '@/lib/records-retention'
import { countYear } from '@/lib/records-retention-server'
import { RECORDS_YEARS } from '@/lib/retention'

export const dynamic = 'force-dynamic'

const day = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Accra' })

export default async function RecordsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !(RECORDS_PAGE_ROLES as readonly string[]).includes(dbUser.role)) redirect('/ops')

  const now = new Date()
  const [oldest, runs] = await Promise.all([
    prisma.order.findFirst({ where: { status: { not: 'DRAFT' } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.recordsRetentionRun.findMany({ orderBy: { requestedAt: 'desc' } }),
  ])
  const oldestYear = oldest ? oldest.createdAt.getUTCFullYear() : null
  const names = new Map(
    (await prisma.user.findMany({ where: { id: { in: runs.flatMap((r) => [r.requestedBy, r.approvedBy ?? '']).filter(Boolean) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name])
  )

  const rows: YearRow[] = await Promise.all(
    yearsToShow(oldestYear, now).map(async (year) => {
      const run = runs.find((r) => r.year === year && r.status !== 'CANCELLED') ?? null
      const due = isDue(year, now)
      return {
        year,
        due,
        dueOn: day(dueDate(year)),
        counts: due && run?.status !== 'DONE' ? await countYear(year) : null,
        run: run && {
          id: run.id,
          status: isStuck(run, now) ? 'STUCK' : run.status,
          requestedBy: names.get(run.requestedBy) ?? 'Someone',
          requestedAt: day(run.requestedAt),
          mine: run.requestedBy === user.id,
          approvedBy: run.approvedBy ? (names.get(run.approvedBy) ?? 'Someone') : null,
          finishedAt: run.finishedAt ? day(run.finishedAt) : null,
          summary: run.summary,
        },
      }
    })
  )
  const firstDue = oldestYear !== null ? day(dueDate(oldestYear)) : null

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Old records"
        lead={`Orders, payments, payouts and staff logs are kept ${RECORDS_YEARS} years for tax, then their personal details are removed: pins, addresses, wallet numbers and names, notes, comments and reasons. Amounts, dates and the ledger stay, so every total still adds up. Each year needs a super admin to ask and a different super admin or finance user to approve.`}
      />
      <section aria-labelledby="h-years">
        <SectionTitle id="h-years" hint="A year's records are due on 1 January, seven years after it (six years after the year ends).">
          By year
        </SectionTitle>
        {rows.length === 0 ? (
          <AllClear>Nothing is due yet.{firstDue ? ` The first records (${oldestYear}) are due on ${firstDue}.` : ''}</AllClear>
        ) : (
          <RecordsYears rows={rows} canRequest={dbUser.role === 'SUPER_ADMIN'} />
        )}
      </section>
    </div>
  )
}
