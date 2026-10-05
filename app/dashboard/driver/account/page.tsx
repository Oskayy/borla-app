import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, ChevronRight, FileText, KeyRound, ShieldCheck } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { dateLabel } from '@/lib/format'
import { BUTTON_QUIET, Card, CardTitle, PageHeader } from '@/components/ui'
import EnableAlerts from '@/components/EnableAlerts'
import InstallPrompt from '@/components/InstallPrompt'
import SignOutButton from '@/components/SignOutButton'

export const dynamic = 'force-dynamic'

function Row({ href, icon: Icon, title, text }: { href: string; icon: typeof KeyRound; title: string; text: string }) {
  return (
    <Link href={href} className="-mx-2 flex min-h-14 items-center gap-3 rounded-control p-2 hover:bg-canvas">
      <Icon aria-hidden className="size-5 shrink-0 text-ink-3" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-ink-3">{text}</span>
      </span>
      <ChevronRight aria-hidden className="size-4 text-ink-3" />
    </Link>
  )
}

// The driver's account: who they are, sign-in security, alerts on this phone, sign out.
export default async function DriverAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [me, factors] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { name: true, phone: true, email: true, createdAt: true } }),
    supabase.auth.mfa.listFactors(),
  ])
  if (!me) redirect('/login')
  const has2fa = !!factors.data?.totp?.some((f) => f.status === 'verified')

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Account" />
      <div className="grid gap-6">
        <Card>
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-full bg-action text-lg font-semibold text-on-action">
              {me.name
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() ?? '')
                .join('')}
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold tracking-tight">{me.name}</span>
              <span className="block text-sm text-ink-3">
                {me.phone} · {me.email}
              </span>
              <span className="block text-sm text-ink-3">Driving with Trashit since {dateLabel(me.createdAt)}</span>
            </span>
          </div>
          <p className="mt-4 text-sm text-ink-3">To change your name or phone number, contact Trashit.</p>
        </Card>

        <Card>
          <CardTitle>Sign-in and security</CardTitle>
          <div className="grid gap-1">
            <Row href="/reset-password" icon={KeyRound} title="Change password" text="Choose a new password for your account" />
            <Row
              href="/account/security"
              icon={ShieldCheck}
              title="Two-factor authentication"
              text={has2fa ? 'On: a code from your authenticator app is needed to sign in' : 'Off: add a code from an authenticator app when you sign in'}
            />
          </div>
        </Card>

        <Card>
          <CardTitle>Alerts on this phone</CardTitle>
          <p className="mb-4 text-sm text-ink-2">Your phone rings when stops are added to your route, even with Trashit closed.</p>
          <div className="grid gap-3 empty:hidden">
            <EnableAlerts compact message="Alerts are off on this phone." />
            <InstallPrompt />
          </div>
        </Card>

        <Card>
          <CardTitle>Work</CardTitle>
          <div className="grid gap-1">
            <Row href="/dashboard/driver/availability" icon={CalendarDays} title="Availability" text="The nights you work, and nights off" />
          </div>
        </Card>

        <Card>
          <CardTitle>Terms</CardTitle>
          <div className="grid gap-1">
            <Row href="/terms" icon={FileText} title="Terms of service" text="The rules for using Trashit" />
            <Row href="/privacy-policy" icon={FileText} title="Privacy policy" text="What we collect and why" />
          </div>
        </Card>

        <Card>
          <CardTitle>Sign out</CardTitle>
          <p className="mb-4 text-sm text-ink-2">Go offline first if you are on shift.</p>
          <SignOutButton className={BUTTON_QUIET} />
        </Card>
      </div>
    </div>
  )
}
