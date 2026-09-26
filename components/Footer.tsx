import Link from 'next/link'

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--color-border)',
        padding: '20px',
        marginTop: 40,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 16,
          marginBottom: 8,
        }}
      >
        <Link href="/privacy-policy" style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}>
          Privacy Policy
        </Link>
        <Link href="/terms" style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}>
          Terms & Conditions
        </Link>
        <Link href="/cookie-policy" style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}>
          Cookie Policy
        </Link>
        <Link href="/refund-policy" style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}>
          Refund Policy
        </Link>
      </div>
      <p style={{ fontSize: 12, color: '#999', margin: 0 }}>
        © {new Date().getFullYear()} Borla. All rights reserved.
      </p>
    </footer>
  )
}