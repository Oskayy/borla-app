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

function Row({ href, icon: Icon, title, text }: { href: string; icon: typeof KeyRound; title: string; text: string }) {
  return (
    <Link href={href} className="-mx-2 flex items-center gap-3 rounded-control p-2 hover:bg-canvas">
      <Icon aria-hidden className="size-5 shrink-0 text-ink-2" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-ink-3">{text}</span>
      </span>
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
          <CardTitle>Alerts on this device</CardTitle>
          <p className="mb-4 text-sm text-ink-2">Hear when your driver is assigned and when your bins are collected, even with Trashit closed.</p>
          <div className="empty:hidden">
            <EnableAlerts compact message="Alerts are off on this device." />
          </div>
          <div className="mt-3 empty:hidden">
            <InstallPrompt />
          </div>
        </Card>

        <Card>
          <CardTitle>Privacy and terms</CardTitle>
          <div className="grid gap-1">
            <Row href="/privacy-policy" icon={FileText} title="Privacy policy" text="What we collect and why" />
            <Row href="/terms" icon={FileText} title="Terms of service" text="The rules for using Trashit" />
            <Row href="/refund-policy" icon={FileText} title="Refund policy" text="Cancellations and refunds" />
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
