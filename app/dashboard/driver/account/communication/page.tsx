import { Card } from '@/components/ui'
import { BackToAccount } from '@/components/driver/AccountRow'
import EnableAlerts from '@/components/EnableAlerts'
import InstallPrompt from '@/components/InstallPrompt'

export default function DriverCommunicationPage() {
  return (
    <div className="max-w-4xl">
      <BackToAccount />
      <h1 className="anim-rise mb-5 text-[clamp(1.75rem,2.8vw,2.25rem)] font-bold leading-[1.1] tracking-[-0.03em]">Communication</h1>
      <Card>
        <h2 className="text-base font-semibold tracking-tight">Alerts on this phone</h2>
        <p className="mt-1 text-sm text-ink-2">
          Your phone rings when stops are added to your route, when one goes to another driver, and when your earnings are sent.
        </p>
        <div className="mt-4 grid gap-3">
          <EnableAlerts explain message="Turn on alerts so your phone rings when stops are added, even with Trashit closed." />
          <InstallPrompt />
        </div>
      </Card>
    </div>
  )
}
