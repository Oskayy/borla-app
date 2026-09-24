import Link from 'next/link'

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav style={{ padding: 10, borderBottom: '1px solid #ccc', display: 'flex', gap: 15 }}>
        <Link href="/dashboard/driver">Dashboard</Link>
      </nav>
      {children}
    </div>
  )
}