import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Download, FileText, KeyRound, ShieldCheck } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { BUTTON_QUIET, Card, CardTitle, PageHeader } from '@/components/ui'
import EnableAlerts from '@/components/EnableAlerts'
import InstallPrompt from '@/components/InstallPrompt'
import SignOutButton from '@/components/SignOutButton'
import DeleteAccount from '@/components/customer/DeleteAccount'

export const dynamic = 'force-dynamic'

// A settings row: icon, title, an optional short value on the right, and (for real settings) a line saying what it does.
function Row({ href, icon: Icon, title, value, desc }: { href: string; icon: typeof KeyRound; title: string; value?: string; desc?: string }) {
  return (
    <Link href={href} className="press -mx-2 flex min-h-12 items-center gap-3 rounded-control p-2 hover:bg-canvas">
      <Icon aria-hidden className="size-5 shrink-0 text-ink-2" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {desc && <span className="block text-sm text-ink-3">{desc}</span>}
      </span>
      {value && <span className="shrink-0 text-sm text-ink-3">{value}</span>}
      <ChevronRight aria-hidden className="size-4 text-ink-3" />
    </Link>
  )
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: factors } = await supabase.auth.mfa.listFactors()
  const has2fa = !!factors?.totp?.some((f) => f.status === 'verified')

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" lead="Make Trashit work the way you want it to." />
      <div className="grid gap-6">
        <Card>
          <CardTitle>Sign-in and security</CardTitle>
          <div className="grid gap-1">
            <Row
              href="/reset-password"
              icon={KeyRound}
              title="Change password"
              desc="Pick a new password. Other phones signed in to your account are signed out."
            />
            <Row
              href="/account/security"
              icon={ShieldCheck}
              title="Two-factor authentication"
              value={has2fa ? 'On' : 'Off'}
              desc="Also asks for a 6-digit code from an app on your phone when you sign in. Optional, and safer."
            />
          </div>
        </Card>

        <Card>
          <CardTitle>Alerts on this device</CardTitle>
          <p className="mb-4 text-sm text-ink-2">Hear when a driver is assigned and when your bins are collected, even with Trashit closed.</p>
          <EnableAlerts explain message="Alerts are off on this phone." />
          <div className="mt-3 empty:hidden">
            <InstallPrompt />
          </div>
        </Card>

        <Card>
          <CardTitle>Privacy and terms</CardTitle>
          <div className="grid gap-1">
            <Row href="/privacy-policy" icon={FileText} title="Privacy policy" />
            <Row href="/terms" icon={FileText} title="Terms of service" />
            <Row href="/refund-policy" icon={FileText} title="Refund policy" />
          </div>
        </Card>

        <Card>
          <CardTitle>Your data</CardTitle>
          <p className="mb-4 text-sm text-ink-2">
            Download a copy of what Trashit holds about you, or delete your account. Deleting keeps payment records for
            accounting, without your name or contact details.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href="/api/account/export" download className={BUTTON_QUIET}>
              <Download aria-hidden className="size-4" /> Download my data
            </a>
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <DeleteAccount />
          </div>
        </Card>

        <Card>
          <CardTitle>Sign out</CardTitle>
          <p className="mb-4 text-sm text-ink-2">Your pickups carry on as scheduled after you sign out.</p>
          <SignOutButton className={BUTTON_QUIET} />
        </Card>
      </div>
    </div>
  )
}
