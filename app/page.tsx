import Link from 'next/link'
import Logo from '@/components/Logo'
import { BRAND } from '@/lib/brand'

// Public home page.
const steps = [
  { title: 'Pin your gate', text: 'Put a pin on your house once. Drivers come straight to it.' },
  { title: 'Book and pay', text: 'Choose your bins, see the price, pay with MoMo or card. Book any time.' },
  { title: 'We collect tonight', text: 'Put your bins out. Collection runs overnight, and you get a message when it’s done.' },
]

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Logo height={32} />
        <nav style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/login" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none', fontSize: 15 }}>
            Log in
          </Link>
          <Link href="/signup" className="btn-accent" style={{ textDecoration: 'none' }}>
            Sign up
          </Link>
        </nav>
      </header>

      <section style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px 24px', textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND.logoMark} alt="" width={88} height={88} style={{ margin: '0 auto 20px', display: 'block' }} />
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 52px)', lineHeight: 1.1, marginBottom: 16, color: 'var(--color-primary)' }}>
          Book your bin collection in a minute.
        </h1>
        <p style={{ fontSize: 18, color: '#444', maxWidth: 560, margin: '0 auto 28px' }}>
          {BRAND.name} collects household waste overnight, takes it to approved disposal sites, and tells you when it&apos;s done.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/signup" className="btn-accent" style={{ textDecoration: 'none', padding: '14px 24px', fontSize: 16 }}>
            Book a pickup
          </Link>
          <Link href="/signup" className="btn-primary" style={{ textDecoration: 'none', padding: '14px 24px', fontSize: 16 }}>
            Drive with {BRAND.name}
          </Link>
        </div>
      </section>

      <section style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 64px', display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', width: '100%' }}>
        {steps.map((s, i) => (
          <div key={s.title} className="panel">
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-accent)', marginBottom: 4 }}>STEP {i + 1}</p>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>{s.title}</h2>
            <p style={{ fontSize: 15, color: '#444' }}>{s.text}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
