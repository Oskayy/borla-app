import { Card } from '@/components/ui'
import { BackToAccount } from '@/components/driver/AccountRow'
import EnableAlerts from '@/components/EnableAlerts'
import InstallPrompt from '@/components/InstallPrompt'

export default function DriverCommunicationPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <BackToAccount />
      <h1 className="mb-5 text-[clamp(1.5rem,3vw,1.9rem)] font-bold tracking-[-0.025em]">Communication</h1>
      <Card>
        <h2 className="text-base font-semibold tracking-tight">Alerts on this phone</h2>
        <div className="mt-3 grid gap-3">
          <EnableAlerts compact message="Your phone rings when stops are added to your route, even with Trashit closed." />
          <InstallPrompt />
        </div>
      </Card>
    </div>
  )
}
