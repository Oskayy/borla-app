import Link from 'next/link'
import Logo from '@/components/Logo'

const COLUMNS = [
  { title: 'Service', links: [['Book a pickup', '/book'], ['How it works', '/#how'], ['Where we collect', '/#coverage']] },
  { title: 'Work with us', links: [['Drive with Trashit', '/signup?role=driver'], ['Sign in', '/login']] },
  { title: 'Legal', links: [['Privacy', '/privacy-policy'], ['Terms', '/terms'], ['Refunds', '/refund-policy'], ['Cookies', '/cookie-policy']] },
]

// The website footer (landing page, legal pages and the guest booking page). The apps have none. Kept short: the
// brand on one line, the three link groups side by side even on a phone, and `mt-auto` so it sits at the bottom of a
// short page (its page is a full-height flex column).
export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-canvas text-ink-2">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-10 md:grid-cols-[1.3fr_2fr] md:gap-12">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:block">
          <span className="only-light">
            <Logo height={26} />
          </span>
          <span className="only-dark">
            <Logo height={26} onDark />
          </span>
          <p className="max-w-xs text-sm leading-relaxed md:mt-3">Night-time refuse collection in Ghana, with proof at every step.</p>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:gap-8">
          {COLUMNS.map((col) => (
            <div key={col.title} className="min-w-0">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-3">{col.title}</h2>
              <ul className="mt-2.5 grid gap-1.5 text-sm">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="inline-block py-1 underline-offset-4 transition hover:text-ink hover:underline">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-3.5 text-xs text-ink-3 sm:px-6">
          <span>© 2026 Trashit</span>
          <span>Accra, Ghana</span>
        </p>
      </div>
    </footer>
  )
}
