import Link from 'next/link'
import Logo from '@/components/Logo'

const COLUMNS = [
  { title: 'Service', links: [['Book a pickup', '/book'], ['How it works', '/#how'], ['Where we collect', '/#coverage']] },
  { title: 'Work with us', links: [['Drive with Trashit', '/signup?role=driver'], ['Sign in', '/login']] },
  { title: 'Legal', links: [['Privacy', '/privacy-policy'], ['Terms', '/terms'], ['Refunds', '/refund-policy'], ['Cookies', '/cookie-policy']] },
]

// The website footer (landing page, legal pages and other public pages). The apps have none.
export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-canvas text-ink-2">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <span className="only-light">
            <Logo height={30} />
          </span>
          <span className="only-dark">
            <Logo height={30} onDark />
          </span>
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed">Night-time refuse collection in Ghana, with proof at every step.</p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="text-sm font-semibold text-ink-3">{col.title}</h2>
            <ul className="mt-4 grid gap-2.5 text-[15px]">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="underline-offset-4 transition hover:text-ink hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-5 text-sm text-ink-3 sm:px-6">
          <span>© 2026 Trashit</span>
          <span>Accra, Ghana</span>
        </p>
      </div>
    </footer>
  )
}
