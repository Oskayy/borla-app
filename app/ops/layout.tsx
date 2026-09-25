import OpsNav from '@/components/OpsNav'

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <OpsNav />
      <main style={{ padding: '24px' }}>{children}</main>
    </div>
  )
}