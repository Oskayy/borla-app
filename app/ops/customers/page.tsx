import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { OrderStatus, Prisma } from '@prisma/client'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/ui'
import { Card, Kpi } from '@/components/ops/kit'
import { AreaChart, Donut } from '@/components/ops/charts'
import Chip from '@/components/kit/Chip'
import { maskPhone } from '@/lib/ops-stats'
import { CUSTOMER_PAGE_ROLES } from '@/lib/ops-nav'

export const dynamic = 'force-dynamic'

// Who books, where and how often. Read-only. Phone numbers are masked; there is nothing here to change.
const PAID: OrderStatus[] = ['PAID', 'READY_FOR_BATCH', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'PICKUP_PENDING_REVIEW', 'PICKED_UP', 'DISPOSAL_PENDING', 'DISPOSAL_VERIFIED', 'COMPLETED']
const VIEWS = { all: 'All', recent: 'Booked in 7 days', nopin: 'No home pin', quiet: 'Gone quiet' } as const
type View = keyof typeof VIEWS
const PAGE = 50
const DAY = 86_400_000

const ghs = (n: number) => `GHS ${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const day = (d: Date) => d.toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', day: 'numeric', month: 'short' })

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; page?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true, active: true } })
  if (!me?.active || !CUSTOMER_PAGE_ROLES.includes(me.role)) redirect('/ops')

  const sp = await searchParams
  const view: View = sp.view && sp.view in VIEWS ? (sp.view as View) : 'all'
  const q = (sp.q ?? '').trim().slice(0, 60)
  const page = Math.min(Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1), 200)

  const now = new Date()
  const since30 = new Date(now.getTime() - 30 * DAY)
  const since7 = new Date(now.getTime() - 7 * DAY)
  const since84 = new Date(now.getTime() - 84 * DAY)

  // Headline numbers and charts, over all customers.
  const total = await prisma.user.count({ where: { role: 'CUSTOMER', active: true } })
  const newThisMonth = await prisma.user.count({ where: { role: 'CUSTOMER', active: true, createdAt: { gte: since30 } } })
  const noPin = await prisma.user.count({
    where: { role: 'CUSTOMER', active: true, OR: [{ customerProfile: null }, { customerProfile: { homeLat: null } }, { customerProfile: { homePinConfirmedAt: null } }] },
  })
  const perCustomer = await prisma.order.groupBy({ by: ['customerId'], where: { status: { in: PAID } }, _count: { _all: true } })
  const booked = perCustomer.length
  const again = perCustomer.filter((c) => c._count._all >= 2).length
  const avg = await prisma.order.aggregate({ where: { status: { in: PAID }, createdAt: { gte: since30 } }, _avg: { pricePesewas: true }, _count: { _all: true } })
  const signups = await prisma.user.findMany({ where: { role: 'CUSTOMER', createdAt: { gte: since84 } }, select: { createdAt: true } })
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const from = since84.getTime() + i * 7 * DAY
    return {
      label: new Date(from).toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', day: 'numeric', month: 'short' }),
      value: signups.filter((s) => s.createdAt.getTime() >= from && s.createdAt.getTime() < from + 7 * DAY).length,
    }
  })
  const zoneGroups = await prisma.customerProfile.groupBy({ by: ['zoneId'], where: { user: { active: true } }, _count: { _all: true } })
  const zoneNames = await prisma.zone.findMany({ where: { id: { in: zoneGroups.map((z) => z.zoneId).filter((x): x is string => !!x) } }, select: { id: true, name: true } })
  const zonesAll = zoneGroups
    .map((z) => ({ label: zoneNames.find((n) => n.id === z.zoneId)?.name ?? 'Outside our zones', value: z._count._all }))
    .sort((a, b) => b.value - a.value)
  const zones = zonesAll.length > 5 ? [...zonesAll.slice(0, 4), { label: 'Other', value: zonesAll.slice(4).reduce((n, z) => n + z.value, 0) }] : zonesAll

  // The table: one page of customers for the chosen view.
  const recentIds = view === 'recent' || view === 'quiet' ? (await prisma.order.findMany({ where: { status: { in: PAID }, createdAt: { gte: view === 'recent' ? since7 : since30 } }, select: { customerId: true }, distinct: ['customerId'] })).map((o) => o.customerId) : []
  const where: Prisma.UserWhereInput = {
    role: 'CUSTOMER',
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    ...(view === 'recent' ? { id: { in: recentIds } } : {}),
    ...(view === 'nopin' ? { OR: [{ customerProfile: null }, { customerProfile: { homeLat: null } }, { customerProfile: { homePinConfirmedAt: null } }] } : {}),
    ...(view === 'quiet' ? { id: { in: perCustomer.map((c) => c.customerId).filter((id) => !recentIds.includes(id)) } } : {}),
  }
  const [count, people] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: { id: true, name: true, phone: true, active: true, createdAt: true, customerProfile: { select: { homeLat: true, homePinConfirmedAt: true, zone: { select: { name: true } } } } },
    }),
  ])
  const stats = people.length
    ? await prisma.order.groupBy({
        by: ['customerId'],
        where: { customerId: { in: people.map((p) => p.id) }, status: { in: PAID } },
        _count: { _all: true },
        _sum: { pricePesewas: true },
        _max: { createdAt: true },
      })
    : []

  const link = (v: View, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ ...(v !== 'all' ? { view: v } : {}), ...(q ? { q } : {}), ...extra })
    const s = p.toString()
    return `/ops/customers${s ? `?${s}` : ''}`
  }
  const pages = Math.max(1, Math.ceil(count / PAGE))

  return (
    <div className="max-w-[1400px]">
      <PageHeader title="Customers" lead="Who books, where and how often. Phone numbers are partly hidden. To help a customer, open their order from Exceptions or the receipt they quote." />

      <div className="anim-stagger mb-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi hero label="Customers" value={total.toLocaleString('en-GB')} note={`${newThisMonth} new in 30 days`} />
        <Kpi label="Booked again" value={booked ? `${Math.round((again / booked) * 100)}%` : '—'} note={`${again} of ${booked} who have booked`} />
        <Kpi label="Average order, 30 days" value={avg._avg.pricePesewas != null ? ghs(avg._avg.pricePesewas / 100) : '—'} note={`${avg._count._all} paid orders`} />
        <Kpi label="No home pin yet" value={noPin} note="Signed up, not set up" tone={noPin ? 'bad' : 'good'} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card id="signups" title="New customers per week" sub="Last 12 weeks">
          <AreaChart data={weeks} label="New customers per week" />
        </Card>
        <Card id="by-zone" title="Customers by zone">
          {zones.length ? <Donut parts={zones} centre={total.toLocaleString('en-GB')} sub="customers" label="Customers by zone" /> : <p className="text-sm text-ink-3">No customers yet.</p>}
        </Card>
      </div>

      <section aria-labelledby="list" className="rounded-card bg-surface p-5 shadow-card ring-1 ring-line/70">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 id="list" className="text-[15px] font-semibold tracking-tight">
            All customers <span className="font-normal tabular-nums text-ink-3">({count})</span>
          </h2>
          <form action="/ops/customers" className="ml-auto flex items-center gap-2">
            {view !== 'all' && <input type="hidden" name="view" value={view} />}
            <label className="sr-only" htmlFor="customer-search">
              Search by name
            </label>
            <input
              id="customer-search"
              name="q"
              defaultValue={q}
              maxLength={60}
              placeholder="Search by name"
              className="min-h-10 w-52 rounded-full border border-line-strong bg-surface px-4 text-sm focus:border-action focus:outline-none focus:ring-3 focus:ring-action/20"
            />
          </form>
        </div>
        <nav aria-label="Show customers" className="mb-3 flex flex-wrap gap-1">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <Link
              key={v}
              href={link(v)}
              aria-current={view === v ? 'page' : undefined}
              className={`min-h-9 content-center rounded-full px-3.5 text-sm font-medium ${view === v ? 'bg-selected text-on-selected' : 'text-ink-2 ring-1 ring-line hover:text-ink'}`}
            >
              {VIEWS[v]}
            </Link>
          ))}
        </nav>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-ink-3">
              <tr className="border-b border-line">
                <th className="px-3 py-2.5 font-medium">Customer</th>
                <th className="px-3 py-2.5 font-medium">Zone</th>
                <th className="px-3 py-2.5 font-medium">Pickups</th>
                <th className="px-3 py-2.5 font-medium">Last pickup</th>
                <th className="px-3 py-2.5 font-medium">Spent</th>
                <th className="px-3 py-2.5 font-medium">Joined</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {people.map((p) => {
                const s = stats.find((x) => x.customerId === p.id)
                const pinned = p.customerProfile?.homeLat != null && !!p.customerProfile?.homePinConfirmedAt
                const last = s?._max.createdAt ?? null
                const status = !p.active
                  ? { tone: 'neutral' as const, text: 'Account closed' }
                  : !pinned
                    ? { tone: 'problem' as const, text: 'No home pin' }
                    : last && last >= since30
                      ? { tone: 'done' as const, text: 'Active' }
                      : last
                        ? { tone: 'neutral' as const, text: 'Gone quiet' }
                        : { tone: 'waiting' as const, text: 'Not booked yet' }
                return (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-3">
                      <span className="block font-semibold">{p.name}</span>
                      <span className="block text-xs text-ink-3">{maskPhone(p.phone)}</span>
                    </td>
                    <td className="px-3 py-3">{p.customerProfile?.zone?.name ?? '—'}</td>
                    <td className="px-3 py-3">{s?._count._all ?? 0}</td>
                    <td className="px-3 py-3">{last ? day(last) : '—'}</td>
                    <td className="px-3 py-3">{ghs((s?._sum.pricePesewas ?? 0) / 100)}</td>
                    <td className="px-3 py-3">{day(p.createdAt)}</td>
                    <td className="px-3 py-3">
                      <Chip tone={status.tone}>{status.text}</Chip>
                    </td>
                  </tr>
                )
              })}
              {people.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-ink-3">
                    No customers match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
            <span className="text-ink-3">
              Page {page} of {pages}
            </span>
            <span className="flex gap-2">
              {page > 1 && (
                <Link href={link(view, { page: String(page - 1) })} className="min-h-10 content-center rounded-full px-4 font-semibold ring-1 ring-line">
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link href={link(view, { page: String(page + 1) })} className="min-h-10 content-center rounded-full px-4 font-semibold ring-1 ring-line">
                  Next
                </Link>
              )}
            </span>
          </nav>
        )}
      </section>
    </div>
  )
}
