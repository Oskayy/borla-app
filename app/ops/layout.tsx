import OpsNav from '@/components/OpsNav'
import OpsAlerts from '@/components/OpsAlerts'
import EnableAlerts from '@/components/EnableAlerts'

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <OpsNav />
      <main style={{ padding: '24px' }}>
        <OpsAlerts />
        <EnableAlerts
          compact
          message="Turn on alerts on this device so you hear when tonight's plan is ready or an order needs a driver."
        />
        {children}
      </main>
    </div>
  )
}