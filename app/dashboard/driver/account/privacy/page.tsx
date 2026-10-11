import { FileText, ScrollText } from 'lucide-react'
import { AccountGroup, AccountRow, BackToAccount } from '@/components/driver/AccountRow'

export default function DriverPrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <BackToAccount />
      <h1 className="mb-5 text-[clamp(1.5rem,3vw,1.9rem)] font-bold tracking-[-0.025em]">Privacy and data</h1>
      <AccountGroup title="Policies">
        <AccountRow href="/privacy-policy" icon={FileText} title="Privacy policy" />
        <AccountRow href="/terms" icon={ScrollText} title="Terms of service" />
      </AccountGroup>
      <p className="mt-4 px-1 text-sm text-ink-3">
        Your Ghana Card number and photos are stored privately and seen only by the Trashit team who approve drivers. Earnings records are kept
        for accounting. A way to ask for a copy of your data, or to close your account, will appear here.
      </p>
    </div>
  )
}
