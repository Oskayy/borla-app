import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bell, MapPin } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import Logo from '@/components/Logo'
import { BottomTabs, CustomerRail } from '@/components/customer/CustomerNav'
import ResumeBooking from '@/components/customer/ResumeBooking'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { supportHref } from '@/lib/support'
import { todayLabel } from '@/lib/format'

// The customer workspace frame: sidebar and top bar on desktop, top bar and bottom tabs on phones.
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [me, profile, unread] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { name: true, role: true, active: true } }),
    prisma.customerProfile.findUnique({ where: { userId: user.id }, select: { address: true, zone: { select: { name: true } } } }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ])
  if (!me || !me.active) redirect('/login')
  if (me.role !== 'CUSTOMER') redirect('/dashboard')

  const area = profile?.zone?.name ?? (profile?.address ? profile.address.split(',')[0] : null)
  const initials = me.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  const today = todayLabel()
  const help = supportHref()

  return (
    <div data-surface="new" className="min-h-dvh bg-canvas text-ink lg:grid lg:grid-cols-[84px_1fr]">
      {/* Desktop: the icon rail */}
      <aside className="sticky top-0 hidden h-dvh border-r border-line lg:block">
        <CustomerRail unread={unread} initials={initials} help={help} />
      </aside>

      <div className="min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Link href="/dashboard/customer" aria-label="Trashit home" className="lg:hidden">
              <Logo height={26} />
            </Link>
            {area && (
              <Link
                href="/dashboard/customer/home-location"
                className="hidden items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-ink-2 hover:bg-canvas sm:inline-flex"
              >
                <MapPin aria-hidden className="size-4 text-action-deep" /> {area}
              </Link>
            )}
            <span className="ml-auto hidden text-sm text-ink-3 sm:block">{today}</span>
            <ThemeToggle className="ml-auto ring-0 sm:ml-0" />
            <Link
              href="/dashboard/customer/notifications"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
              className="press relative grid size-11 place-items-center rounded-full text-ink-2 hover:bg-canvas"
            >
              <Bell aria-hidden className="size-5" />
              {unread > 0 && (
                <span aria-hidden className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-surface">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <Link href="/dashboard/customer/profile" aria-label="Your profile" className="grid size-9 place-items-center rounded-full bg-selected text-sm font-semibold text-on-selected lg:hidden">
              {initials}
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8">{children}</main>
      </div>

      <BottomTabs />
      <ResumeBooking />
    </div>
  )
}
