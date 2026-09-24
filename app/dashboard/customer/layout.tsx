import Link from 'next/link'

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav style={{ padding: 10, borderBottom: '1px solid #ccc', display: 'flex', gap: 15 }}>
        <Link href="/dashboard/customer">Home</Link>
        <Link href="/dashboard/customer/book">Book a Pickup</Link>
        <Link href="/dashboard/customer/orders">My Orders</Link>
      </nav>
      {children}
    </div>
  )
}