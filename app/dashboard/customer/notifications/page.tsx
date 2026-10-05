import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bell, BellOff, ChevronRight } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { dateTimeLabel } from '@/lib/format'
import { Card, PageHeader } from '@/components/ui'
import MarkAllRead from '@/components/customer/MarkAllRead'
import EnableAlerts from '@/components/EnableAlerts'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const notices = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, title: true, body: true, url: true, createdAt: true, readAt: true },
  })
  const unreadIds = notices.filter((n) => !n.readAt).map((n) => n.id)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" lead="Updates about your pickups and payments." action={<MarkAllRead ids={unreadIds} />} />

      <div className="mb-6 empty:hidden">
        <EnableAlerts compact message="Turn on alerts on this phone so you hear about your pickup even when Trashit is closed." />
      </div>

      {notices.length === 0 ? (
        <Card className="grid place-items-center py-14 text-center">
          <BellOff aria-hidden className="size-8 text-ink-3" />
          <p className="mt-3 font-semibold">No notifications yet</p>
          <p className="mt-1 text-sm text-ink-2">We&apos;ll tell you here when your pickup is booked, assigned and collected.</p>
        </Card>
      ) : (
        <ul className="overflow-hidden rounded-card bg-surface ring-1 ring-line divide-y divide-line">
          {notices.map((n) => {
            const unread = !n.readAt
            const inner = (
              <>
                <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${unread ? 'bg-customer-wash text-customer-deep' : 'bg-canvas text-ink-3'}`}>
                  <Bell aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={`font-semibold ${unread ? 'text-ink' : 'text-ink-2'}`}>{n.title}</span>
                    {unread && (
                      <span className="size-2 rounded-full bg-customer">
                        <span className="sr-only">Unread</span>
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[15px] text-ink-2">{n.body}</span>
                  <span className="mt-1 block text-xs text-ink-3">{dateTimeLabel(n.createdAt)}</span>
                </span>
              </>
            )
            return (
              <li key={n.id} className={unread ? 'bg-customer-wash/40' : ''}>
                {n.url && n.url.startsWith('/') ? (
                  <Link href={n.url} className="flex items-start gap-3.5 px-4 py-4 hover:bg-canvas sm:px-5">
                    {inner}
                    <ChevronRight aria-hidden className="mt-2 size-4 shrink-0 text-ink-3" />
                  </Link>
                ) : (
                  <div className="flex items-start gap-3.5 px-4 py-4 sm:px-5">{inner}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
